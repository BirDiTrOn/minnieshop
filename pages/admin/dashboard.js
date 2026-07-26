import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const GAME_PRESETS = [
  { id: "grow-a-garden", label: "Grow a Garden 2", accent: "#5fb894" },
  { id: "blade-ball", label: "Blade Ball", accent: "#e2708b" },
  { id: "other", label: "Other game", accent: "#7699e0" },
];

function gameMeta(gameId) {
  return GAME_PRESETS.find((g) => g.id === gameId) || GAME_PRESETS[2];
}

function formatPrice(price, currency) {
  const n = Number(price);
  if (currency === "KHR") return `៛${n.toLocaleString()}`;
  return `$${n.toFixed(2)}`;
}

function fileToCompressedDataUrl(file, maxDim = 480, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function Dashboard() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [form, setForm] = useState({
    name: "", game: "grow-a-garden", customGame: "", price: "", currency: "USD", description: "", image: null,
  });
  const [imgError, setImgError] = useState("");

  async function loadAll() {
    setLoading(true);
    const [itemsRes, ordersRes] = await Promise.all([
      fetch("/api/items").then((r) => r.json()),
      fetch("/api/orders").then((r) => r.json()),
    ]);
    setItems(itemsRes.items || []);
    setOrders(ordersRes.orders || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  function resetForm() {
    setForm({ name: "", game: "grow-a-garden", customGame: "", price: "", currency: "USD", description: "", image: null });
    setImgError("");
  }

  async function handleImageChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImgError("That's not an image file.");
      return;
    }
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setForm((f) => ({ ...f, image: dataUrl }));
      setImgError("");
    } catch (err) {
      setImgError("Couldn't load that image.");
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    const gameLabel = form.game === "other" ? (form.customGame.trim() || "Other game") : gameMeta(form.game).label;
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          game: form.game,
          gameLabel,
          price: form.price,
          currency: form.currency,
          description: form.description.trim(),
          image: form.image,
        }),
      });
      if (!res.ok) throw new Error("failed");
      await loadAll();
      resetForm();
      setShowForm(false);
      showToast("Listed! It's live on your storefront.");
    } catch (e) {
      showToast("Couldn't save that listing — try again.", true);
    } finally {
      setSaving(false);
    }
  }

  async function toggleSold(item) {
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sold: !item.sold }),
    });
    if (res.ok) {
      await loadAll();
    } else {
      showToast("Couldn't update that item.", true);
    }
  }

  async function deleteItem(item) {
    if (!confirm(`Remove "${item.name}"? This can't be undone.`)) return;
    const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      await loadAll();
      showToast("Listing removed.");
    } else {
      showToast("Couldn't remove that item.", true);
    }
  }

  async function updateOrderStatus(order, status) {
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await loadAll();
      showToast(status === "confirmed" ? "Order confirmed — item marked sold." : "Claim rejected.");
    } else {
      showToast("Couldn't update that claim.", true);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin-logout", { method: "POST" });
    router.push("/admin/login");
  }

  const pendingOrders = orders.filter((o) => o.status === "pending");

  return (
    <div className="wrap">
      <Head>
        <title>Minnieshop — Dashboard</title>
        <link rel="icon" href="/favicon.png" />
      </Head>
      <header className="vault-header">
        <div className="vault-title-wrap">
          <img className="brand-badge" src="/logo.jpg" alt="Minnieshop" />
          <div>
            <h1 className="vault-title">Minnieshop Dashboard</h1>
            <div className="vault-sub">Manage listings and payment claims</div>
          </div>
        </div>
        <div className="top-actions">
          <a className="link-btn" href="/" target="_blank" rel="noreferrer">View storefront ↗</a>
          <button className="link-btn" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <div className="toolbar">
        <div className="stat-pill">
          <b>{items.filter((i) => !i.sold).length}</b> listed &nbsp;·&nbsp;
          <b>{pendingOrders.length}</b> pending claim{pendingOrders.length === 1 ? "" : "s"}
        </div>
        <button className="add-btn" onClick={() => setShowForm(true)}>+ List new item</button>
      </div>

      <section className="dash-section">
        <h2>Payment claims {pendingOrders.length > 0 && <span className="status-badge status-pending">{pendingOrders.length} new</span>}</h2>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">No claims yet. They'll show up here the moment a buyer says they've paid.</div>
        ) : (
          orders.map((o) => (
            <div className="order-row" key={o.id}>
              <div className="order-main">
                <div className="order-name">{o.item_name} — {formatPrice(o.price, o.currency)}</div>
                <div className="order-meta">
                  {o.buyer_contact ? `Contact: ${o.buyer_contact}` : "No contact provided"} · {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
              {o.status === "pending" ? (
                <div className="order-actions">
                  <button className="confirm" onClick={() => updateOrderStatus(o, "confirmed")}>Confirm</button>
                  <button className="reject" onClick={() => updateOrderStatus(o, "rejected")}>Reject</button>
                </div>
              ) : (
                <span className={`status-badge status-${o.status}`}>{o.status}</span>
              )}
            </div>
          ))
        )}
      </section>

      <section className="dash-section">
        <h2>Your listings</h2>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <h3>Nothing listed yet</h3>
            <div>Tap "List new item" to add your first one.</div>
          </div>
        ) : (
          <div className="grid">
            {items.map((it) => {
              const meta = gameMeta(it.game);
              return (
                <div key={it.id} className="item-card" style={{ "--card-accent": meta.accent, cursor: "default" }}>
                  <div className={`item-thumb ${it.sold ? "sold" : ""}`}>
                    {it.sold && <span className="sold-badge">SOLD</span>}
                    <span className="game-tag" style={{ color: meta.accent }}>{it.game_label}</span>
                    {it.image ? (
                      <img src={it.image} alt={it.name} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
                        no photo
                      </div>
                    )}
                  </div>
                  <div className="item-body">
                    <div className="item-name">{it.name}</div>
                    <div className="item-foot">
                      <span className="price-ticket">{formatPrice(it.price, it.currency)}</span>
                    </div>
                    <div className="action-row">
                      <button className="btn-secondary" onClick={() => toggleSold(it)}>
                        {it.sold ? "Mark available" : "Mark sold"}
                      </button>
                      <button className="btn-danger" onClick={() => deleteItem(it)}>Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            <form className="form-grid" onSubmit={handleAddItem}>
              <div className="vault-sub" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, color: "var(--text)" }}>
                List a new item
              </div>

              <div className="field">
                <label>Item name</label>
                <input type="text" placeholder="e.g. Shiny Mythical Egg" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>

              <div className="row-2">
                <div className="field">
                  <label>Game</label>
                  <select value={form.game} onChange={(e) => setForm((f) => ({ ...f, game: e.target.value }))}>
                    {GAME_PRESETS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                </div>
                {form.game === "other" && (
                  <div className="field">
                    <label>Game name</label>
                    <input type="text" placeholder="Game title" value={form.customGame}
                      onChange={(e) => setForm((f) => ({ ...f, customGame: e.target.value }))} />
                  </div>
                )}
              </div>

              <div className="row-2">
                <div className="field">
                  <label>Price</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00" value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} required />
                </div>
                <div className="field">
                  <label>Currency</label>
                  <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                    <option value="USD">USD</option>
                    <option value="KHR">KHR</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Description</label>
                <textarea placeholder="Traits, condition, how you'll deliver it in-game…" value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>

              <div className="field">
                <label>Photo</label>
                {form.image && <img className="img-preview" src={form.image} alt="preview" />}
                <label className="img-drop">
                  {form.image ? "Change photo" : "Click to upload a photo"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
                </label>
                {imgError && <div className="error-text">{imgError}</div>}
              </div>

              <button className="btn" type="submit" disabled={saving} style={{ justifyContent: "center" }}>
                {saving ? "Saving…" : "Add to vault"}
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.isError ? "error" : ""}`}>{toast.msg}</div>}
    </div>
  );
}
