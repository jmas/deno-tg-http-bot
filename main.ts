import { handleMessage } from "./handlers.ts";
import { openKv } from "./kv_store.ts";
import type { Update } from "./telegram.ts";
import { sendMessage, setWebhook } from "./telegram.ts";

const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN environment variable.");
  Deno.exit(1);
}

const kv = await openKv();

async function handleSetWebhook(req: Request): Promise<Response> {
  let url: string | null = null;
  const pathUrl = new URL(req.url);
  url = pathUrl.searchParams.get("url");
  if (!url && (req.method === "POST" || req.method === "PUT")) {
    try {
      const body = await req.json() as Record<string, unknown>;
      url = typeof body?.url === "string" ? body.url : null;
    } catch {
      // ignore
    }
  }
  if (!url) {
    url = Deno.env.get("WEBHOOK_URL") ?? null;
  }
  if (!url) {
    return new Response(
      "Missing url. Use ?url=https://your-domain.com or POST body {\"url\":\"...\"} or set WEBHOOK_URL.",
      { status: 400, headers: { "Content-Type": "text/plain" } }
    );
  }
  try {
    await setWebhook(token, url);
    return new Response("Webhook set to " + url, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (e) {
    return new Response("Failed: " + String(e), {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function handleRequest(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname;
  if (path === "/set-webhook" || path === "/set-webhook/") {
    return handleSetWebhook(req);
  }
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }
  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const msg = update.message;
  if (!msg?.text || !msg.from) {
    return new Response("OK", { status: 200 });
  }
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const text = msg.text;
  try {
    await handleMessage(token, kv, userId, chatId, text);
  } catch (e) {
    console.error("Handler error:", e);
    await sendMessage(token, chatId, "Error: " + String(e));
  }
  return new Response("OK", { status: 200 });
}

const port = Number(Deno.env.get("PORT")) || 8080;
console.log(`Webhook server listening on http://0.0.0.0:${port}`);
Deno.serve({ port }, handleRequest);
