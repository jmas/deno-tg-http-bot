import { assertEquals } from "@std/assert";
import { parseHttpRequest } from "./http_parser.ts";

Deno.test("parseHttpRequest parses GET with headers", () => {
  const raw = `GET /api/dms/query/bwt-aqua/locations?type=favorite HTTP/1.1
Host: dms.ecosoft.ua
Content-Type:  application/json
Authorization: Bearer token123`;

  const p = parseHttpRequest(raw);
  assertEquals(p.method, "GET");
  assertEquals(p.url, "https://dms.ecosoft.ua/api/dms/query/bwt-aqua/locations?type=favorite");
  assertEquals(p.headers["host"], "dms.ecosoft.ua");
  assertEquals(p.headers["authorization"], "Bearer token123");
  assertEquals(p.body, undefined);
});

Deno.test("parseHttpRequest parses POST with body", () => {
  const raw = `POST /submit HTTP/1.1
Host: example.com

{"key":"value"}`;
  const p = parseHttpRequest(raw);
  assertEquals(p.method, "POST");
  assertEquals(p.url, "https://example.com/submit");
  assertEquals(p.body, '{"key":"value"}');
});
