const KV_PATH = "kv.db";

export interface SavedRequest {
  nameOrId: string;
  content: string;
  createdAt: number;
}

export function openKv() {
  return Deno.openKv(KV_PATH);
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
