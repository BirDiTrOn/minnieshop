import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isAdminRequest } from "../../../lib/adminAuth";
import { sendTelegramMessage } from "../../../lib/telegram";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { itemId, buyerContact } = req.body || {};
    if (!itemId) return res.status(400).json({ error: "itemId is required" });

    const { data: item, error: itemErr } = await supabaseAdmin
      .from("items")
      .select("*")
      .eq("id", itemId)
      .single();
    if (itemErr || !item) return res.status(404).json({ error: "Item not found" });

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        currency: item.currency,
        buyer_contact: buyerContact || null,
        status: "pending",
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    const priceLabel = item.currency === "KHR" ? `៛${item.price}` : `$${item.price}`;
    const text =
      `New payment claim\n\n` +
      `Item: ${item.name}\n` +
      `Game: ${item.game_label}\n` +
      `Price: ${priceLabel}\n` +
      `Buyer contact: ${buyerContact || "not provided"}\n\n` +
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
