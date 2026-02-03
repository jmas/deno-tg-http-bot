const TELEGRAM_API = "https://api.telegram.org/bot";

export interface Update {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string };
    chat: { id: number };
    text?: string;
  };
}

export async function getUpdates(
  token: string,
  offset: number,
  timeout = 30
): Promise<Update[]> {
  const url = `${TELEGRAM_API}${token}/getUpdates?offset=${offset}&timeout=${timeout}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Telegram API error: ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.description ?? "getUpdates failed");
  return data.result ?? [];
}

export async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  options?: { parse_mode?: "HTML" | "Markdown"; reply_to_message_id?: number }
): Promise<void> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (options?.parse_mode) body.parse_mode = options.parse_mode;
  if (options?.reply_to_message_id != null) body.reply_to_message_id = options.reply_to_message_id;
  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`sendMessage failed: ${res.status} ${err}`);
  }
}

export async function setWebhook(token: string, url: string): Promise<void> {
  const res = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`setWebhook failed: ${res.status} ${err}`);
  }
}
