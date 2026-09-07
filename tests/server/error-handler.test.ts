import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../server/utils/error-handler";

function appWith(route?: (app: express.Express) => void) {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/echo", (req, res) => res.json(req.body));
  route?.(app);
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("answers a malformed JSON body with a fixed 400", async () => {
    const res = await request(appWith()).post("/echo").set("Content-Type", "application/json").send("{bad json");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Request body is not valid JSON" });
  });

  it("answers an oversized body with 413", async () => {
    const res = await request(appWith()).post("/echo").send({ pad: "x".repeat(2000) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: "Request body is too large" });
  });

  it("does not echo an internal error's message", async () => {
    const app = appWith((a) => a.get("/boom", () => { throw new Error("SELECT secret FROM users failed"); }));

    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Internal Server Error" });
  });

  it("keeps the connection usable after an error", async () => {
    const app = appWith();
    await request(app).post("/echo").set("Content-Type", "application/json").send("{bad json").expect(400);
    const res = await request(app).post("/echo").send({ ok: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
