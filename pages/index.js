import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { computeTotal } from "../lib/pricing";

const GAME_PRESETS = [
  { id: "grow-a-garden", label: "Grow a Garden 2", accent: "#8fd6c1", glow: "rgba(143,214,193,0.25)" },
  { id: "blade-ball", label: "Blade Ball", accent: "#f0899f", glow: "rgba(240,137,159,0.2)" },
  { id: "other", label: "Other game", accent: "#93b7f0", glow: "rgba(147,183,240,0.2)" },
];

function gameMeta(gameId) {
  return GAME_PRESETS.find((g) => g.id === gameId) || GAME_PRESETS[2];
}

const KHR_RATE = 4000; // fixed rate: 1 USD = 4000 KHR

function formatPrice(price, currency) {
  const n = Number(price);
  if (currency === "KHR") return `៛${n.toLocaleString()}`;
  if (n > 0 && n < 0.01) return `$${n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
  return `$${n.toFixed(2)}`;
}

function equivalentPrice(price, currency) {
  const n = Number(price);
  if (currency === "KHR") {
    const usd = n / KHR_RATE;
    return usd > 0 && usd < 0.01 ? `$${usd.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}` : `$${usd.toFixed(2)}`;
  }
  const khrRaw = n * KHR_RATE;
  const khr = khrRaw < 100 ? Math.round(khrRaw) : Math.round(khrRaw / 100) * 100;
  return `៛${khr.toLocaleString()}`;
}

function PriceWithEquivalent({ price, currency }) {
  return (
    <>
      {formatPrice(price, currency)} <span className="price-khr">({equivalentPrice(price, currency)})</span>
    </>
  );
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

function minPacks(item) {
  return Math.max(1, Math.floor(Number(item?.min_qty) || 1));
}

function maxPacks(item) {
  if (!item || !hasStockTracking(item)) return null;
  if (isUnitItem(item)) return Math.max(1, Math.floor(Number(item.stock) / Number(item.unit_amount)));
  return Math.max(1, Math.floor(Number(item.stock)));
}

function stockLabel(item) {
  if (!hasStockTracking(item)) return null;
  if (isOutOfStock(item)) return "Out of stock";
  const n = Number(item.stock);
  return isUnitItem(item) ? `${n.toLocaleString()} ${item.unit_label} left` : `${n.toLocaleString()} left`;
}

function fileToCompressedDataUrl(file, maxDim = 900, quality = 0.8) {
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

function readLocal(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export default function Storefront() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [selected, setSelected] = useState(null);
  const [viewQty, setViewQty] = useState("1");
  const [qtyDrafts, setQtyDrafts] = useState({});

  const [buyerContact, setBuyerContact] = useState("");
  const [telegramContact, setTelegramContact] = useState("");
  const [paymentProof, setPaymentProof] = useState(null);
  const [proofError, setProofError] = useState("");
  const [checkoutState, setCheckoutState] = useState("idle"); // idle | sending | sent | error
  const [checkoutError, setCheckoutError] = useState("");

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .finally(() => setLoading(false));
  }, []);

  // Load anything saved from a previous visit.
  useEffect(() => {
    setCart(readLocal("minnieshop_cart", []));
    setBuyerContact(readLocal("minnieshop_roblox", ""));
    setTelegramContact(readLocal("minnieshop_telegram", ""));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("minnieshop_cart", JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("minnieshop_roblox", JSON.stringify(buyerContact));
  }, [buyerContact, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("minnieshop_telegram", JSON.stringify(telegramContact));
  }, [telegramContact, hydrated]);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  function clamp(item, qty) {
    const floor = minPacks(item);
    const cap = maxPacks(item);
    let v = Math.max(floor, Math.floor(qty || floor));
    if (cap) v = Math.min(v, cap);
    return v;
  }

  function addToCart(item, qty) {
    if (isUnavailable(item)) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        return prev.map((l) => (l.itemId === item.id ? { ...l, qty: clamp(item, l.qty + qty) } : l));
      }
      return [...prev, { itemId: item.id, qty: clamp(item, qty) }];
    });
    showToast(`Added ${item.name} to cart`);
  }

  function setCartQty(item, qty) {
    setCart((prev) => prev.map((l) => (l.itemId === item.id ? { ...l, qty: clamp(item, qty) } : l)));
  }

  function removeCartLine(itemId) {
    setCart((prev) => prev.filter((l) => l.itemId !== itemId));
  }

  function openItem(item) {
    setSelected(item);
    setViewQty(String(minPacks(item)));
  }

  function openAddFromRow(e, item) {
    e.stopPropagation();
    openItem(item);
  }

  const cartLines = cart
    .map((l) => ({ ...l, item: items.find((i) => i.id === l.itemId) }))
    .filter((l) => l.item);
  const cartCount = cartLines.length;
  const cartTotal = cartLines.reduce((sum, l) => sum + computeTotal(l.item, l.qty), 0);
  const cartCurrency = cartLines[0]?.item.currency || "USD";

  async function submitCheckout() {
    if (cartLines.length === 0) return;
    if (!buyerContact.trim() || !telegramContact.trim() || !paymentProof) return;
    setCheckoutState("sending");
    setCheckoutError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartItems: cart.map((l) => ({ itemId: l.itemId, qty: l.qty })),
          buyerContact,
          telegramContact,
          paymentProof,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || "Something went wrong.");
        setCheckoutState("error");
        return;
      }
      setCheckoutState("sent");
      setCart([]);
      setPaymentProof(null);
    } catch (e) {
      setCheckoutError("Something went wrong — try again.");
      setCheckoutState("error");
    }
  }

  async function handleProofChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProofError("That's not an image file.");
      return;
    }
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setPaymentProof(dataUrl);
      setProofError("");
    } catch (err) {
      setProofError("Couldn't load that image — try again.");
    }
  }

  function closeCart() {
    setCartOpen(false);
    if (checkoutState === "sent") setCheckoutState("idle");
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="stat-pill"><b>{activeCount}</b> available</div>
          <button className="cart-btn" onClick={() => setCartOpen(true)}>
            🛒 Cart
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
      </header>

      <div className="contact-row">
        <a className="link-btn" href="https://t.me/Lisaa_lisaz" target="_blank" rel="noreferrer">💬 @Lisaa_lisaz</a>
        <a className="link-btn" href="https://t.me/minnieshoppie" target="_blank" rel="noreferrer">👥 Join our Telegram group</a>
      </div>

      <div className="toolbar">
        <div className="filters">
          <button className={`filter-chip ${filter === "all" ? "active" : ""}`} style={filter === "all" ? { background: "linear-gradient(135deg, var(--accent), var(--accent-2))" } : {}} onClick={() => setFilter("all")}>
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
                {!isUnavailable(it) && (
                  <button className="quick-add-btn" onClick={(e) => openAddFromRow(e, it)}>+ Add</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Item detail modal */}
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
                  {isUnitItem(selected) ? (
                    <>
                      {unitRateLabel(selected)} <span className="price-khr">({equivalentPrice(selected.price, selected.currency)})</span>
                    </>
                  ) : (
                    <PriceWithEquivalent price={selected.price} currency={selected.currency} />
                  )}
                </span>
              </div>

              {selected.description && <div className="checkout-desc">{selected.description}</div>}

              {isUnavailable(selected) ? (
                <div className="pay-panel">
                  <div className="pay-label" style={{ color: "var(--muted)" }}>
                    {isOutOfStock(selected) && !selected.sold ? "Out of stock" : "Already sold"}
                  </div>
                </div>
              ) : (
                <div className="pay-panel">
                  <div className="qty-picker" style={{ borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
                    <span className="qty-picker-label">{isUnitItem(selected) ? "How many packs?" : "How many?"}</span>
                    <div className="qty-stepper">
                      <button type="button" onClick={() => setViewQty((q) => String(clamp(selected, Number(q || 0) - 1)))}>−</button>
                      <input
                        type="number"
                        min={minPacks(selected)}
                        max={maxPacks(selected) || undefined}
                        value={viewQty}
                        onChange={(e) => setViewQty(e.target.value)}
                        onBlur={(e) => setViewQty(String(clamp(selected, Math.floor(Number(e.target.value) || minPacks(selected)))))}
                      />
                      <button type="button" onClick={() => setViewQty((q) => String(clamp(selected, Number(q || 0) + 1)))}>+</button>
                    </div>
                    {minPacks(selected) > 1 && (
                      <div className="qty-picker-label">Minimum purchase: {minPacks(selected)}{isUnitItem(selected) ? " packs" : ""}</div>
                    )}
                    {isUnitItem(selected) ? (
                      <div className="qty-total">
                        = {((Number(viewQty) || 0) * selected.unit_amount).toLocaleString()} {selected.unit_label} for{" "}
                        <b><PriceWithEquivalent price={computeTotal(selected, Number(viewQty) || 0)} currency={selected.currency} /></b>
                      </div>
                    ) : (
                      <div className="qty-total">Total: <b><PriceWithEquivalent price={computeTotal(selected, Number(viewQty) || 0)} currency={selected.currency} /></b></div>
                    )}
                    {Array.isArray(selected.tiers) && selected.tiers.length > 0 && (
                      <div className="tier-hint">
                        {selected.tiers.map((t) => (
                          <div key={t.minQty}>Buy {t.minQty}+ → {formatPrice(t.pricePerUnit, selected.currency)} each</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      addToCart(selected, clamp(selected, Math.floor(Number(viewQty) || minPacks(selected))));
                      setSelected(null);
                    }}
                  >
                    Add to cart 🛒
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cart modal */}
      {cartOpen && (
        <div className="overlay" onClick={closeCart}>
          <div className="modal cart-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeCart}>✕</button>

            <div className="checkout-body" style={{ paddingBottom: 0 }}>
              <div className="checkout-name">Your cart</div>
            </div>

            {checkoutState === "sent" ? (
              <div className="checkout-body">
                <div className="pay-panel">
                  <div className="pay-label" style={{ color: "#2f8a6f" }}>Seller notified 🎉</div>
                  <div className="pay-hint">They'll confirm your payment and reach out to set up the in-game trade.</div>
                </div>
              </div>
            ) : cartLines.length === 0 ? (
              <div className="checkout-body">
                <div className="empty-state">Your cart is empty. Add some items first!</div>
              </div>
            ) : (
              <>
                <div className="cart-list">
                  {cartLines.map((l) => (
                    <div className="cart-line" key={l.itemId}>
                      <div className="cart-line-thumb">
                        {l.item.image ? <img src={l.item.image} alt={l.item.name} /> : null}
                      </div>
                      <div className="cart-line-body">
                        <div className="cart-line-name">{l.item.name}</div>
                        <div className="cart-line-price">
                          <PriceWithEquivalent price={computeTotal(l.item, l.qty)} currency={l.item.currency} />
                          {isUnitItem(l.item) && ` · ${(l.qty * l.item.unit_amount).toLocaleString()} ${l.item.unit_label}`}
                        </div>
                      </div>
                      <div className="cart-line-stepper">
                        <button onClick={() => setCartQty(l.item, l.qty - 1)}>−</button>
                        <input
                          type="number"
                          min={minPacks(l.item)}
                          max={maxPacks(l.item) || undefined}
                          value={qtyDrafts[l.itemId] !== undefined ? qtyDrafts[l.itemId] : String(l.qty)}
                          onChange={(e) => setQtyDrafts((prev) => ({ ...prev, [l.itemId]: e.target.value }))}
                          onBlur={(e) => {
                            setCartQty(l.item, Math.floor(Number(e.target.value) || minPacks(l.item)));
                            setQtyDrafts((prev) => {
                              const next = { ...prev };
                              delete next[l.itemId];
                              return next;
                            });
                          }}
                        />
                        <button onClick={() => setCartQty(l.item, l.qty + 1)}>+</button>
                      </div>
                      <button className="cart-line-remove" onClick={() => removeCartLine(l.itemId)} title="Remove">✕</button>
                    </div>
                  ))}
                </div>

                <div className="cart-total-row">
                  <span>Total</span>
                  <b><PriceWithEquivalent price={cartTotal} currency={cartCurrency} /></b>
                </div>

                <div className="checkout-body" style={{ paddingTop: 0 }}>
                  <div className="field">
                    <label>Your Roblox username (required)</label>
                    <input
                      type="text"
                      placeholder="e.g. yourRobloxName"
                      value={buyerContact}
                      onChange={(e) => setBuyerContact(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Your Telegram username (required)</label>
                    <input
                      type="text"
                      placeholder="e.g. @yourhandle"
                      value={telegramContact}
                      onChange={(e) => setTelegramContact(e.target.value)}
                    />
                  </div>

                  <div className="pay-panel">
                    <div className="pay-label">💗 Scan to pay</div>
                    <div className="qr-wrap">
                      <img src="/qr.jpg" alt="Payment QR code" />
                    </div>
                    <div className="pay-hint">
                      Scan with your banking app to pay <PriceWithEquivalent price={cartTotal} currency={cartCurrency} /> total. Once you've paid,
                      tap notify below — I'll confirm and set up the in-game trade.
                    </div>
                  </div>

                  <div className="field">
                    <label>Upload proof of payment (required)</label>
                    {paymentProof && <img className="img-preview" src={paymentProof} alt="Payment proof preview" />}
                    <label className="img-drop">
                      {paymentProof ? "Change screenshot" : "Click to upload a screenshot of your payment"}
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleProofChange} />
                    </label>
                    {proofError && <div className="error-text">{proofError}</div>}
                  </div>

                  <button
                    className="btn"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={submitCheckout}
                    disabled={checkoutState === "sending" || !buyerContact.trim() || !telegramContact.trim() || !paymentProof}
                  >
                    {checkoutState === "sending" ? "Sending…" : "I've paid — notify seller"}
                  </button>
                  {checkoutState === "error" && <div className="error-text">{checkoutError}</div>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.isError ? "error" : ""}`}>{toast.msg}</div>}
    </div>
  );
}
