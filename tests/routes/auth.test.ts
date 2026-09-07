/**
 * Characterisation tests for server/routes/auth.ts.
 *
 * These record observable behaviour at the HTTP boundary, so that moving the
 * database access behind IStorage can be shown to change nothing. They are not
 * a specification: a behaviour change belongs in its own commit, together with
 * the test that pins it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { registerAuthRoutes } from "../../server/routes/auth";
import { hashPassword } from "../../server/auth";
import { storage } from "../../server/storage";
import { createApp, loginAs, registerAndVerify } from "../helpers/app";
import { lastMailTo, mailbox, tokenFromMail } from "../helpers/mailbox";

let app: Express;

beforeEach(() => {
  app = createApp(registerAuthRoutes);
});

// Mock credentials for a throwaway test database - not a real login anywhere, so
// the password below is safe to keep in the repository (hence the ggignore tag).
const alice = { username: "alice", email: "alice@example.com", password: "correct-horse" }; // ggignore

/** Runs `body` with the clock moved to `when`, faking Date only so that pg's own timers keep working. */
async function atTime(when: Date, body: () => Promise<void>) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(when);
  try {
    await body();
  } finally {
    vi.useRealTimers();
  }
}

describe("POST /api/auth/register", () => {
  it("creates an account and emails a verification link", async () => {
    const response = await request(app).post("/api/auth/register").send(alice);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      message: "Account created. Please check your email to verify your account.",
    });

    const mail = lastMailTo(alice.email);
    expect(mail).toBeDefined();
    expect(tokenFromMail(mail)).toMatch(/^[0-9a-f]{64}$/);
    expect(mail?.subject).toBe("Verify your email address");
  });

  it("emails the verification link in the language chosen during registration", async () => {
    const polishUser = {
      username: "pawel",
      email: "pawel@example.com",
      password: "some-strong-password-123",
    };
    await request(app)
      .post("/api/auth/register")
      .set("Cookie", ["language=pl"])
      .send(polishUser)
      .expect(201);

    const mail = lastMailTo(polishUser.email);
    expect(mail).toBeDefined();
    expect(mail?.subject).toBe("Potwierdź swój adres e-mail");
    expect(mail?.html).toContain("Witamy w Filadex!");

    // Resend also respects the user's stored language
    mailbox.length = 0;
    await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: polishUser.email })
      .expect(200);

    const resendMail = lastMailTo(polishUser.email);
    expect(resendMail).toBeDefined();
    expect(resendMail?.subject).toBe("Potwierdź swój adres e-mail");
  });

  // /register is reachable with a session already in the browser, so the new
  // account's language must come from the request, not from whoever that
  // `token` cookie belongs to.
  it("does not inherit the language of an account that is still signed in", async () => {
    const german = {
      username: "gerd",
      email: "gerd@example.com",
      password: "some-strong-password-123",
    };
    await request(app)
      .post("/api/auth/register")
      .set("Cookie", ["language=de"])
      .send(german)
      .expect(201);
    const germanSession = await (async () => {
      const token = tokenFromMail(lastMailTo(german.email));
      await request(app).get("/api/auth/verify-email").query({ token }).expect(200);
      return loginAs(app, german.username, german.password);
    })();

    mailbox.length = 0;
    const newcomer = {
      username: "nowicjusz",
      email: "nowicjusz@example.com",
      password: "some-strong-password-123",
    };
    await request(app)
      .post("/api/auth/register")
      .set("Cookie", [germanSession, "language=pl"])
      .send(newcomer)
      .expect(201);

    const mail = lastMailTo(newcomer.email);
    expect(mail?.subject).toBe("Potwierdź swój adres e-mail");
  });

  it("leaves the new account unable to log in until the email is verified", async () => {
    await request(app).post("/api/auth/register").send(alice).expect(201);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: alice.username, password: alice.password });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Please verify your email address before logging in");
  });

  it("rejects a username that already exists, ignoring case", async () => {
    await request(app).post("/api/auth/register").send(alice).expect(201);

    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...alice, username: "ALICE", email: "different@example.com" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Username already exists");
  });

  it("rejects an email that already exists, ignoring case", async () => {
    await request(app).post("/api/auth/register").send(alice).expect(201);

    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...alice, username: "someone-else", email: "ALICE@EXAMPLE.COM" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("An account with this email already exists");
  });

  it("stores the username with the capitalisation it was given", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ ...alice, username: "Alice" })
      .expect(201);

    const token = tokenFromMail(lastMailTo(alice.email))!;
    await request(app).get("/api/auth/verify-email").query({ token }).expect(200);
    const cookie = await loginAs(app, "Alice", alice.password);

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.body.username).toBe("Alice");
  });

  it.each([
    ["a username shorter than 3 characters", { username: "ab" }, "Username must be at least 3 characters"],
    ["a username longer than 30 characters", { username: "a".repeat(31) }, "Username must be at most 30 characters"],
    [
      "a username with punctuation",
      { username: "not.allowed" },
      "Username may only contain letters, numbers, underscores, and hyphens",
    ],
    ["an invalid email", { email: "nope" }, "Please enter a valid email address"],
    ["a password shorter than 8 characters", { password: "short" }, "Password must be at least 8 characters"],
  ])("rejects %s", async (_label, override, message) => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...alice, ...override });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(message);
    expect(mailbox).toHaveLength(0);
  });

  // The two encodings of `ü` - U+00FC, and `u` + U+0308 - render identically and
  // differ only in how the keyboard produced them. Everything below is one
  // account, or the person who registered with one spelling could not log in
  // with the other and a second account could take their name.
  describe("a username with diacritics", () => {
    const composed = "m\u00FCller";       // müller, precomposed
    const decomposed = "mu\u0308ller";    // müller, u + combining diaeresis

    it("registers, and is stored in the spelling the user typed", async () => {
      const cookie = await registerAndVerify(app, { ...alice, username: composed });

      const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
      expect(me.body.username).toBe(composed);
    });

    it("logs in whichever way the name is spelled or capitalised", async () => {
      await registerAndVerify(app, { ...alice, username: composed });

      for (const typed of [composed, decomposed, "M\u00DCLLER", "Mu\u0308LLER"]) {
        await expect(loginAs(app, typed, alice.password)).resolves.toBeTruthy();
      }
    });

    it.each([
      ["the other Unicode spelling", decomposed],
      ["a different capitalisation", "M\u00FCller"],
    ])("refuses a second account under %s", async (_label, taken) => {
      await registerAndVerify(app, { ...alice, username: composed });

      const response = await request(app)
        .post("/api/auth/register")
        .send({ username: taken, email: "someone-else@example.com", password: alice.password });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Username already exists");
    });

    it("reports the taken name as unavailable however it is spelled", async () => {
      await registerAndVerify(app, { ...alice, username: composed });

      for (const typed of [composed, decomposed, "M\u00DCLLER"]) {
        const response = await request(app).get("/api/auth/check-username").query({ username: typed });
        expect(response.body).toEqual({ available: false });
      }
    });
  });

  // Latin script, not \p{L}: Cyrillic \u0430 renders as `a`, so `\u0430dmin` beside
  // `admin` would be two accounts nobody can tell apart - including on the
  // public sharing page, which needs no login to view.
  it.each([
    ["a Cyrillic lookalike", "\u0430dmin"],
    ["Greek", "\u03B5\u03BB\u03BB\u03AC\u03B4\u03B1"],
    ["Han", "\u65E5\u672C\u8A9E"],
  ])("refuses %s", async (_label, username) => {
    const response = await request(app).post("/api/auth/register").send({ ...alice, username });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Username may only contain letters, numbers, underscores, and hyphens",
    );
  });

  it("counts characters, not code points, against the 30-character limit", async () => {
    // 30 decomposed umlauts are 60 code points before normalisation.
    const thirty = "u\u0308".repeat(30);

    await expect(
      registerAndVerify(app, { ...alice, username: thirty }),
    ).resolves.toBeTruthy();
  });

  it("defaults a self-registered account to the non-admin user role", async () => {
    const cookie = await registerAndVerify(app, alice);

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.body).toMatchObject({ role: "user", isAdmin: false, forceChangePassword: false });
  });
});

describe("GET /api/auth/check-username", () => {
  it("reports an unused username as available", async () => {
    const response = await request(app).get("/api/auth/check-username").query({ username: "vacant" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ available: true });
  });

  it("reports a taken username as unavailable, ignoring case", async () => {
    await request(app).post("/api/auth/register").send(alice).expect(201);

    const response = await request(app).get("/api/auth/check-username").query({ username: "ALICE" });

    expect(response.body).toEqual({ available: false });
  });

  it("answers 200 with a reason rather than an error for a malformed username", async () => {
    const response = await request(app).get("/api/auth/check-username").query({ username: "ab" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      available: false,
      reason: "Username must be at least 3 characters",
    });
  });

  it("treats a missing username as unavailable", async () => {
    const response = await request(app).get("/api/auth/check-username");

    expect(response.status).toBe(200);
    expect(response.body.available).toBe(false);
  });
});

describe("GET /api/auth/verify-email", () => {
  it("verifies the account so it can log in", async () => {
    await request(app).post("/api/auth/register").send(alice).expect(201);
    const token = tokenFromMail(lastMailTo(alice.email))!;

    const response = await request(app).get("/api/auth/verify-email").query({ token });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Email verified successfully. You can now log in.");
    await expect(loginAs(app, alice.username, alice.password)).resolves.toBeTruthy();
  });

  it("consumes the token, so the same link cannot be used twice", async () => {
    await request(app).post("/api/auth/register").send(alice).expect(201);
    const token = tokenFromMail(lastMailTo(alice.email))!;
    await request(app).get("/api/auth/verify-email").query({ token }).expect(200);

    const response = await request(app).get("/api/auth/verify-email").query({ token });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("This verification link is invalid or has expired");
  });

  it("rejects a missing token", async () => {
    const response = await request(app).get("/api/auth/verify-email");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid verification link");
  });

  it("rejects an unknown token", async () => {
    const response = await request(app).get("/api/auth/verify-email").query({ token: "not-a-real-token" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("This verification link is invalid or has expired");
  });

  it("rejects a token older than 24 hours", async () => {
    await atTime(new Date("2026-01-01T00:00:00Z"), async () => {
      await request(app).post("/api/auth/register").send(alice).expect(201);
    });
    const token = tokenFromMail(lastMailTo(alice.email))!;

    const response = await request(app).get("/api/auth/verify-email").query({ token });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("This verification link is invalid or has expired");
  });
});

describe("POST /api/auth/resend-verification", () => {
  const generic =
    "If an account with that email exists and isn't verified yet, a new verification email has been sent.";

  it("issues a fresh token that verifies the account", async () => {
    await request(app).post("/api/auth/register").send(alice).expect(201);
    const firstToken = tokenFromMail(lastMailTo(alice.email))!;

    const response = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: alice.email });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(generic);

    const secondToken = tokenFromMail(lastMailTo(alice.email))!;
    expect(secondToken).not.toBe(firstToken);
    await request(app).get("/api/auth/verify-email").query({ token: secondToken }).expect(200);
  });

  it("invalidates the previous token when a new one is issued", async () => {
    await request(app).post("/api/auth/register").send(alice).expect(201);
    const firstToken = tokenFromMail(lastMailTo(alice.email))!;
    await request(app).post("/api/auth/resend-verification").send({ email: alice.email }).expect(200);

    const response = await request(app).get("/api/auth/verify-email").query({ token: firstToken });

    expect(response.status).toBe(400);
  });

  it("finds the account regardless of the case of the email", async () => {
    await request(app).post("/api/auth/register").send(alice).expect(201);
    mailbox.length = 0;

    await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "ALICE@EXAMPLE.COM" })
      .expect(200);

    expect(mailbox).toHaveLength(1);
  });

  it("says the same thing, and sends nothing, for an unknown email", async () => {
    const response = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "nobody@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(generic);
    expect(mailbox).toHaveLength(0);
  });

  it("says the same thing, and sends nothing, for an already-verified account", async () => {
    await registerAndVerify(app, alice);
    mailbox.length = 0;

    const response = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: alice.email });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(generic);
    expect(mailbox).toHaveLength(0);
  });

  it("rejects a malformed email", async () => {
    const response = await request(app).post("/api/auth/resend-verification").send({ email: "nope" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Please enter a valid email address");
  });
});

describe("POST /api/auth/forgot-password", () => {
  const generic = "If an account with that email exists, a password reset link has been sent.";

  it("emails a reset link to an existing account", async () => {
    await registerAndVerify(app, alice);
    mailbox.length = 0;

    const response = await request(app).post("/api/auth/forgot-password").send({ email: alice.email });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(generic);
    expect(tokenFromMail(lastMailTo(alice.email))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("finds the account regardless of the case of the email", async () => {
    await registerAndVerify(app, alice);
    mailbox.length = 0;

    await request(app).post("/api/auth/forgot-password").send({ email: "Alice@Example.COM" }).expect(200);

    expect(mailbox).toHaveLength(1);
  });

  it("says the same thing, and sends nothing, for an unknown email", async () => {
    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(generic);
    expect(mailbox).toHaveLength(0);
  });

  it("rejects a malformed email", async () => {
    const response = await request(app).post("/api/auth/forgot-password").send({ email: "nope" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Please enter a valid email address");
  });
});

describe("POST /api/auth/reset-password", () => {
  async function requestReset(): Promise<string> {
    await registerAndVerify(app, alice);
    mailbox.length = 0;
    await request(app).post("/api/auth/forgot-password").send({ email: alice.email }).expect(200);
    return tokenFromMail(lastMailTo(alice.email))!;
  }

  it("changes the password so the new one works and the old one does not", async () => {
    const token = await requestReset();

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "brand-new-password" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe(
      "Password reset successfully. You can now log in with your new password.",
    );

    await expect(loginAs(app, alice.username, "brand-new-password")).resolves.toBeTruthy();
    await request(app)
      .post("/api/auth/login")
      .send({ username: alice.username, password: alice.password })
      .expect(401);
  });

  it("consumes the token, so the same link cannot be used twice", async () => {
    const token = await requestReset();
    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "brand-new-password" })
      .expect(200);

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "another-password" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("This reset link is invalid or has expired");
  });

  it("rejects an unknown token", async () => {
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "not-a-real-token", newPassword: "brand-new-password" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("This reset link is invalid or has expired");
  });

  it("rejects a token older than an hour", async () => {
    await registerAndVerify(app, alice);
    mailbox.length = 0;
    await atTime(new Date("2026-01-01T00:00:00Z"), async () => {
      await request(app).post("/api/auth/forgot-password").send({ email: alice.email }).expect(200);
    });
    const token = tokenFromMail(lastMailTo(alice.email))!;

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "brand-new-password" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("This reset link is invalid or has expired");
  });

  it.each([
    ["an empty token", { token: "" }, "Reset token is required"],
    ["a password shorter than 8 characters", { newPassword: "short" }, "Password must be at least 8 characters"],
  ])("rejects %s", async (_label, override, message) => {
    const token = await requestReset();

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "brand-new-password", ...override });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(message);
  });
});

describe("POST /api/auth/login", () => {
  it("returns the user without their password hash and sets a session cookie", async () => {
    await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: alice.username, password: alice.password });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ username: alice.username, email: alice.email });
    expect(response.body.user).not.toHaveProperty("password");
    expect(response.body.forceChangePassword).toBe(false);
    expect(response.headers["set-cookie"][0]).toMatch(/^token=/);
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
  });

  it("records the login time", async () => {
    const cookie = await registerAndVerify(app, alice);

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.body.lastLogin).not.toBeNull();
  });

  it("rejects a wrong password", async () => {
    await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: alice.username, password: "wrong" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid credentials");
  });

  it("rejects an unknown username", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "nobody", password: "whatever" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid credentials");
  });

  // Registration treats usernames as case-insensitive - "ALICE" cannot register
  // once "alice" exists - so "ALICE" has to be a way to log in as "alice".
  it("logs in a username that differs only in case", async () => {
    await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "ALICE", password: alice.password });

    expect(response.status).toBe(200);
    expect(response.body.user.username).toBe("alice");
  });

  it("logs in an account registered with capitals, whatever case is typed", async () => {
    await registerAndVerify(app, { ...alice, username: "Alice" });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "alice", password: alice.password });

    expect(response.status).toBe(200);
    expect(response.body.user.username).toBe("Alice");
  });

  it("still rejects a wrong password when the case differs", async () => {
    await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "ALICE", password: "wrong" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid credentials");
  });
});

describe("GET /api/auth/me", () => {
  it("rejects a request with no session cookie", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });

  it("rejects a malformed token", async () => {
    const response = await request(app).get("/api/auth/me").set("Cookie", "token=garbage");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid or expired token");
  });

  it("returns the signed-in user without their password hash", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      username: alice.username,
      email: alice.email,
      role: "user",
      emailVerified: true,
    });
    expect(response.body).not.toHaveProperty("password");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Logged out successfully");
    expect(response.headers["set-cookie"][0]).toMatch(/^token=;/);
  });
});

describe("POST /api/auth/change-password", () => {
  it("rejects a request with no session cookie", async () => {
    const response = await request(app)
      .post("/api/auth/change-password")
      .send({ currentPassword: alice.password, newPassword: "brand-new-password" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });

  it("changes the password so the new one works and the old one does not", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: alice.password, newPassword: "brand-new-password" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Password updated successfully");

    await expect(loginAs(app, alice.username, "brand-new-password")).resolves.toBeTruthy();
    await request(app)
      .post("/api/auth/login")
      .send({ username: alice.username, password: alice.password })
      .expect(401);
  });

  it("rejects a wrong current password", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "wrong", newPassword: "brand-new-password" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Current password is incorrect");
  });

  it("rejects a new password shorter than 8 characters", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      // A deliberately too-short mock password, not a real credential.
      .send({ currentPassword: alice.password, newPassword: "abcdefg" }); // ggignore

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid input");
  });

  it("accepts a new password of exactly 8 characters", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      // A deliberately minimal-length mock password, not a real credential.
      .send({ currentPassword: alice.password, newPassword: "abcdefgh" }); // ggignore

    expect(response.status).toBe(200);
    await expect(loginAs(app, alice.username, "abcdefgh")).resolves.toBeTruthy();
  });

  // The length rule binds a password being set, not one already stored, so an
  // account whose password predates the rule keeps working at login.
  it("still lets a user with a short stored password log in", async () => {
    const shortPassword = "abcde"; // ggignore - too short for today's rule, seeded directly
    await storage.createUser({
      username: "shorty",
      password: await hashPassword(shortPassword),
      email: "shorty@example.com",
      role: "user",
      isAdmin: false,
      emailVerified: true,
      forceChangePassword: false,
    });

    await expect(loginAs(app, "shorty", shortPassword)).resolves.toBeTruthy();
  });
});
