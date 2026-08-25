/**
 * Hop HTTP Node 20 — CPC-owned, pas une URL produit.
 * RN n'appelle jamais ce process. Les Edge Functions POST { path } avec
 * Authorization: Bearer EA_HTTP_HOP_SECRET.
 *
 *   EA_HTTP_HOP_SECRET=... npx tsx scripts/ea-http-hop.ts
 */
// @ts-nocheck — scripts/ Node http, hors graphe Expo (pas de @types/node).
import { createServer } from "node:http";
import { handleEaHopRequest } from "../supabase/functions/_shared/ea/hop.ts";

const port = Number(process.env.PORT ?? "8787");
const host = process.env.HOST ?? "127.0.0.1";

function headersToRecord(headers: Record<string, string | string[] | undefined>): Headers {
  const out = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") out.set(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) out.append(key, item);
    }
  }
  return out;
}

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    void (async () => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);
      const body = Buffer.concat(chunks);
      const request = new Request(url, {
        method: req.method,
        headers: headersToRecord(req.headers),
        body: body.length > 0 ? body : undefined,
      });
      const response = await handleEaHopRequest(request);
      const text = await response.text();
      const outHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        outHeaders[key] = value;
      });
      res.writeHead(response.status, outHeaders);
      res.end(text);
    })().catch((err) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : "hop crash" }));
    });
  });
});

server.listen(port, host, () => {
  console.log(`[ea-http-hop] Node ${process.versions.node} listening ${host}:${port}`);
});
