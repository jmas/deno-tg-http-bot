import { parseHttpRequest } from "./http_parser.ts";
import * as store from "./kv_store.ts";
import { sendMessage } from "./telegram.ts";

type Kv = Awaited<ReturnType<typeof store.openKv>>;

const MAX_RESPONSE_LENGTH = 4000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

/** If body looks like JSON, return pretty-printed JSON; otherwise return as-is. */
function formatResponseBody(body: string, contentType?: string | null): string {
  if (contentType != null && !contentType.toLowerCase().includes("application/json")) {
    return body;
  }
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return body;
  }
}

export async function handleMessage(
  token: string,
  kv: Kv,
  userId: number,
  chatId: number,
  text: string
): Promise<void> {
  const trimmed = text.trim();

  if (trimmed === "/start" || trimmed === "/list" || !trimmed.startsWith("/")) {
    await sendList(token, kv, chatId, userId);
    return;
  }

  if (trimmed.toLowerCase().startsWith("/add ")) {
    await handleAdd(token, kv, chatId, userId, trimmed);
    return;
  }

  if (trimmed.toLowerCase().startsWith("/delete ")) {
    await handleDelete(token, kv, chatId, userId, trimmed);
    return;
  }

  if (trimmed.startsWith("/request_")) {
    const nameOrId = trimmed.slice("/request_".length).trim();
    if (nameOrId) await handleExecute(token, kv, chatId, userId, nameOrId);
    else await sendMessage(token, chatId, "Usage: /request_&lt;NAME_OR_ID&gt;");
    return;
  }

  if (trimmed.startsWith("/subscribe_")) {
    const requestId = trimmed.slice("/subscribe_".length).trim();
    if (requestId) await handleSubscribe(token, kv, chatId, userId, requestId);
    else await sendMessage(token, chatId, "Usage: /subscribe_&lt;NAME_OR_ID&gt;");
    return;
  }

  if (trimmed.startsWith("/unsubscribe_")) {
    const requestId = trimmed.slice("/unsubscribe_".length).trim();
    if (requestId) await handleUnsubscribe(token, kv, chatId, userId, requestId);
    else await sendMessage(token, chatId, "Usage: /unsubscribe_&lt;NAME_OR_ID&gt;");
    return;
  }

  await sendList(token, kv, chatId, userId);
}

async function sendList(
  token: string,
  kv: Kv,
  chatId: number,
  userId: number
): Promise<void> {
  const requests = await store.listRequests(kv, userId);
  const subscribed = await store.listSubscriptionsForUser(kv, userId);
  if (requests.length === 0) {
    await sendMessage(
      token,
      chatId,
      "No saved requests. Add one with:\n/add &lt;NAME_AS_ID&gt; &lt;HTTP request text&gt;",
      { parse_mode: "HTML" }
    );
    return;
  }
  const lines = requests.map(
    (r) => `• /request_${r.nameOrId}${subscribed.includes(r.nameOrId) ? " (subscribed)" : ""}`
  );
  let text = "Saved requests:\n\n" + lines.join("\n");
  if (subscribed.length > 0) {
    text += "\n\nSubscribe: /subscribe_&lt;NAME_OR_ID&gt; · Unsubscribe: /unsubscribe_&lt;NAME_OR_ID&gt;";
  }
  await sendMessage(
    token,
    chatId,
    text,
    { parse_mode: "HTML" }
  );
}

async function handleAdd(
  token: string,
  kv: Kv,
  chatId: number,
  userId: number,
  text: string
): Promise<void> {
  const afterAdd = text.slice(5).trimStart();
  const firstSpace = afterAdd.indexOf(" ");
  const name = firstSpace === -1 ? afterAdd : afterAdd.slice(0, firstSpace);
  const content = firstSpace === -1 ? "" : afterAdd.slice(firstSpace + 1).trim();

  if (!name) {
    await sendMessage(
      token,
      chatId,
      "Usage: /add &lt;NAME_AS_ID&gt; &lt;HTTP request (multiline)&gt;",
      { parse_mode: "HTML" }
    );
    return;
  }
  if (!content) {
    await sendMessage(token, chatId, "Provide the HTTP request content after the name.");
    return;
  }
  try {
    parseHttpRequest(content);
  } catch (e) {
    await sendMessage(
      token,
      chatId,
      "Invalid HTTP request: " + escapeHtml(String(e)),
      { parse_mode: "HTML" }
    );
    return;
  }
  await store.setRequest(kv, userId, name, content);
  await sendMessage(
    token,
    chatId,
    `Saved request: /request_${name}`,
    { parse_mode: "HTML" }
  );
}

async function handleDelete(
  token: string,
  kv: Kv,
  chatId: number,
  userId: number,
  text: string
): Promise<void> {
  const nameOrId = text.slice(8).trim();
  if (!nameOrId) {
    await sendMessage(token, chatId, "Usage: /delete &lt;NAME_OR_ID&gt;", {
      parse_mode: "HTML",
    });
    return;
  }
  const deleted = await store.deleteRequest(kv, userId, nameOrId);
  if (deleted) {
    await sendMessage(token, chatId, `Deleted: ${escapeHtml(nameOrId)}`, {
      parse_mode: "HTML",
    });
  } else {
    await sendMessage(token, chatId, `No request found: ${escapeHtml(nameOrId)}`, {
      parse_mode: "HTML",
    });
  }
}

async function handleExecute(
  token: string,
  kv: Kv,
  chatId: number,
  userId: number,
  nameOrId: string
): Promise<void> {
  const saved = await store.getRequest(kv, userId, nameOrId);
  if (!saved) {
    await sendMessage(token, chatId, `No request found: ${escapeHtml(nameOrId)}`, {
      parse_mode: "HTML",
    });
    return;
  }
  let parsed;
  try {
    parsed = parseHttpRequest(saved.content);
  } catch (e) {
    await sendMessage(
      token,
      chatId,
      "Invalid saved request: " + escapeHtml(String(e)),
      { parse_mode: "HTML" }
    );
    return;
  }
  try {
    const res = await fetch(parsed.url, {
      method: parsed.method,
      headers: parsed.headers,
      body: parsed.body,
    });
    const body = await res.text();
    const contentType = res.headers.get("content-type");
    const formatted = formatResponseBody(body, contentType);
    const summary = `HTTP ${res.status} ${res.statusText}\n\n${truncate(formatted, MAX_RESPONSE_LENGTH)}`;
    await sendMessage(token, chatId, "<pre>" + escapeHtml(summary) + "</pre>", {
      parse_mode: "HTML",
    });
  } catch (e) {
    await sendMessage(
      token,
      chatId,
      "Request failed: " + escapeHtml(String(e)),
      { parse_mode: "HTML" }
    );
  }
}

async function handleSubscribe(
  token: string,
  kv: Kv,
  chatId: number,
  userId: number,
  requestId: string
): Promise<void> {
  const saved = await store.getRequest(kv, userId, requestId);
  if (!saved) {
    await sendMessage(token, chatId, `No request found: ${escapeHtml(requestId)}`, {
      parse_mode: "HTML",
    });
    return;
  }
  await store.addSubscription(kv, userId, chatId, requestId);
  await sendMessage(
    token,
    chatId,
    `Subscribed to <code>${escapeHtml(requestId)}</code>. You'll be notified when the response changes (checked every 5 min).`,
    { parse_mode: "HTML" }
  );
}

async function handleUnsubscribe(
  token: string,
  kv: Kv,
  chatId: number,
  userId: number,
  requestId: string
): Promise<void> {
  const removed = await store.removeSubscription(kv, userId, requestId);
  if (removed) {
    await sendMessage(
      token,
      chatId,
      `Unsubscribed from <code>${escapeHtml(requestId)}</code>.`,
      { parse_mode: "HTML" }
    );
  } else {
    await sendMessage(
      token,
      chatId,
      `Not subscribed to <code>${escapeHtml(requestId)}</code>.`,
      { parse_mode: "HTML" }
    );
  }
}

/** Execute a saved request and return response text; throws on parse/fetch error. */
async function executeRequestContent(content: string): Promise<{ status: number; statusText: string; body: string }> {
  const parsed = parseHttpRequest(content);
  const res = await fetch(parsed.url, {
    method: parsed.method,
    headers: parsed.headers,
    body: parsed.body,
  });
  const body = await res.text();
  return { status: res.status, statusText: res.statusText, body };
}

/** Called by /cron: check all subscriptions and notify when response changed. */
export async function runCronCheck(token: string, kv: Kv): Promise<void> {
  const subscriptions = await store.listSubscriptions(kv);
  for (const sub of subscriptions) {
    const saved = await store.getRequest(kv, sub.userId, sub.requestId);
    if (!saved) continue;
    try {
      const { status, statusText, body } = await executeRequestContent(saved.content);
      const formatted = formatResponseBody(body);
      const currentResponse = `${status} ${statusText}\n${formatted}`;
      const lastResponse = await store.getLastResponse(kv, sub.userId, sub.requestId);
      await store.setLastResponse(kv, sub.userId, sub.requestId, currentResponse);
      if (lastResponse !== null && lastResponse !== currentResponse) {
        const summary = `Response changed for <code>${escapeHtml(sub.requestId)}</code>:\n\n<pre>${escapeHtml(`HTTP ${status} ${statusText}\n\n${truncate(formatted, MAX_RESPONSE_LENGTH)}`)}</pre>`;
        await sendMessage(token, sub.chatId, summary, { parse_mode: "HTML" });
      }
    } catch (e) {
      console.error(`Cron check failed for user=${sub.userId} request=${sub.requestId}:`, e);
    }
  }
}
