import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { extractPublicUrl } from "./shared/url-extract.mjs";
import { handleCareerAI } from "./shared/career-ai.mjs";

function urlExtractor() {
  return {
    name: "career-chief-url-extractor",
    configureServer(server) {
      server.middlewares.use("/api/ai", async (req, res, next) => {
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const request = new Request(`http://localhost/api/ai${req.url}`, { method: req.method, headers: req.headers, body: req.method === "GET" ? undefined : Buffer.concat(chunks) });
          const response = await handleCareerAI(request, { OPENAI_API_KEY: process.env.OPENAI_API_KEY });
          res.statusCode = response.status;
          res.setHeader("content-type", "application/json");
          res.end(await response.text());
        } catch (error) { next(error); }
      });
      server.middlewares.use("/api/extract-url", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed." }));
          return;
        }
        try {
          let raw = "";
          for await (const chunk of req) raw += chunk;
          const result = await extractPublicUrl(JSON.parse(raw || "{}").url);
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 422;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: error.message || "The link could not be read." }));
        }
      });
    },
  };
}

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [urlExtractor(), react()],
});
