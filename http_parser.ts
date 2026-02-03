/**
 * Parses a raw HTTP request string into method, URL, headers, and body for fetch().
 */
export interface ParsedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export function parseHttpRequest(raw: string): ParsedRequest {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length === 0) throw new Error("Empty request");

  const [requestLine, ...rest] = lines;
  const match = requestLine.match(/^(\w+)\s+(\S+)\s+HTTP\/[\d.]+$/i);
  if (!match) throw new Error("Invalid request line: " + requestLine);
  const [, method, path] = match;

  const headers: Record<string, string> = {};
  let i = 0;
  for (; i < rest.length; i++) {
    const line = rest[i];
    if (line.trim() === "") break;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    headers[key.toLowerCase()] = value;
  }
  const body = rest.slice(i + 1).join("\n").trim();

  const host = headers["host"] ?? "";
  const scheme = host && !path.startsWith("http") ? "https" : "";
  const url = path.startsWith("http") ? path : `${scheme}://${host}${path}`;

  const result: ParsedRequest = { method, url, headers };
  if (body) result.body = body;
  return result;
}
