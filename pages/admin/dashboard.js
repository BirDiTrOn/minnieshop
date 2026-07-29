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
  if (n > 0 && n < 0.01) return `$${n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
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
  const [claimsCollapsed, setClaimsCollapsed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [form, setForm] = useState({
    name: "", game: "grow-a-garden", customGame: "", price: "", currency: "USD", description: "", image: null,
    pricingMode: "fixed", unitLabel: "", unitAmount: "", stock: "", minQty: "", tiers: [],
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
    setForm({
      name: "", game: "grow-a-garden", customGame: "", price: "", currency: "USD", description: "", image: null,
      pricingMode: "fixed", unitLabel: "", unitAmount: "", stock: "", minQty: "", tiers: [],
    });
    setImgError("");
    setEditingId(null);
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(item) {
    const isPresetGame = GAME_PRESETS.some((g) => g.id === item.game && g.id !== "other");
    setForm({
      name: item.name || "",
      game: isPresetGame ? item.game : "other",
      customGame: isPresetGame ? "" : (item.game_label || ""),
      price: item.price ?? "",
      currency: item.currency || "USD",
      description: item.description || "",
      image: item.image || null,
      pricingMode: item.pricing_mode === "unit" ? "unit" : "fixed",
      unitLabel: item.unit_label || "",
      unitAmount: item.unit_amount ?? "",
      stock: item.stock === null || item.stock === undefined ? "" : item.stock,
      minQty: item.min_qty === null || item.min_qty === undefined || Number(item.min_qty) === 1 ? "" : item.min_qty,
      tiers: Array.isArray(item.tiers) ? item.tiers.map((t) => ({ minQty: String(t.minQty ?? ""), pricePerUnit: String(t.pricePerUnit ?? "") })) : [],
    });
    setImgError("");
    setEditingId(item.id);
    setShowForm(true);
  }

  function addTierRow() {
    setForm((f) => ({ ...f, tiers: [...f.tiers, { minQty: "", pricePerUnit: "" }] }));
  }
  function updateTierRow(index, field, value) {
    setForm((f) => ({
      ...f,
      tiers: f.tiers.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    }));
  }
  function removeTierRow(index) {
    setForm((f) => ({ ...f, tiers: f.tiers.filter((_, i) => i !== index) }));
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

  async function handleSaveItem(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    if (form.pricingMode === "unit" && (!form.unitLabel.trim() || !form.unitAmount)) return;
    setSaving(true);
    const gameLabel = form.game === "other" ? (form.customGame.trim() || "Other game") : gameMeta(form.game).label;
    const payload = {
      name: form.name.trim(),
      game: form.game,
      gameLabel,
      game_label: gameLabel,
      price: form.price,
      currency: form.currency,
      description: form.description.trim(),
      image: form.image,
      pricingMode: form.pricingMode,
      pricing_mode: form.pricingMode === "unit" ? "unit" : "fixed",
      unitLabel: form.pricingMode === "unit" ? form.unitLabel.trim() : null,
      unit_label: form.pricingMode === "unit" ? form.unitLabel.trim() : null,
      unitAmount: form.pricingMode === "unit" ? form.unitAmount : null,
      unit_amount: form.pricingMode === "unit" ? form.unitAmount : null,
      stock: form.stock === "" ? null : form.stock,
      minQty: form.minQty === "" ? 1 : form.minQty,
      min_qty: form.minQty === "" ? 1 : form.minQty,
      tiers: form.tiers
        .filter((t) => t.minQty !== "" && t.pricePerUnit !== "")
        .map((t) => ({ minQty: Number(t.minQty), pricePerUnit: Number(t.pricePerUnit) })),
    };
    try {
      const res = await fetch(editingId ? `/api/items/${editingId}` : "/api/items", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("failed");
      await loadAll();
      resetForm();
      setShowForm(false);
      showToast(editingId ? "Listing updated." : "Listed! It's live on your storefront.");
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

  async function moveItem(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setItems(reordered);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: reordered.map((it) => it.id) }),
      });
      if (!res.ok) throw new Error("failed");
    } catch (e) {
      showToast("Couldn't save the new order — try again.", true);
      await loadAll();
    }
  }

  async function updateOrderStatus(order, status) {
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      await loadAll();
      if (status === "confirmed") showToast("Order confirmed — stock updated.");
      else if (status === "rejected") showToast("Claim rejected.");
      else if (status === "delivered") {
        showToast(data.notified ? "Buyer notified on Telegram! 🎉" : (data.notifyError || "Marked delivered."));
      }
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
        <button className="add-btn" onClick={openAddForm}>+ List new item</button>
      </div>

      <div className="dash-columns">
        <section className="dash-section">
          <h2
            style={{ cursor: "pointer", justifyContent: "space-between", width: "100%" }}
            onClick={() => setClaimsCollapsed((c) => !c)}
          >
            <span>
              Payment claims {pendingOrders.length > 0 && <span className="status-badge status-pending">{pendingOrders.length} new</span>}
            </span>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>{claimsCollapsed ? "▸ Show" : "▾ Hide"}</span>
          </h2>
          {claimsCollapsed ? null : loading ? (
            <div className="empty-state">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">No claims yet. They'll show up here the moment a buyer says they've paid.</div>
          ) : (
            orders.map((o) => {
              const cartLines = Array.isArray(o.items) && o.items.length ? o.items : null;
              return (
                <div className="order-row" key={o.id}>
                  <div className="order-main">
                    <div className="order-name">
                      {o.item_name} {o.qty > 1 && <span style={{ color: "var(--muted)" }}>× {o.qty}</span>} —{" "}
                      {formatPrice(o.total_price ?? o.price, o.currency)}
                    </div>
                    {cartLines && cartLines.length > 1 && (
                      <div className="order-meta" style={{ marginTop: 2 }}>
                        {cartLines.map((l) => `${l.name} ×${l.qty}`).join(" · ")}
                      </div>
                    )}
                    <div className="order-meta">
                      {o.buyer_contact ? `Roblox: ${o.buyer_contact}` : "No Roblox username"}
                      {" · "}
                      {o.telegram_username
                        ? `Telegram: @${o.telegram_username} (logged in ✓)`
                        : o.telegram_contact
                        ? `Telegram: ${o.telegram_contact}`
                        : "No Telegram"}
                      {" · "}
                      {new Date(o.created_at).toLocaleString()}
                    </div>
                  </div>
                  {o.status === "pending" ? (
                    <div className="order-actions">
                      <button className="confirm" onClick={() => updateOrderStatus(o, "confirmed")}>Confirm</button>
                      <button className="reject" onClick={() => updateOrderStatus(o, "rejected")}>Reject</button>
                    </div>
                  ) : o.status === "confirmed" ? (
                    <div className="order-actions">
                      <button className="confirm" onClick={() => updateOrderStatus(o, "delivered")}>Mark sent</button>
                      <span className="status-badge status-confirmed">confirmed</span>
                    </div>
                  ) : (
                    <span className={`status-badge status-${o.status}`}>{o.status}</span>
                  )}
                </div>
              );
            })
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
            <div className="dash-item-list">
              {items.map((it, index) => {
                const meta = gameMeta(it.game);
                return (
                  <div key={it.id} className="dash-item-row" style={{ "--card-accent": meta.accent }}>
                    <div className="move-col">
                      <button type="button" className="move-btn" title="Move earlier" onClick={() => moveItem(index, -1)} disabled={index === 0}>▲</button>
                      <button type="button" className="move-btn" title="Move later" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}>▼</button>
                    </div>
                    <div className={`dash-item-thumb ${it.sold ? "sold" : ""}`}>
                      {it.image ? (
                        <img src={it.image} alt={it.name} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 10 }}>no photo</div>
                      )}
                      {it.sold && <span className="sold-badge-sm">SOLD</span>}
                    </div>
                    <div className="dash-item-body">
                      <div className="dash-item-top">
                        <span className="item-row-name">{it.name}</span>
                        <span className="game-tag-inline" style={{ color: meta.accent }}>{it.game_label}</span>
                      </div>
                      <div className="dash-item-mid">
                        <span className="price-ticket">
                          {it.pricing_mode === "unit" && it.unit_amount
                            ? `${Number(it.unit_amount).toLocaleString()} ${it.unit_label} = ${formatPrice(it.price, it.currency)}`
                            : formatPrice(it.price, it.currency)}
                        </span>
                        {it.stock !== null && it.stock !== undefined && (
                          <span className="item-row-stock">
                            {it.stock > 0
                              ? `${Number(it.stock).toLocaleString()} ${it.pricing_mode === "unit" ? it.unit_label : "left"}`
                              : "Out of stock"}
                          </span>
                        )}
                      </div>
                      <div className="action-row">
                        <button className="btn-secondary" onClick={() => openEditForm(it)}>Edit</button>
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
      </div>

      {showForm && (
        <div className="overlay" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowForm(false); resetForm(); }}>✕</button>
            <form className="form-grid" onSubmit={handleSaveItem}>
              <div className="vault-sub" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, color: "var(--text)" }}>
                {editingId ? "Edit listing" : "List a new item"}
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

              <div className="field">
                <label>How is this priced?</label>
                <div className="row-2">
                  <button
                    type="button"
                    className={`filter-chip ${form.pricingMode === "fixed" ? "active" : ""}`}
                    style={form.pricingMode === "fixed" ? { background: "#7cc3e8" } : {}}
                    onClick={() => setForm((f) => ({ ...f, pricingMode: "fixed" }))}
                  >
                    One fixed price
                  </button>
                  <button
                    type="button"
                    className={`filter-chip ${form.pricingMode === "unit" ? "active" : ""}`}
                    style={form.pricingMode === "unit" ? { background: "#7cc3e8" } : {}}
                    onClick={() => setForm((f) => ({ ...f, pricingMode: "unit" }))}
                  >
                    Per unit (bulk / top-up)
                  </button>
                </div>
              </div>

              {form.pricingMode === "unit" && (
                <div className="row-2">
                  <div className="field">
                    <label>Unit name</label>
                    <input type="text" placeholder="e.g. Sheckles, Coins" value={form.unitLabel}
                      onChange={(e) => setForm((f) => ({ ...f, unitLabel: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label>Units per pack</label>
                    <input type="number" min="1" step="1" placeholder="e.g. 100" value={form.unitAmount}
                      onChange={(e) => setForm((f) => ({ ...f, unitAmount: e.target.value }))} required />
                  </div>
                </div>
              )}

              <div className="row-2">
                <div className="field">
                  <label>{form.pricingMode === "unit" ? "Price per pack" : "Price"}</label>
                  <input type="number" step="0.0001" min="0" placeholder="0.00" value={form.price}
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

              {form.pricingMode === "unit" && form.unitLabel && form.unitAmount && form.price && (
                <div className="qty-total" style={{ marginTop: -8 }}>
                  Buyers will see: <b>{Number(form.unitAmount).toLocaleString()} {form.unitLabel} = {formatPrice(form.price, form.currency)}</b>
                </div>
              )}

              <div className="field">
                <label>Stock {form.pricingMode === "unit" ? `(total ${form.unitLabel || "units"} you have)` : "(how many copies you have)"} — optional</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Leave blank for unlimited / not tracked"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                />
              </div>

              <div className="field">
                <label>Minimum purchase {form.pricingMode === "unit" ? "(fewest packs a buyer must buy)" : "(fewest copies a buyer must buy)"} — optional</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Leave blank for no minimum (1)"
                  value={form.minQty}
                  onChange={(e) => setForm((f) => ({ ...f, minQty: e.target.value }))}
                />
              </div>

              <div className="field">
                <label>Bulk pricing (optional) — cheaper rate once buyer hits a quantity</label>
                {form.tiers.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                    {form.tiers.map((t, i) => (
                      <div key={i} className="row-2" style={{ alignItems: "center" }}>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Buy at least e.g. 1000"
                          value={t.minQty}
                          onChange={(e) => updateTierRow(i, "minQty", e.target.value)}
                        />
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            placeholder="New price per 1, e.g. 0.0065"
                            value={t.pricePerUnit}
                            onChange={(e) => updateTierRow(i, "pricePerUnit", e.target.value)}
                          />
                          <button type="button" className="btn-danger" style={{ flex: "0 0 auto", padding: "10px 12px" }} onClick={() => removeTierRow(i)}>
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className="add-item-btn" onClick={addTierRow}>+ Add price tier</button>
                {form.tiers.some((t) => t.minQty !== "" && t.pricePerUnit !== "") && (
                  <div className="qty-total" style={{ marginTop: 8 }}>
                    Example: buying {form.tiers[form.tiers.length - 1]?.minQty || "?"} would total{" "}
                    <b>
                      {formatPrice(
                        (Number(form.tiers[form.tiers.length - 1]?.pricePerUnit) || 0) *
                          (Number(form.tiers[form.tiers.length - 1]?.minQty) || 0),
                        form.currency
                      )}
                    </b>
                  </div>
                )}
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
                {saving ? "Saving…" : editingId ? "Save changes" : "Add to vault"}
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.isError ? "error" : ""}`}>{toast.msg}</div>}
    </div>
  );
}
