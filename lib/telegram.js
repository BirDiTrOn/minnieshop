export async function sendTelegramMessage(text) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn("Telegram not configured — skipping notification");
    return;
  }
  return sendTelegramMessageTo(chatId, text);
}

export async function sendTelegramMessageTo(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token || !chatId) {
    console.warn("Telegram not configured — skipping notification");
    return;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}
