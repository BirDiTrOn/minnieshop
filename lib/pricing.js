// Shared between the storefront (client) and the orders API (server) so
// the displayed total and the charged total always agree.

export function sanitizeTiers(tiers) {
  if (!Array.isArray(tiers)) return [];
  return tiers
    .map((t) => ({
      minQty: Math.max(1, Math.floor(Number(t.minQty) || 0)),
      pricePerUnit: Number(t.pricePerUnit),
    }))
    .filter((t) => t.minQty > 0 && t.pricePerUnit >= 0 && !Number.isNaN(t.pricePerUnit))
    .sort((a, b) => a.minQty - b.minQty);
}

// Returns the price-per-pack that applies once `qty` packs are being bought.
export function effectiveUnitPrice(item, qty) {
  const basePrice = Number(item.price);
  const tiers = sanitizeTiers(item.tiers);
  let best = basePrice;
  for (const t of tiers) {
    if (qty >= t.minQty) best = t.pricePerUnit;
  }
  return best;
}

export function computeTotal(item, qty) {
  const unitPrice = effectiveUnitPrice(item, qty);
  return Math.round(unitPrice * qty * 10000) / 10000;
}

// Lowest price-per-pack this item can reach at any quantity — used to show
// "as low as" on the storefront when bulk tiers exist.
export function bestUnitPrice(item) {
  const tiers = sanitizeTiers(item.tiers);
  if (tiers.length === 0) return Number(item.price);
  return Math.min(Number(item.price), ...tiers.map((t) => t.pricePerUnit));
}
