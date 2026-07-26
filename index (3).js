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
      await supabaseAdmin.from("items").update({ sold: true }).eq("id", data.item_id);
    }

    return res.status(200).json({ order: data });
  }

  res.setHeader("Allow", ["PATCH"]);
  return res.status(405).end("Method not allowed");
}
