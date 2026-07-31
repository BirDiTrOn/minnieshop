export async function sendTelegramMessage(text) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn("Telegram not configured — skipping notification");
    return;
  }
  return sendTelegramMessageTo(chatId, text);
}

export async function sendTelegramPhoto(dataUrl, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("Telegram not configured — skipping photo notification");
    return;
  }

  const match = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) {
    throw new Error("Invalid payment proof image data");
  }
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");

  const form = new FormData();
  form.append("chat_id", chatId);
  if (caption) form.append("caption", caption.slice(0, 1024));
  form.append("photo", new Blob([buffer], { type: mime }), "payment-proof.jpg");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendPhoto error ${res.status}: ${body}`);
  }
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
