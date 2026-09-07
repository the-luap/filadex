import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { generateToken } from "../../server/auth";
import { storage } from "../../server/storage";
import { resolveLanguage, setHtmlLang } from "../../server/utils/resolve-language";

function req(overrides: Partial<Request> = {}): Request {
  return { cookies: {}, headers: {}, ...overrides } as unknown as Request;
}

async function createUser(language: string) {
  return await storage.createUser({
    username: `user-${Math.random().toString(36).slice(2, 8)}`,
    password: "hashedpassword",
    email: `${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: "user",
    isAdmin: false,
    emailVerified: true,
    forceChangePassword: false,
    language,
  });
}

describe("resolveLanguage", () => {
  it("prefers the logged-in user's stored preference over a cookie", async () => {
    const user = await createUser("de");
    const token = generateToken(user.id);
    const r = req({
      cookies: { token, language: "pl" },
    });
    expect(await resolveLanguage(r)).toBe("de");
  });

  it("prefers a supported language cookie when there is no authenticated user", async () => {
    expect(await resolveLanguage(req({ cookies: { language: "pl" } }))).toBe("pl");
  });

  it("ignores an unsupported language cookie", async () => {
    const r = req({ cookies: { language: "fr" }, headers: { "accept-language": "de-DE,de" } });
    expect(await resolveLanguage(r)).toBe("de");
  });

  it("falls back to cookie if the user has an unsupported language stored", async () => {
    const user = await createUser("fr");
    const token = generateToken(user.id);
    const r = req({ cookies: { token, language: "pl" } });
    expect(await resolveLanguage(r)).toBe("pl");
  });

  it("uses Accept-Language when there is no cookie or user preference", async () => {
    const r = req({ headers: { "accept-language": "fr-FR,fr;q=0.9,pl;q=0.8" } });
    expect(await resolveLanguage(r)).toBe("pl");
  });

  it("defaults to English", async () => {
    expect(await resolveLanguage(req())).toBe("en");
  });

  it("does not fail if the user lookup throws", async () => {
    const user = await createUser("de");
    const token = generateToken(user.id);
    vi.spyOn(storage, "getUser").mockRejectedValueOnce(new Error("db down"));
    expect(await resolveLanguage(req({ cookies: { token, language: "pl" } }))).toBe("pl");
  });
});

describe("setHtmlLang", () => {
  it("rewrites the html lang attribute", () => {
    expect(setHtmlLang('<!DOCTYPE html>\n<html lang="de">\n', "pl")).toContain('<html lang="pl">');
  });
});
