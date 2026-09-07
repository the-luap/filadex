import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import request from "supertest";
import cookieParser from "cookie-parser";
import * as resolveLanguageModule from "../../server/utils/resolve-language";
import { serveStatic } from "../../server/vite";
import { registerApiNotFound } from "../../server/routes/not-found";

const publicDir = path.resolve(import.meta.dirname, "../../server/public");
const indexFile = path.resolve(publicDir, "index.html");

// serveStatic resolves its directory relative to the server source, so the
// fixture has to live at the real build path. Anything already there is a real
// build: put it back rather than deleting it out from under the developer.
describe("serveStatic", () => {
  let createdDir = false;
  let previousIndex: string | null = null;

  beforeAll(() => {
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
      createdDir = true;
    }
    previousIndex = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, "utf-8") : null;
    fs.writeFileSync(indexFile, '<!DOCTYPE html><html lang="en"><body>Test</body></html>');
  });

  afterAll(() => {
    if (previousIndex !== null) {
      fs.writeFileSync(indexFile, previousIndex);
    } else if (fs.existsSync(indexFile)) {
      fs.unlinkSync(indexFile);
    }
    if (createdDir && fs.existsSync(publicDir)) {
      fs.rmSync(publicDir, { recursive: true, force: true });
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

  it("stamps the language on an explicit /index.html request too", async () => {
    const app: Express = express();
    app.use(cookieParser());
    serveStatic(app);

    const res = await request(app).get("/index.html").set("Cookie", ["language=pl"]);
    expect(res.status).toBe(200);
    expect(res.text).toContain('<html lang="pl">');
  });

  it("marks the shell as per-visitor and revalidated, and answers If-None-Match", async () => {
    const app: Express = express();
    app.use(cookieParser());
    serveStatic(app);

    const res = await request(app).get("/some-page").set("Cookie", ["language=pl"]);
    expect(res.headers["vary"]).toContain("Cookie");
    expect(res.headers["vary"]).toContain("Accept-Language");
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.headers["etag"]).toBeDefined();

    const revalidated = await request(app)
      .get("/some-page")
      .set("Cookie", ["language=pl"])
      .set("If-None-Match", res.headers["etag"]);
    expect(revalidated.status).toBe(304);
  });

  it("does not serve the shell to an /api path once the API 404 is mounted ahead of it", async () => {
    const app: Express = express();
    app.use(cookieParser());
    registerApiNotFound(app);
    serveStatic(app);

    const typo = await request(app).get("/api/auth/mee");
    expect(typo.status).toBe(404);
    expect(typo.body).toEqual({ message: "Not found" });

    const page = await request(app).get("/some-page");
    expect(page.status).toBe(200);
    expect(page.text).toContain("<html lang=");
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
