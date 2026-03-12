import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Identification Middleware
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(cors());

  // Dynamic whitelist for proxy
  const dynamicAllowedDomains = new Set<string>();

  // 2. Explicit API Routes (BEFORE anything else)
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Express is alive" });
  });

  app.post("/api/proxy/register-domains", (req, res) => {
    const { domains } = req.body;
    if (Array.isArray(domains)) {
      domains.forEach(domain => {
        if (typeof domain === 'string' && domain.length > 0) {
          dynamicAllowedDomains.add(domain.toLowerCase());
        }
      });
      console.log("[PROXY] Registered domains:", Array.from(dynamicAllowedDomains));
      res.json({ success: true, currentDomains: Array.from(dynamicAllowedDomains) });
    } else {
      res.status(400).json({ error: "Invalid domains format" });
    }
  });

  // Use a more specific route handler to ensure it's not caught by SPA fallback
  const proxyHandler = async (req: express.Request, res: express.Response) => {
    console.log("[PROXY] Request to:", req.body?.targetUrl);
    const { targetUrl, method, headers, body } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: "Missing targetUrl" });
    }

    const allowedDomains = [
      "googleapis.com",
      "google.com",
      "openai.com",
      "12ai.org",
      "anthropic.com",
      "openrouter.ai",
      "deepseek.com",
      "picsum.photos",
      "fastly.picsum.photos"
    ];

    try {
      const url = new URL(targetUrl);
      const hostname = url.hostname.toLowerCase();
      
      const isAllowed = allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith("." + domain)
      ) || dynamicAllowedDomains.has(hostname) || Array.from(dynamicAllowedDomains).some(domain => hostname.endsWith("." + domain));

      if (!isAllowed) {
        return res.status(403).json({ error: "Domain not allowed in proxy" });
      }

      const response = await fetch(targetUrl, {
        method: method || "POST",
        headers: {
          ...headers,
          "host": undefined,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const contentType = response.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");

      if (isJson) {
        const data = await response.json();
        res.status(response.status).json(data);
      } else {
        // Handle binary data or plain text errors
        const buffer = await response.arrayBuffer();
        if (contentType) res.setHeader("Content-Type", contentType);
        res.status(response.status).send(Buffer.from(buffer));
      }
    } catch (error: any) {
      console.error("Proxy Error:", error);
      // Ensure we always return JSON on error
      res.status(500).json({ 
        error: error.message || "Internal Server Error",
        details: "An error occurred while proxying the request."
      });
    }
  };

  app.post("/api/proxy", proxyHandler);

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
