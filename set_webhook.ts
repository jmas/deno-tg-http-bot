/**
 * One-time setup: register your webhook URL with Telegram.
 * Run: WEBHOOK_URL=https://your-domain.com deno run --allow-net set_webhook.ts
 */
import { setWebhook } from "./telegram.ts";

const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
const url = Deno.env.get("WEBHOOK_URL");
if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN.");
  Deno.exit(1);
}
if (!url) {
  console.error("Set WEBHOOK_URL (e.g. https://your-domain.com or https://xxx.ngrok.io).");
  Deno.exit(1);
}
await setWebhook(token, url);
console.log("Webhook set to", url);
