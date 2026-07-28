import { verifyTelegramLogin } from "../../lib/telegramVerify";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method not allowed");
  }

  const data = req.body || {};
  if (!verifyTelegramLogin(data)) {
    return res.status(401).json({ error: "Could not verify Telegram login" });
  }

  const identity = {
    id: String(data.id),
    username: data.username || "",
    first_name: data.first_name || "",
  };

  const isProd = process.env.NODE_ENV === "production";
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  const value = encodeURIComponent(JSON.stringify(identity));
  res.setHeader(
    "Set-Cookie",
    `buyer_tg=${value}; Path=/; SameSite=Lax; Max-Age=${maxAge}${isProd ? "; Secure" : ""}`
  );

  return res.status(200).json({ ok: true, identity });
}
