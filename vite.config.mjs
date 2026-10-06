import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { extractPublicUrl } from "./shared/url-extract.mjs";
import { handleCareerAI } from "./shared/career-ai.mjs";
import { aiEnvFrom } from "./shared/ai-guard.mjs";
import { assertAccess, handleAccess } from "./shared/access.mjs";

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function urlExtractor() {
  return {
    name: "career-chief-url-extractor",
    configureServer(server) {
      server.middlewares.use("/api/ai", async (req, res, next) => {
        // The dev server listens on the whole network on purpose. The AI route does
        // not: only this machine may spend the key, whoever else is on the wifi.
        if (req.url !== "/status" && !LOOPBACK.has(req.socket.remoteAddress || "")) {
          res.statusCode = 403;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "AI routes only answer requests from this machine." }));
          return;
        }
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const request = new Request(`http://localhost/api/ai${req.url}`, { method: req.method, headers: req.headers, body: req.method === "GET" ? undefined : Buffer.concat(chunks) });
          const response = await handleCareerAI(request, aiEnvFrom(process.env));
          res.statusCode = response.status;
          res.setHeader("content-type", "application/json");
          res.end(await response.text());
        } catch (error) { next(error); }
      });
      server.middlewares.use("/api/access", async (req, res, next) => {
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const request = new Request("http://localhost/api/access", { method: req.method, headers: req.headers, body: req.method === "GET" ? undefined : Buffer.concat(chunks) });
          const response = await handleAccess(request, aiEnvFrom(process.env));
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
          await assertAccess(new Request("http://localhost/api/extract-url", { headers: req.headers }), aiEnvFrom(process.env));
          let raw = "";
          for await (const chunk of req) raw += chunk;
          const result = await extractPublicUrl(JSON.parse(raw || "{}").url);
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = error.status || 422;
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
