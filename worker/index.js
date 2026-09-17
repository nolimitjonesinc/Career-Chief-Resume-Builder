import { extractPublicUrl } from "../shared/url-extract.mjs";
import { handleCareerAI } from "../shared/career-ai.mjs";

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname.startsWith("/api/ai/")) return handleCareerAI(request, env);
    if (requestUrl.pathname === "/api/extract-url") {
      if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
      try {
        const { url } = await request.json();
        const result = await extractPublicUrl(url, env.URL_FETCH || fetch);
        return Response.json(result);
      } catch (error) {
        return Response.json({ error: error.message || "The link could not be read." }, { status: 422 });
      }
    }
    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
