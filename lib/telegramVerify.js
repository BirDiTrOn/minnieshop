import crypto from "crypto";

// Verifies the data-check-string from Telegram's Login Widget using the
// bot token, per Telegram's official login-widget verification algorithm.
export function verifyTelegramLogin(data) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  const { hash, ...rest } = data || {};
  if (!hash) return false;

  const checkString = Object.keys(rest)
    .filter((key) => rest[key] !== undefined && rest[key] !== null)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(token).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

  if (computedHash !== hash) return false;

  // auth_date shouldn't be too old (basic replay protection — 1 day window).
  const authDate = Number(rest.auth_date);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return false;

  return true;
}
