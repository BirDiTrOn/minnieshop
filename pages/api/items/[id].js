import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isAdminRequest } from "../../../lib/adminAuth";

export default async function handler(req, res) {
  if (!isAdminRequest(req)) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.query;

  if (req.method === "PUT") {
    const allowed = ["name", "game", "game_label", "price", "currency", "description", "image", "sold"];
    const updates = {};
    for (const key of allowed) {
      if (key in (req.body || {})) updates[key] = req.body[key];
    }
    const { data, error } = await supabaseAdmin
      .from("items")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ item: data });
  }

  if (req.method === "DELETE") {
    const { error } = await supabaseAdmin.from("items").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).end("Method not allowed");
}
