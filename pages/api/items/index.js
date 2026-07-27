import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isAdminRequest } from "../../../lib/adminAuth";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("items")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ items: data });
  }

  if (req.method === "POST") {
    if (!isAdminRequest(req)) return res.status(401).json({ error: "Unauthorized" });

    // A reorder request: { reorder: ["id1", "id2", "id3"] } in the new display order.
    if (Array.isArray(req.body?.reorder)) {
      const ids = req.body.reorder;
      const updates = ids.map((id, index) =>
        supabaseAdmin.from("items").update({ position: index + 1 }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed) return res.status(500).json({ error: failed.error.message });
      return res.status(200).json({ ok: true });
    }

    const { name, game, gameLabel, price, currency, description, image, pricingMode, unitLabel, unitAmount, stock, minQty } =
      req.body || {};
    if (!name || !price) return res.status(400).json({ error: "Name and price are required" });
    if (pricingMode === "unit" && (!unitLabel || !unitAmount)) {
      return res.status(400).json({ error: "Unit label and unit amount are required for per-unit pricing" });
    }

    const { data: maxRow } = await supabaseAdmin
      .from("items")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = (maxRow?.position || 0) + 1;

    const { data, error } = await supabaseAdmin
      .from("items")
      .insert({
        name,
        game: game || "other",
        game_label: gameLabel || "Other game",
        price,
        currency: currency || "USD",
        pricing_mode: pricingMode === "unit" ? "unit" : "fixed",
        unit_label: pricingMode === "unit" ? unitLabel : null,
        unit_amount: pricingMode === "unit" ? unitAmount : null,
        min_qty: minQty === "" || minQty === null || minQty === undefined ? 1 : Math.max(1, Math.floor(Number(minQty))),
        stock: stock === "" || stock === null || stock === undefined ? null : stock,
        description: description || "",
        image: image || null,
        sold: false,
        position: nextPosition,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: data });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end("Method not allowed");
}
