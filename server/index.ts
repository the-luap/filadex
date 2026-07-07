import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { registerRoutes } from "./routes/index";
import { setupVite, serveStatic, log } from "./vite";
import { runScheduledChecks } from "./utils/notification-checks";
import { logger } from "./utils/logger";

const app = express();

// Only trust X-Forwarded-For when explicitly told to (i.e. the deployer knows
// there's a trusted reverse proxy in front, e.g. running behind Traefik/Nginx
// for a SaaS deployment). Enabling this unconditionally would let a direct
// client spoof its IP via that header and bypass the rate limiters below.
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

// contentSecurityPolicy is disabled: a correct CSP for the Vite dev server's
// inline/HMR scripts needs careful nonce/hash setup this pass doesn't cover;
// shipping a broken CSP would break the app, so we keep helmet's other
// baseline headers (X-Frame-Options, X-Content-Type-Options, etc.) instead.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT environment variable or default to 5000
  // For local Docker deployment, use port 10200
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: process.platform === "linux",
  }, () => {
    log(`serving on port ${port}`);
  });

  // Low-stock / drying-reminder email checks, every 6h. This app has no job
  // queue; a plain interval is enough at this scale (see IMPLEMENTATION_PLAN.md #2).
  const SCHEDULED_CHECKS_INTERVAL_MS = 6 * 60 * 60 * 1000;
  setInterval(() => {
    runScheduledChecks().catch((error) => logger.error("Scheduled notification check failed:", error));
  }, SCHEDULED_CHECKS_INTERVAL_MS);
})();
