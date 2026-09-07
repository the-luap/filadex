import type { Express } from "express";

/**
 * Answers 404 as JSON for any /api path no route claimed, for every method.
 *
 * Mounted after the last route module and before the SPA catch-all. Without it
 * a mistyped API path fell through to the catch-all and came back as the HTML
 * shell with a 200, which no client can tell from success without reading the
 * body, and which the request log records as a success.
 */
export function registerApiNotFound(app: Express): void {
  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });
}
