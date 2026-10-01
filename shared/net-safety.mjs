// Is this address one a public website would have? Used by the link reader so a
// harmless-looking hostname can't point us at a private machine or a cloud
// metadata endpoint (SSRF). Pure functions, tested without a network.

function ipv4Parts(ip) {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null;
}

const inRange = (parts, [a, b, c], bits) => {
  const value = (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;
  const base = (a << 24 | b << 16 | c << 8) >>> 0;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (value & mask) === (base & mask);
};

const BLOCKED_V4 = [
  [[0, 0, 0], 8], [[10, 0, 0], 8], [[100, 64, 0], 10], [[127, 0, 0], 8], [[169, 254, 0], 16],
  [[172, 16, 0], 12], [[192, 0, 0], 24], [[192, 0, 2], 24], [[192, 168, 0], 16], [[198, 18, 0], 15],
  [[198, 51, 100], 24], [[203, 0, 113], 24], [[224, 0, 0], 4], [[240, 0, 0], 4],
];

export function isPrivateIPv4(ip) {
  const parts = ipv4Parts(ip);
  if (!parts) return true; // not parseable -> not safe
  return BLOCKED_V4.some(([base, bits]) => inRange(parts, base, bits));
}

// Expand an IPv6 string into eight 16-bit groups, or null if malformed.
function ipv6Groups(ip) {
  let text = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const v4 = ipv4Parts(dotted[1]);
    if (!v4) return null;
    text = text.slice(0, -dotted[1].length) + ((v4[0] << 8 | v4[1]).toString(16)) + ":" + ((v4[2] << 8 | v4[3]).toString(16));
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...tail].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

export function isPrivateIPv6(ip) {
  const g = ipv6Groups(ip);
  if (!g) return true;
  const embeddedV4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPrivateIPv4(embeddedV4); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isPrivateIPv4(embeddedV4); // NAT64
  if (g.slice(0, 7).every((x) => x === 0)) return true; // :: and ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true; // link local
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  return false;
}

export const isPrivateIp = (ip) => (ip.includes(":") ? isPrivateIPv6(ip) : isPrivateIPv4(ip));

// Default resolver: DNS-over-HTTPS, so it works the same on Node and on Workers
// (neither exposes a portable DNS API). Returns every A and AAAA address.
export async function resolveViaDoh(host, fetchImpl = fetch) {
  const ask = async (type) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, { headers: { accept: "application/dns-json" }, signal: controller.signal });
      if (!response.ok) return [];
      const body = await response.json();
      return (body.Answer || []).filter((row) => row.type === (type === "A" ? 1 : 28)).map((row) => row.data);
    } catch { return []; }
    finally { clearTimeout(timer); }
  };
  const [v4, v6] = await Promise.all([ask("A"), ask("AAAA")]);
  return [...v4, ...v6];
}

// Throws unless every address the host resolves to is public.
export async function assertHostResolvesPublic(host, resolve = resolveViaDoh) {
  const addresses = await resolve(host);
  if (!addresses?.length) throw new Error("That address could not be looked up.");
  if (addresses.some(isPrivateIp)) throw new Error("That address is not a public website.");
}
