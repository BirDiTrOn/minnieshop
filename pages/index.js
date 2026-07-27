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
  if (n > 0 && n < 0.01) return `$${n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
  return `$${n.toFixed(2)}`;
}

function isUnitItem(item) {
  return item.pricing_mode === "unit" && item.unit_amount;
}

function unitRateLabel(item) {
  return `${Number(item.unit_amount).toLocaleString()} ${item.unit_label} = ${formatPrice(item.price, item.currency)}`;
}

function hasStockTracking(item) {
  return item.stock !== null && item.stock !== undefined;
}

function isOutOfStock(item) {
  return hasStockTracking(item) && Number(item.stock) <= 0;
}

function isUnavailable(item) {
  return item.sold || isOutOfStock(item);
}

function showQtyPicker() {
  return true;
}

function maxPacks(item) {
  if (!hasStockTracking(item)) return null;
  if (isUnitItem(item)) return Math.max(1, Math.floor(Number(item.stock) / Number(item.unit_amount)));
  return Math.max(1, Math.floor(Number(item.stock)));
}

function minPacks(item) {
  const n = Math.max(1, Math.floor(Number(item.min_qty) || 1));
  return n;
}

function stockLabel(item) {
  if (!hasStockTracking(item)) return null;
  if (isOutOfStock(item)) return "Out of stock";
  const n = Number(item.stock);
  return isUnitItem(item) ? `${n.toLocaleString()} ${item.unit_label} left` : `${n.toLocaleString()} left`;
}

export default function Storefront() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [buyerContact, setBuyerContact] = useState("");
  const [telegramContact, setTelegramContact] = useState("");
  const [packs, setPacks] = useState(1);
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
    setTelegramContact("");
    setPacks(minPacks(item));
    setClaimState("idle");
  }

  async function submitClaim() {
    if (!selected || !buyerContact.trim() || !telegramContact.trim()) return;
    setClaimState("sending");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selected.id, buyerContact, telegramContact, qty: packs }),
      });
      if (!res.ok) throw new Error("failed");
      setClaimState("sent");
    } catch (e) {
      setClaimState("error");
    }
  }

  const filtered = items.filter((it) => filter === "all" || it.game === filter);
  const activeCount = items.filter((it) => !isUnavailable(it)).length;

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

      <div className="contact-row">
        <a className="link-btn" href="https://t.me/Lisaa_lisaz" target="_blank" rel="noreferrer">💬 @Lisaa_lisaz</a>
        <a className="link-btn" href="https://t.me/nannsiv" target="_blank" rel="noreferrer">💬 @nannsiv</a>
        <a className="link-btn" href="https://t.me/minnieshoppie" target="_blank" rel="noreferrer">👥 Join our Telegram group</a>
      </div>

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
        <div className="item-row-list">
          {filtered.map((it) => {
            const meta = gameMeta(it.game);
            return (
              <div key={it.id} className="item-row" style={{ "--card-accent": meta.accent }} onClick={() => openItem(it)}>
                <div className={`item-row-thumb ${isUnavailable(it) ? "sold" : ""}`}>
                  {it.image ? (
                    <img src={it.image} alt={it.name} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 10 }}>
                      no photo
                    </div>
                  )}
                  {isUnavailable(it) && (
                    <span className="sold-badge-sm">{isOutOfStock(it) && !it.sold ? "OUT" : "SOLD"}</span>
                  )}
                </div>
                <div className="item-row-body">
                  <div className="item-row-top">
                    <span className="item-row-name">{it.name}</span>
                    <span className="game-tag-inline" style={{ color: meta.accent }}>{it.game_label}</span>
                  </div>
                  <div className="item-row-bottom">
                    <span className="price-ticket">
                      {isUnitItem(it) ? unitRateLabel(it) : formatPrice(it.price, it.currency)}
                    </span>
                    {stockLabel(it) && !it.sold && (
                      <span className="item-row-stock">{stockLabel(it)}</span>
                    )}
                  </div>
                </div>
                <span className="item-row-arrow">›</span>
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
                <span className="price-ticket">
                  {isUnitItem(selected) ? unitRateLabel(selected) : formatPrice(selected.price, selected.currency)}
                </span>
              </div>

              {selected.description && <div className="checkout-desc">{selected.description}</div>}

              {isUnavailable(selected) ? (
                <div className="pay-panel">
                  <div className="pay-label" style={{ color: "var(--muted)" }}>
                    {isOutOfStock(selected) && !selected.sold ? "Out of stock" : "Already sold"}
                  </div>
                </div>
              ) : claimState === "sent" ? (
                <div className="pay-panel">
                  <div className="pay-label" style={{ color: "var(--accent)" }}>Seller notified</div>
                  <div className="pay-hint">They'll reach out to confirm and hand over the item in-game. Hang tight.</div>
                </div>
              ) : (
                <div className="pay-panel">
                  {showQtyPicker(selected) && (
                    <div className="qty-picker">
                      <span className="qty-picker-label">{isUnitItem(selected) ? "How many packs?" : "How many?"}</span>
                      <div className="qty-stepper">
                        <button type="button" onClick={() => setPacks((p) => Math.max(minPacks(selected), p - 1))}>−</button>
                        <input
                          type="number"
                          min={minPacks(selected)}
                          max={maxPacks(selected) || undefined}
                          value={packs}
                          onChange={(e) => {
                            const cap = maxPacks(selected);
                            const floor = minPacks(selected);
                            let v = Math.max(floor, Math.floor(Number(e.target.value) || floor));
                            if (cap) v = Math.min(v, cap);
                            setPacks(v);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cap = maxPacks(selected);
                            setPacks((p) => (cap ? Math.min(p + 1, cap) : p + 1));
                          }}
                        >
                          +
                        </button>
                      </div>
                      {minPacks(selected) > 1 && (
                        <div className="qty-picker-label" style={{ marginTop: -2 }}>
                          Minimum purchase: {minPacks(selected)}{isUnitItem(selected) ? " packs" : ""}
                        </div>
                      )}
                      {isUnitItem(selected) ? (
                        <div className="qty-total">
                          = {(packs * selected.unit_amount).toLocaleString()} {selected.unit_label} for{" "}
                          <b>{formatPrice(packs * selected.price, selected.currency)}</b>
                        </div>
                      ) : (
                        <div className="qty-total">
                          Total: <b>{formatPrice(packs * selected.price, selected.currency)}</b>
                        </div>
                      )}
                      {stockLabel(selected) && (
                        <div className="qty-picker-label" style={{ marginTop: -2 }}>{stockLabel(selected)}</div>
                      )}
                    </div>
                  )}
                  <div className="pay-label">💗 Scan to pay</div>
                  <div className="qr-wrap">
                    <img src="/qr.jpg" alt="Payment QR code" />
                  </div>
                  <div className="pay-hint">
                    Scan with your banking app to pay {formatPrice(packs * selected.price, selected.currency)}.
                    Once you've paid, add your contact below and tap notify — I'll confirm and set up the in-game trade.
                  </div>
                  <div className="field" style={{ width: "100%" }}>
                    <label>Your Roblox username (required)</label>
                    <input
                      type="text"
                      placeholder="e.g. yourRobloxName"
                      value={buyerContact}
                      onChange={(e) => setBuyerContact(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field" style={{ width: "100%" }}>
                    <label>Your Telegram username (required)</label>
                    <input
                      type="text"
                      placeholder="e.g. @yourhandle"
                      value={telegramContact}
                      onChange={(e) => setTelegramContact(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    className="btn"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={submitClaim}
                    disabled={claimState === "sending" || !buyerContact.trim() || !telegramContact.trim()}
                  >
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
