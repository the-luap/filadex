import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

/**
 * The last handler. Answers with a fixed message per class of error and logs
 * the rest server-side.
 *
 * The previous version rethrew after responding. Express caught that, saw the
 * headers were already sent, destroyed the socket and printed the stack -
 * on every malformed JSON body. It also echoed body-parser's message, which
 * is a detail about the parser, not about the request.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const error = (err ?? {}) as { status?: number; statusCode?: number; type?: string; message?: string };
  const status = error.status || error.statusCode || 500;

  if (res.headersSent) {
    return;
  }

  if (error.type === "entity.parse.failed") {
    res.status(400).json({ message: "Request body is not valid JSON" });
    return;
  }
  if (error.type === "entity.too.large" || status === 413) {
    res.status(413).json({ message: "Request body is too large" });
    return;
  }
  if (status >= 500) {
    logger.error("Unhandled error:", err);
    res.status(status).json({ message: "Internal Server Error" });
    return;
  }

  res.status(status).json({ message: error.message || "Request failed" });
}
