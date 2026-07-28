import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isAdminRequest } from "../../../lib/adminAuth";
import { sendTelegramMessageTo } from "../../../lib/telegram";

export default async function handler(req, res) {
  if (!isAdminRequest(req)) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.query;

  if (req.method === "PATCH") {
    const { status } = req.body || {};
    if (!["pending", "confirmed", "rejected", "delivered"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    if (status === "confirmed") {
      const lines = Array.isArray(data.items) && data.items.length ? data.items : (
        data.item_id ? [{ item_id: data.item_id, qty: data.qty || 1 }] : []
      );

      for (const line of lines) {
        const { data: item } = await supabaseAdmin.from("items").select("*").eq("id", line.item_id).single();
        if (!item) continue;

        if (item.stock !== null && item.stock !== undefined) {
          const unitsBought = item.pricing_mode === "unit" ? line.qty * item.unit_amount : line.qty;
          const newStock = Math.max(0, Number(item.stock) - unitsBought);
          await supabaseAdmin.from("items").update({ stock: newStock, sold: newStock <= 0 }).eq("id", item.id);
        } else {
          await supabaseAdmin.from("items").update({ sold: true }).eq("id", item.id);
        }
      }
    }

    let notified = false;
    let notifyError = null;
    if (status === "delivered") {
      if (data.telegram_user_id) {
        try {
          await sendTelegramMessageTo(
            data.telegram_user_id,
            `Your order has been sent! 🎁\n\n${data.item_name} — check your Roblox inventory. Thanks for shopping with us!`
          );
          notified = true;
        } catch (e) {
          notifyError = e.message;
        }
      } else {
        notifyError = "This buyer didn't log in with Telegram, so they can't be auto-notified. Message them directly.";
      }
    }

    return res.status(200).json({ order: data, notified, notifyError });
  }

  res.setHeader("Allow", ["PATCH"]);
  return res.status(405).end("Method not allowed");
}
