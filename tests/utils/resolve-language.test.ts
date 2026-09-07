import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { generateToken } from "../../server/auth";
import { storage } from "../../server/storage";
import {
  resolveAnonymousLanguage,
  resolveLanguage,
  setHtmlLang,
} from "../../server/utils/resolve-language";

/** A GET that accepts HTML: the shape that actually gets a stamped shell. */
function req(overrides: Partial<Request> = {}): Request {
  return {
    cookies: {},
    headers: {},
    method: "GET",
    accepts: (type: string) => (type === "html" ? "html" : false),
    ...overrides,
  } as unknown as Request;
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

  // Both SPA catch-alls run for every method and every unmatched path. Only a
  // request that will actually be read as an HTML document is worth a JWT
  // verify plus a full user-row read.
  it("skips the session lookup for a request that is not a GET", async () => {
    const user = await createUser("de");
    const token = generateToken(user.id);
    const getUser = vi.spyOn(storage, "getUser");

    const r = req({ method: "POST", cookies: { token, language: "pl" } });
    expect(await resolveLanguage(r)).toBe("pl");
    expect(getUser).not.toHaveBeenCalled();
    getUser.mockRestore();
  });

  it("skips the session lookup for a GET that does not accept HTML", async () => {
    const user = await createUser("de");
    const token = generateToken(user.id);
    const getUser = vi.spyOn(storage, "getUser");

    const r = req({
      cookies: { token },
      headers: { "accept-language": "pl" },
      accepts: () => false,
    } as unknown as Partial<Request>);
    expect(await resolveLanguage(r)).toBe("pl");
    expect(getUser).not.toHaveBeenCalled();
    getUser.mockRestore();
  });
});

describe("resolveAnonymousLanguage", () => {
  // Registration and the account-recovery mails must not inherit the language
  // of whichever account still holds the browser's `token` cookie.
  it("ignores the session even when the token belongs to a real user", async () => {
    const user = await createUser("de");
    const token = generateToken(user.id);
    const getUser = vi.spyOn(storage, "getUser");

    const r = req({ cookies: { token }, headers: { "accept-language": "pl" } });
    expect(resolveAnonymousLanguage(r)).toBe("pl");
    expect(getUser).not.toHaveBeenCalled();
    getUser.mockRestore();
  });

  it("prefers the language cookie over Accept-Language", () => {
    const r = req({ cookies: { language: "pl" }, headers: { "accept-language": "de" } });
    expect(resolveAnonymousLanguage(r)).toBe("pl");
  });

  it("defaults to English", () => {
    expect(resolveAnonymousLanguage(req())).toBe("en");
  });
});

describe("setHtmlLang", () => {
  it("rewrites the html lang attribute", () => {
    expect(setHtmlLang('<!DOCTYPE html>\n<html lang="de">\n', "pl")).toContain('<html lang="pl">');
  });
});
