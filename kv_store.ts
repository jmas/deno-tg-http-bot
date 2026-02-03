export interface SavedRequest {
  nameOrId: string;
  content: string;
  createdAt: number;
}

/** Opens Deno KV. With no path, uses default persistent location (avoids NOT_FOUND in some environments). */
export function openKv() {
  return Deno.openKv();
}

export async function listRequests(kv: Awaited<ReturnType<typeof openKv>>, userId: number): Promise<SavedRequest[]> {
  const out: SavedRequest[] = [];
  const iter = kv.list({ prefix: ["requests", userId] });
  for await (const e of iter) {
    const key = e.key as [string, number, string];
    const nameOrId = key[2];
    const { content, createdAt } = e.value as { content: string; createdAt: number };
    out.push({ nameOrId, content, createdAt });
  }
  out.sort((a, b) => a.createdAt - b.createdAt);
  return out;
}

export async function getRequest(
  kv: Awaited<ReturnType<typeof openKv>>,
  userId: number,
  nameOrId: string
): Promise<SavedRequest | null> {
  const key = ["requests", userId, nameOrId];
  const e = await kv.get(key);
  if (!e.value) return null;
  const { content, createdAt } = e.value as { content: string; createdAt: number };
  return { nameOrId, content, createdAt };
}

export async function setRequest(
  kv: Awaited<ReturnType<typeof openKv>>,
  userId: number,
  nameOrId: string,
  content: string
): Promise<void> {
  await kv.set(["requests", userId, nameOrId], {
    content,
    createdAt: Date.now(),
  });
}

export async function deleteRequest(
  kv: Awaited<ReturnType<typeof openKv>>,
  userId: number,
  nameOrId: string
): Promise<boolean> {
  const key = ["requests", userId, nameOrId];
  const e = await kv.get(key);
  if (!e.value) return false;
  await kv.delete(key);
  return true;
}

// Subscriptions: user/chat subscribed to a request for cron change notifications
export interface Subscription {
  userId: number;
  chatId: number;
  requestId: string;
}

export async function addSubscription(
  kv: Awaited<ReturnType<typeof openKv>>,
  userId: number,
  chatId: number,
  requestId: string
): Promise<void> {
  await kv.set(["subscriptions", userId, requestId], { chatId });
}

export async function removeSubscription(
  kv: Awaited<ReturnType<typeof openKv>>,
  userId: number,
  requestId: string
): Promise<boolean> {
  const key = ["subscriptions", userId, requestId];
  const e = await kv.get(key);
  if (!e.value) return false;
  await kv.delete(key);
  return true;
}

export async function listSubscriptions(
  kv: Awaited<ReturnType<typeof openKv>>
): Promise<Subscription[]> {
  const out: Subscription[] = [];
  const iter = kv.list({ prefix: ["subscriptions"] });
  for await (const e of iter) {
    const key = e.key as [string, number, string];
    const [, userId, requestId] = key;
    const { chatId } = e.value as { chatId: number };
    out.push({ userId, chatId, requestId });
  }
  return out;
}

export async function listSubscriptionsForUser(
  kv: Awaited<ReturnType<typeof openKv>>,
  userId: number
): Promise<string[]> {
  const out: string[] = [];
  const iter = kv.list({ prefix: ["subscriptions", userId] });
  for await (const e of iter) {
    const key = e.key as [string, number, string];
    out.push(key[2]);
  }
  return out;
}

export async function getLastResponse(
  kv: Awaited<ReturnType<typeof openKv>>,
  userId: number,
  requestId: string
): Promise<string | null> {
  const e = await kv.get(["last_response", userId, requestId]);
  if (!e.value) return null;
  return (e.value as { responseText: string }).responseText;
}

export async function setLastResponse(
  kv: Awaited<ReturnType<typeof openKv>>,
  userId: number,
  requestId: string,
  responseText: string
): Promise<void> {
  await kv.set(["last_response", userId, requestId], { responseText });
}
