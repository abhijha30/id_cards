// Minimal Supabase-shaped gateway for LOCAL VERIFICATION ONLY.
//   /rest/v1/*    -> real PostgREST (real RLS, real migrations)
//   /auth/v1/*    -> tiny password-auth mock
//   /storage/v1/* -> tiny storage mock that authorises every call through the real storage.objects RLS policies
import http from "node:http";
import crypto from "node:crypto";
import pg from "pg";
import { PNG } from "pngjs";

const PORT = 54321;
const PGRST = { host: "127.0.0.1", port: 3001 };
const SECRET = process.env.JWT_SECRET;
const pool = new pg.Pool({ user: process.env.PGUSER ?? "root", host: "/var/run/postgresql", database: process.env.E2E_DB ?? "gdg_e2e" });

const b64u = (v) => Buffer.from(v).toString("base64url");
const sign = (payload) => {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
};
const verify = (token) => {
  const [h, b, s] = (token ?? "").split(".");
  if (!h || !b || !s) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url");
  if (expected.length !== s.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(s))) return null;
  const payload = JSON.parse(Buffer.from(b, "base64url").toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
};

const ANON = sign({ role: "anon", iss: "local-harness", exp: 4102444800 });
console.log("ANON_KEY=" + ANON);

const USERS = {
  "admin@example.test": { id: "00000000-0000-0000-0000-0000000000a1", password: "correct-horse-battery" },
  "plain@example.test": { id: "00000000-0000-0000-0000-0000000000b2", password: "plain-user-pass" },
};
const refreshTokens = new Map();

const userJson = (email, u) => ({
  id: u.id, aud: "authenticated", role: "authenticated", email,
  app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z",
});
function session(email) {
  const u = USERS[email];
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = sign({ sub: u.id, role: "authenticated", aud: "authenticated", email, exp });
  const refresh_token = crypto.randomUUID();
  refreshTokens.set(refresh_token, email);
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token, user: userJson(email, u) };
}

const files = new Map(); // "bucket/path" -> { bytes, type }
function placeholderPng(seed) {
  const png = new PNG({ width: 240, height: 300 });
  for (let y = 0; y < 300; y++) for (let x = 0; x < 240; x++) {
    const i = (240 * y + x) << 2;
    png.data[i] = (x + seed * 40) % 256; png.data[i + 1] = (y + seed * 90) % 256; png.data[i + 2] = 180; png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

async function asClaims(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await client.query(`set local role ${claims.role === "authenticated" ? "authenticated" : "anon"}`);
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) { await client.query("rollback"); throw e; } finally { client.release(); }
}
const claimsOf = (req) => verify((req.headers.authorization ?? "").replace(/^Bearer /i, "")) ?? { role: "anon" };

const readBody = (req) => new Promise((res) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
function json(res, status, body, extra = {}) { res.writeHead(status, { "Content-Type": "application/json", ...extra }); res.end(JSON.stringify(body)); }

function parseMultipart(body, contentType) {
  const boundary = /boundary=(.+)$/.exec(contentType)?.[1];
  if (!boundary) return null;
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = []; let start = body.indexOf(delimiter);
  while (start !== -1) {
    const next = body.indexOf(delimiter, start + delimiter.length);
    if (next === -1) break;
    parts.push(body.subarray(start + delimiter.length + 2, next - 2));
    start = next;
  }
  for (const part of parts) {
    const split = part.indexOf("\r\n\r\n");
    const headers = part.subarray(0, split).toString();
    if (/filename=/.test(headers)) {
      const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1] ?? "application/octet-stream";
      return { bytes: part.subarray(split + 4), type };
    }
  }
  return null;
}

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX = 5 * 1024 * 1024;

async function storage(req, res, url) {
  const rest = url.pathname.replace(/^\/storage\/v1/, "");
  const claims = claimsOf(req);
  const decode = (s) => s.split("/").map(decodeURIComponent).join("/");

  let m;
  if (req.method === "POST" && (m = /^\/object\/sign\/([^/]+)$/.exec(rest))) {
    const bucket = m[1]; const { paths } = JSON.parse((await readBody(req)).toString());
    const out = [];
    for (const path of paths) {
      const ok = await asClaims(claims, async (c) => (await c.query("select 1 from storage.objects where bucket_id=$1 and name=$2", [bucket, path])).rowCount > 0);
      out.push(ok ? { error: null, path, signedURL: `/object/sign/${bucket}/${path}?token=${sign({ url: `${bucket}/${path}`, exp: Math.floor(Date.now() / 1000) + 3600 })}` } : { error: "Object not found", path, signedURL: null });
    }
    return json(res, 200, out);
  }
  if (req.method === "GET" && (m = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(rest))) {
    const payload = verify(url.searchParams.get("token") ?? "");
    const path = decode(m[2]);
    if (!payload || payload.url !== `${m[1]}/${path}`) return json(res, 400, { statusCode: "400", error: "InvalidJWT", message: "bad token" });
    const f = files.get(`${m[1]}/${path}`) ?? { bytes: placeholderPng(1), type: "image/png" };
    res.writeHead(200, { "Content-Type": f.type }); return res.end(f.bytes);
  }
  if (req.method === "GET" && (m = /^\/object\/info\/([^/]+)\/(.+)$/.exec(rest))) {
    const path = decode(m[2]);
    const ok = await asClaims(claims, async (c) => (await c.query("select 1 from storage.objects where bucket_id=$1 and name=$2", [m[1], path])).rowCount > 0);
    if (!ok) return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
    const f = files.get(`${m[1]}/${path}`) ?? { bytes: placeholderPng(1), type: "image/png" };
    return json(res, 200, { id: crypto.randomUUID(), name: path, size: f.bytes.length, contentType: f.type, bucketId: m[1] });
  }
  if (req.method === "GET" && (m = /^\/object\/(?:authenticated\/)?([^/]+)\/(.+)$/.exec(rest))) {
    const path = decode(m[2]);
    const ok = await asClaims(claims, async (c) => (await c.query("select 1 from storage.objects where bucket_id=$1 and name=$2", [m[1], path])).rowCount > 0);
    if (!ok) return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
    const f = files.get(`${m[1]}/${path}`) ?? { bytes: placeholderPng(2), type: "image/png" };
    res.writeHead(200, { "Content-Type": f.type }); return res.end(f.bytes);
  }
  if (req.method === "POST" && (m = /^\/object\/([^/]+)\/(.+)$/.exec(rest))) {
    const bucket = m[1]; const path = decode(m[2]);
    const body = await readBody(req);
    const ct = req.headers["content-type"] ?? "";
    const file = ct.startsWith("multipart/") ? parseMultipart(body, ct) : { bytes: body, type: ct };
    if (!file) return json(res, 400, { statusCode: "400", error: "InvalidRequest", message: "no file" });
    if (file.bytes.length > MAX) return json(res, 413, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
    if (!ALLOWED.has(file.type)) return json(res, 415, { statusCode: "415", error: "invalid_mime_type", message: `mime type ${file.type} is not supported` });
    try {
      await asClaims(claims, (c) => c.query("insert into storage.objects (bucket_id, name) values ($1,$2)", [bucket, path]));
    } catch (e) {
      if (e.code === "42501") return json(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      if (e.code === "23505") return json(res, 409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      return json(res, 500, { message: e.message });
    }
    files.set(`${bucket}/${path}`, file);
    return json(res, 200, { Id: crypto.randomUUID(), Key: `${bucket}/${path}` });
  }
  if (req.method === "DELETE" && (m = /^\/object\/([^/]+)$/.exec(rest))) {
    const { prefixes } = JSON.parse((await readBody(req)).toString());
    const deleted = [];
    for (const name of prefixes) {
      const n = await asClaims(claims, async (c) => (await c.query("delete from storage.objects where bucket_id=$1 and name=$2", [m[1], name])).rowCount);
      if (n) { deleted.push({ name, bucket_id: m[1] }); files.delete(`${m[1]}/${name}`); }
    }
    return json(res, 200, deleted);
  }
  return json(res, 404, { statusCode: "404", error: "not_found", message: `unhandled ${req.method} ${rest}` });
}

async function auth(req, res, url) {
  const rest = url.pathname.replace(/^\/auth\/v1/, "");
  if (req.method === "POST" && rest === "/token") {
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const u = USERS[body.email];
      if (!u || u.password !== body.password) return json(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      return json(res, 200, session(body.email));
    }
    if (grant === "refresh_token") {
      const email = refreshTokens.get(body.refresh_token);
      if (!email) return json(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      return json(res, 200, session(email));
    }
  }
  if (req.method === "GET" && rest === "/user") {
    const payload = verify((req.headers.authorization ?? "").replace(/^Bearer /i, ""));
    if (!payload?.sub) return json(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" });
    return json(res, 200, userJson(payload.email, { id: payload.sub }));
  }
  if (req.method === "POST" && rest === "/logout") { res.writeHead(204); return res.end(); }
  return json(res, 404, { msg: `unhandled auth ${req.method} ${rest}` });
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-upsert, x-client-info, cache-control, prefer, accept-profile, content-profile, range",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "*",
};

http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, "http://gateway");
  try {
    if (url.pathname.startsWith("/rest/v1")) {
      const proxied = http.request({ ...PGRST, method: req.method, path: url.pathname.replace(/^\/rest\/v1/, "") + url.search, headers: { ...req.headers, host: "127.0.0.1:3001" } }, (pr) => {
        res.writeHead(pr.statusCode, pr.headers); pr.pipe(res);
      });
      proxied.on("error", (e) => json(res, 502, { message: e.message }));
      return req.pipe(proxied);
    }
    if (url.pathname.startsWith("/auth/v1")) return await auth(req, res, url);
    if (url.pathname.startsWith("/storage/v1")) return await storage(req, res, url);
    json(res, 404, { message: "not found" });
  } catch (e) { console.error(e); json(res, 500, { message: String(e.message ?? e) }); }
}).listen(PORT, "127.0.0.1", () => console.log("gateway listening on " + PORT));
