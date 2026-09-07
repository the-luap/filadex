/**
 * Every /api path no route claims is a JSON 404, for every method. Before
 * registerApiNotFound existed, such a request fell through to the SPA
 * catch-all and was answered with the HTML shell and a 200 (#25).
 */
import { describe, expect, it } from "vitest";
import request from "supertest";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerApiNotFound } from "../../server/routes/not-found";
import { createApp } from "../helpers/app";

const app = createApp(registerAuthRoutes, registerApiNotFound);

describe("an /api path no route claims", () => {
  it("is a JSON 404 for a GET", async () => {
    const res = await request(app).get("/api/auth/mee");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ message: "Not found" });
  });

  it("is a JSON 404 for a POST too", async () => {
    const res = await request(app).post("/api/filaments/typo").send({});

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Not found" });
  });

  it("does not shadow a route that does exist", async () => {
    const res = await request(app).get("/api/auth/me");

    // 401, not 404: the route answered, and it wanted a session.
    expect(res.status).toBe(401);
  });

  it("leaves paths outside /api alone", async () => {
    const res = await request(app).get("/some-page");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({});
  });
});
