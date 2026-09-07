import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import request from "supertest";
import cookieParser from "cookie-parser";
import * as resolveLanguageModule from "../../server/utils/resolve-language";
import { serveStatic } from "../../server/vite";

const publicDir = path.resolve(import.meta.dirname, "../../server/public");
const indexFile = path.resolve(publicDir, "index.html");

describe("serveStatic", () => {
  let createdDir = false;

  beforeAll(() => {
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
      createdDir = true;
    }
    fs.writeFileSync(indexFile, '<!DOCTYPE html><html lang="en"><body>Test</body></html>');
  });

  afterAll(() => {
    if (fs.existsSync(indexFile)) {
      fs.unlinkSync(indexFile);
    }
    if (createdDir && fs.existsSync(publicDir)) {
      fs.rmdirSync(publicDir);
    }
  });

  it("serves index.html with stamped language for unmatched routes", async () => {
    const app: Express = express();
    app.use(cookieParser());
    serveStatic(app);

    const res = await request(app).get("/some-page").set("Cookie", ["language=pl"]);
    expect(res.status).toBe(200);
    expect(res.text).toContain('<html lang="pl">');
  });

  it("forwards errors to next() when resolveLanguage rejects", async () => {
    const app: Express = express();
    serveStatic(app);

    // Custom error handler to verify next(err) was called
    let caughtError: any = null;
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      caughtError = err;
      res.status(500).json({ error: err.message });
    });

    vi.spyOn(resolveLanguageModule, "resolveLanguage").mockRejectedValueOnce(
      new Error("unexpected resolve failure"),
    );

    const res = await request(app).get("/another-page");
    expect(res.status).toBe(500);
    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError?.message).toBe("unexpected resolve failure");
  });
});
