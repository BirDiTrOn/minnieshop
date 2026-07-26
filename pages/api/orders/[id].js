import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isAdminRequest } from "../../../lib/adminAuth";

export default async function handler(req, res) {
  if (!isAdminRequest(req)) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.query;

  if (req.method === "PATCH") {
    const { status } = req.body || {};
    if (!["pending", "confirmed", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    if (status === "confirmed" && data.item_id) {
      const { data: item } = await supabaseAdmin
        .from("items")
        .select("*")
        .eq("id", data.item_id)
        .single();

      if (item && item.stock !== null && item.stock !== undefined) {
        const unitsBought = item.pricing_mode === "unit" ? data.qty * item.unit_amount : data.qty;
        const newStock = Math.max(0, Number(item.stock) - unitsBought);
        await supabaseAdmin
          .from("items")
          .update({ stock: newStock, sold: newStock <= 0 })
          .eq("id", data.item_id);
      } else {
        // No stock tracking on this item — fall back to the old behavior.
        await supabaseAdmin.from("items").update({ sold: true }).eq("id", data.item_id);
      }
    }

    return res.status(200).json({ order: data });
  }

  res.setHeader("Allow", ["PATCH"]);
  return res.status(405).end("Method not allowed");
}
