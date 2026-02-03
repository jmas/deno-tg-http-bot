import { handleMessage } from "./handlers.ts";
import { openKv } from "./kv_store.ts";
import { getUpdates } from "./telegram.ts";

const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN environment variable.");
  Deno.exit(1);
}

const kv = await openKv();
let offset = 0;

console.log("Bot running (long polling). Ctrl+C to stop.");

while (true) {
  try {
    const updates = await getUpdates(token, offset, 30);
    for (const u of updates) {
      offset = u.update_id + 1;
      const msg = u.message;
      if (!msg?.text || !msg.from) continue;
      const userId = msg.from.id;
      const chatId = msg.chat.id;
      const text = msg.text;
      try {
        await handleMessage(token, kv, userId, chatId, text);
      } catch (e) {
        console.error("Handler error:", e);
        await import("./telegram.ts").then((t) =>
          t.sendMessage(token, chatId, "Error: " + String(e))
        );
      }
    }
  } catch (e) {
    console.error("Poll error:", e);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
