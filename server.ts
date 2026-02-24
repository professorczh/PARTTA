import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cors());

  // API Proxy Endpoint
  app.post("/api/proxy", async (req, res) => {
    const { targetUrl, method, headers, body } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: "Missing targetUrl" });
    }

    // Domain Whitelist for security
    const allowedDomains = [
      "googleapis.com",
      "google.com",
      "openai.com",
      "12ai.org",
      "anthropic.com",
      "openrouter.ai",
      "deepseek.com"
    ];

    try {
      const url = new URL(targetUrl);
      const isAllowed = allowedDomains.some(domain => 
        url.hostname === domain || url.hostname.endsWith("." + domain)
      );

      if (!isAllowed) {
        return res.status(403).json({ error: "Domain not allowed in proxy" });
      }

      const response = await fetch(targetUrl, {
        method: method || "POST",
        headers: {
          ...headers,
          // Remove host header to avoid issues with some providers
          "host": undefined,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Proxy Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
