// Vercel adapter. The reading, validation and limits all live in the shared
// module so local dev, Cloudflare and Vercel cannot drift apart.
import { extractPublicUrl } from "../shared/url-extract.mjs";

export default {
  async fetch(request) {
    if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
    try {
      const { url } = await request.json();
      return Response.json(await extractPublicUrl(url));
    } catch (error) {
      return Response.json({ error: error.message || "The link could not be read." }, { status: 422 });
    }
  },
};
