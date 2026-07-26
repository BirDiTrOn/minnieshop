export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method not allowed");
  }

  const { password } = req.body || {};
  if (password && password === process.env.ADMIN_PASSWORD) {
    const isProd = process.env.NODE_ENV === "production";
    const maxAge = 60 * 60 * 24 * 7; // 7 days
    res.setHeader(
      "Set-Cookie",
      `vault_admin=${process.env.ADMIN_SESSION_SECRET}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
        isProd ? "; Secure" : ""
      }`
    );
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: "Wrong password" });
}
