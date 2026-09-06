import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";

const verifyToken = vi.fn();
const getUser = vi.fn();

vi.mock("../../server/auth", () => ({ verifyToken: (t: unknown) => verifyToken(t) }));
vi.mock("../../server/storage", () => ({ storage: { getUser: (id: unknown) => getUser(id) } }));

import { resolveLanguage, setHtmlLang } from "../../server/utils/resolve-language";

function req(overrides: Partial<Request> = {}): Request {
  return { cookies: {}, headers: {}, ...overrides } as unknown as Request;
}

beforeEach(() => {
  verifyToken.mockReset().mockReturnValue(null);
  getUser.mockReset();
});

describe("resolveLanguage", () => {
  it("prefers a supported language cookie", async () => {
    expect(await resolveLanguage(req({ cookies: { language: "pl" } }))).toBe("pl");
  });

  it("ignores an unsupported language cookie", async () => {
    const r = req({ cookies: { language: "fr" }, headers: { "accept-language": "de-DE,de" } });
    expect(await resolveLanguage(r)).toBe("de");
  });

  it("falls back to the logged-in user's stored preference", async () => {
    verifyToken.mockReturnValue(7);
    getUser.mockResolvedValue({ language: "de" });
    expect(await resolveLanguage(req({ cookies: { token: "jwt" } }))).toBe("de");
  });

  it("uses Accept-Language when there is no cookie or user preference", async () => {
    const r = req({ headers: { "accept-language": "fr-FR,fr;q=0.9,pl;q=0.8" } });
    expect(await resolveLanguage(r)).toBe("pl");
  });

  it("defaults to English", async () => {
    expect(await resolveLanguage(req())).toBe("en");
  });

  it("does not fail if the user lookup throws", async () => {
    verifyToken.mockReturnValue(7);
    getUser.mockRejectedValue(new Error("db down"));
    expect(await resolveLanguage(req({ cookies: { token: "jwt" } }))).toBe("en");
  });
});

describe("setHtmlLang", () => {
  it("rewrites the html lang attribute", () => {
    expect(setHtmlLang('<!DOCTYPE html>\n<html lang="de">\n', "pl")).toContain('<html lang="pl">');
  });
});
