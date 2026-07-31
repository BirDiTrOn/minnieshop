import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isAdminRequest } from "../../../lib/adminAuth";
import { sendTelegramMessage } from "../../../lib/telegram";
import { computeTotal, effectiveUnitPrice } from "../../../lib/pricing";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const {
      cartItems,
      buyerContact,
      telegramContact,
      telegramUserId,
      telegramUsername,
      telegramFirstName,
    } = req.body || {};

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: "Your cart is empty" });
    }
    if (!buyerContact || !buyerContact.trim()) {
      return res.status(400).json({ error: "buyerContact (Roblox username) is required" });
    }
    if (!telegramUserId && (!telegramContact || !telegramContact.trim())) {
      return res.status(400).json({ error: "A Telegram login or username is required" });
    }

    const ids = cartItems.map((c) => c.itemId).filter(Boolean);
    const { data: dbItems, error: itemErr } = await supabaseAdmin.from("items").select("*").in("id", ids);
    if (itemErr) return res.status(500).json({ error: itemErr.message });

    const lines = [];
    let total = 0;
    let currency = "USD";

    for (const cartLine of cartItems) {
      const item = dbItems.find((i) => i.id === cartLine.itemId);
      if (!item) return res.status(404).json({ error: "One of the items in your cart no longer exists" });

      const isUnitPricing = item.pricing_mode === "unit";
      const minQty = Math.max(1, Math.floor(Number(item.min_qty) || 1));
      const qty = Math.max(minQty, Math.floor(Number(cartLine.qty) || minQty));

      if (item.stock !== null && item.stock !== undefined) {
        const unitsRequested = isUnitPricing ? qty * item.unit_amount : qty;
        if (unitsRequested > Number(item.stock)) {
          return res.status(400).json({ error: `Not enough stock left for "${item.name}"` });
        }
      }

      const lineTotal = computeTotal(item, qty);
      total = Math.round((total + lineTotal) * 10000) / 10000;
      currency = item.currency || currency;

      lines.push({
        item_id: item.id,
        name: item.name,
        game_label: item.game_label,
        pricing_mode: item.pricing_mode,
        unit_label: item.unit_label,
        unit_amount: item.unit_amount,
        price: item.price,
        unit_price_applied: effectiveUnitPrice(item, qty),
        currency: item.currency,
        qty,
        line_total: lineTotal,
      });
    }

    const summaryName = lines.length === 1 ? lines[0].name : `${lines.length} items`;
    const totalQty = lines.reduce((sum, l) => sum + l.qty, 0);

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        item_name: summaryName,
        currency,
        qty: totalQty,
        total_price: total,
        items: lines,
        buyer_contact: buyerContact || null,
        telegram_contact: telegramContact || null,
        telegram_user_id: telegramUserId ? String(telegramUserId) : null,
        telegram_username: telegramUsername || null,
        telegram_first_name: telegramFirstName || null,
        status: "pending",
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    const currencySign = currency === "KHR" ? "៛" : "$";
    const itemLines = lines
      .map((l) => `• ${l.name} × ${l.qty} — ${currencySign}${l.line_total}`)
      .join("\n");
    const telegramLine = telegramUsername
      ? `Telegram: @${telegramUsername} (logged in)`
      : `Telegram: ${telegramContact || "not provided"}`;
    const text =
      `New payment claim\n\n` +
      `${itemLines}\n\n` +
      `Total: ${currencySign}${total}\n` +
      `Roblox username: ${buyerContact || "not provided"}\n` +
      `${telegramLine}\n\n` +
      `Open your admin dashboard to confirm the trade.`;

    try {
      await sendTelegramMessage(text);
    } catch (e) {
      console.error("Telegram notify failed:", e.message);
    }

    return res.status(201).json({ order });
  }

  if (req.method === "GET") {
    if (!isAdminRequest(req)) return res.status(401).json({ error: "Unauthorized" });
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ orders: data });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end("Method not allowed");
}
