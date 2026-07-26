import { useEffect, useState } from "react";
import Head from "next/head";

const GAME_PRESETS = [
  { id: "grow-a-garden", label: "Grow a Garden 2", accent: "#5fb894", glow: "rgba(143,214,193,0.25)" },
  { id: "blade-ball", label: "Blade Ball", accent: "#e2708b", glow: "rgba(240,137,159,0.2)" },
  { id: "other", label: "Other game", accent: "#7699e0", glow: "rgba(147,183,240,0.2)" },
];

function gameMeta(gameId) {
  return GAME_PRESETS.find((g) => g.id === gameId) || GAME_PRESETS[2];
}

function formatPrice(price, currency) {
  const n = Number(price);
  if (currency === "KHR") return `៛${n.toLocaleString()}`;
  return `$${n.toFixed(2)}`;
}

export default function Storefront() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [buyerContact, setBuyerContact] = useState("");
  const [claimState, setClaimState] = useState("idle"); // idle | sending | sent | error

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .finally(() => setLoading(false));
  }, []);

  function openItem(item) {
    setSelected(item);
    setBuyerContact("");
    setClaimState("idle");
  }

  async function submitClaim() {
    if (!selected) return;
    setClaimState("sending");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selected.id, buyerContact }),
      });
      if (!res.ok) throw new Error("failed");
      setClaimState("sent");
    } catch (e) {
      setClaimState("error");
    }
  }

  const filtered = items.filter((it) => filter === "all" || it.game === filter);
  const activeCount = items.filter((it) => !it.sold).length;

  return (
    <div className="wrap">
      <Head>
        <title>Minnieshop — Roblox item shop</title>
        <link rel="icon" href="/favicon.png" />
      </Head>
      <header className="vault-header">
        <div className="vault-title-wrap">
          <img className="brand-badge" src="/logo.jpg" alt="Minnieshop" />
          <div>
            <h1 className="vault-title">Minnieshop</h1>
            <div className="vault-sub">Roblox items for sale — Grow a Garden 2, Blade Ball &amp; more 💜</div>
          </div>
        </div>
        <div className="stat-pill"><b>{activeCount}</b> available</div>
      </header>

      <div className="toolbar">
        <div className="filters">
          <button className={`filter-chip ${filter === "all" ? "active" : ""}`} style={filter === "all" ? { background: "#5fce7a" } : {}} onClick={() => setFilter("all")}>
            All items
          </button>
          {GAME_PRESETS.map((g) => (
            <button
              key={g.id}
              className={`filter-chip ${filter === g.id ? "active" : ""}`}
              style={filter === g.id ? { background: g.accent } : {}}
              onClick={() => setFilter(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading listings…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>Nothing listed yet</h3>
          <div>Check back soon — new items get added regularly.</div>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((it) => {
            const meta = gameMeta(it.game);
            return (
              <div key={it.id} className="item-card" style={{ "--card-accent": meta.accent }} onClick={() => openItem(it)}>
                <div className={`item-thumb ${it.sold ? "sold" : ""}`}>
                  {it.sold && <span className="sold-badge">SOLD</span>}
                  <span className="game-tag" style={{ color: meta.accent }}>{it.game_label}</span>
                  <div className="corner-frame">
                    <span className="cf-arm cf-tl" style={{ borderColor: meta.accent }} />
                    <span className="cf-arm cf-tr" style={{ borderColor: meta.accent }} />
                    <span className="cf-arm cf-bl" style={{ borderColor: meta.accent }} />
                    <span className="cf-arm cf-br" style={{ borderColor: meta.accent }} />
                    {it.image ? (
                      <img src={it.image} alt={it.name} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
                        no photo
                      </div>
                    )}
                  </div>
                </div>
                <div className="item-body">
                  <div className="item-name">{it.name}</div>
                  <div className="item-foot">
                    <span className="price-ticket">{formatPrice(it.price, it.currency)}</span>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>›</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            {selected.image && <img className="checkout-img" src={selected.image} alt={selected.name} />}
            <div className="checkout-body">
              <div className="checkout-title-row">
                <div>
                  <div className="checkout-name">{selected.name}</div>
                  <span className="checkout-game" style={{ color: gameMeta(selected.game).accent, background: gameMeta(selected.game).glow }}>
                    {selected.game_label}
                  </span>
                </div>
                <span className="price-ticket">{formatPrice(selected.price, selected.currency)}</span>
              </div>

              {selected.description && <div className="checkout-desc">{selected.description}</div>}

              {selected.sold ? (
                <div className="pay-panel">
                  <div className="pay-label" style={{ color: "var(--muted)" }}>Already sold</div>
                </div>
              ) : claimState === "sent" ? (
                <div className="pay-panel">
                  <div className="pay-label" style={{ color: "var(--accent)" }}>Seller notified</div>
                  <div className="pay-hint">They'll reach out to confirm and hand over the item in-game. Hang tight.</div>
                </div>
              ) : (
                <div className="pay-panel">
                  <div className="pay-label">💗 Scan to pay</div>
                  <div className="qr-wrap">
                    <img src="/qr.jpg" alt="Payment QR code" />
                  </div>
                  <div className="pay-hint">
                    Scan with your banking app to pay {formatPrice(selected.price, selected.currency)}. Once you've
                    paid, add your contact below and tap notify — I'll confirm and set up the in-game trade.
                  </div>
                  <div className="field" style={{ width: "100%" }}>
                    <label>Your Roblox / Telegram username (optional but helps)</label>
                    <input
                      type="text"
                      placeholder="e.g. @yourhandle"
                      value={buyerContact}
                      onChange={(e) => setBuyerContact(e.target.value)}
                    />
                  </div>
                  <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={submitClaim} disabled={claimState === "sending"}>
                    {claimState === "sending" ? "Sending…" : "I've paid — notify seller"}
                  </button>
                  {claimState === "error" && <div className="error-text">Something went wrong — try again in a moment.</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
