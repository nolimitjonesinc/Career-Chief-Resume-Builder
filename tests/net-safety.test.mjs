import assert from "node:assert/strict";
import test from "node:test";
import { isPrivateIp, resolveViaDoh } from "../shared/net-safety.mjs";
import { extractPublicUrl } from "../shared/url-extract.mjs";

test("private, loopback, link-local and metadata addresses are blocked", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1", "2001:db8::1"]) assert.equal(isPrivateIp(ip), true, ip);
});

test("ordinary public addresses pass", () => {
  for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:2800:220:1:248:1893:25c8:1946", "2001:4860:4860::8888"]) assert.equal(isPrivateIp(ip), false, ip);
});

test("anything unparseable is treated as unsafe", () => {
  for (const ip of ["not-an-ip", "999.1.1.1", "1:2:3"]) assert.equal(isPrivateIp(ip), true, ip);
});

const page = () => new Response("<html><title>t</title><body>" + "Readable role text. ".repeat(10) + "</body></html>", { headers: { "content-type": "text/html" } });

test("a normal-looking hostname that resolves to a private address is refused before any request", async () => {
  let fetched = false;
  await assert.rejects(
    extractPublicUrl("https://looks-fine.example/job", async () => { fetched = true; return page(); }, { resolve: async () => ["10.0.0.5"] }),
    /not a public website/,
  );
  assert.equal(fetched, false);
});

test("a host with any private address among its answers is refused", async () => {
  await assert.rejects(extractPublicUrl("https://mixed.example/", async () => page(), { resolve: async () => ["93.184.216.34", "169.254.169.254"] }), /not a public website/);
});

test("every redirect hop is checked before it is requested", async () => {
  const requested = [];
  const fetcher = async (url) => {
    requested.push(String(url));
    if (String(url).includes("start.example")) return new Response(null, { status: 302, headers: { location: "https://internal.example/secret" } });
    return page();
  };
  const resolve = async (host) => (host === "internal.example" ? ["192.168.0.10"] : ["93.184.216.34"]);
  await assert.rejects(extractPublicUrl("https://start.example/", fetcher, { resolve }), /not a public website/);
  assert.deepEqual(requested, ["https://start.example/"]);
});

test("redirects to a public page are followed, and a loop stops", async () => {
  const resolve = async () => ["93.184.216.34"];
  const ok = await extractPublicUrl("https://a.example/", async (url) => (new URL(url).pathname === "/" ? new Response(null, { status: 301, headers: { location: "/final" } }) : page()), { resolve });
  assert.equal(ok.url, "https://a.example/final");
  await assert.rejects(extractPublicUrl("https://loop.example/", async () => new Response(null, { status: 302, headers: { location: "https://loop.example/" } }), { resolve }), /too many times/);
});

test("credentials, odd ports, IPv6 literals and plain http are refused", async () => {
  const resolve = async () => ["93.184.216.34"];
  for (const url of ["https://user:pw@a.example/", "https://a.example:8443/", "https://[2606:4700::1]/", "http://a.example/", "https://127.0.0.1/", "https://localhost/", "https://printer.local/"]) {
    await assert.rejects(extractPublicUrl(url, async () => page(), { resolve }), undefined, url);
  }
});

test("a huge page is truncated, not buffered whole", async () => {
  const big = async () => new Response("<html><title>t</title><body>" + "word ".repeat(600_000) + "</body></html>", { headers: { "content-type": "text/html" } });
  const result = await extractPublicUrl("https://big.example/", big, { resolve: async () => ["93.184.216.34"] });
  assert.ok(result.text.length <= 50_000);
});

test("the DNS lookup falls back to a second provider and returns every address", async () => {
  const asked = [];
  const fetcher = async (url) => {
    asked.push(new URL(url).host);
    if (url.includes("cloudflare")) throw new TypeError("unreachable");
    const type = new URL(url).searchParams.get("type");
    return Response.json({ Answer: type === "A" ? [{ type: 1, data: "93.184.216.34" }, { type: 5, data: "alias.example." }] : [{ type: 28, data: "2606:2800:220:1::1" }] });
  };
  assert.deepEqual(await resolveViaDoh("a.example", fetcher), ["93.184.216.34", "2606:2800:220:1::1"]);
  assert.ok(asked.includes("cloudflare-dns.com") && asked.includes("dns.google"));
});

test("when no provider answers, the reader fails closed with a message that says what to do", async () => {
  await assert.rejects(extractPublicUrl("https://a.example/", async () => new Response("x"), { resolve: async () => [] }), /Paste the page text instead/);
});
