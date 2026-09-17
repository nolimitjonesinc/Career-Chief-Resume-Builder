import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { extractPublicUrl } from "./shared/url-extract.mjs";

function urlExtractor() {
  return {
    name: "career-chief-url-extractor",
    configureServer(server) {
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
