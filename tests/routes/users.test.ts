/**
 * Characterisation tests for server/routes/users.ts.
 *
 * These record observable behaviour at the HTTP boundary, so that moving the
 * database access behind IStorage can be shown to change nothing. They are not
 * a specification: a behaviour change belongs in its own commit, together with
 * the test that pins it.
 */
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { registerAuthRoutes } from "../../server/routes/auth";
import { registerUserRoutes } from "../../server/routes/users";
import { hashPassword, initializeAdminUser } from "../../server/auth";
import { storage } from "../../server/storage";
import { db } from "../helpers/db";
import { materials } from "../../shared/schema";
import { createApp, loginAs, registerAndVerify, bootstrapAdmin } from "../helpers/app";

let app: Express;
let adminCookie: string;

// Mock credentials for a throwaway test database - not a real login anywhere, so
// the password below is safe to keep in the repository (hence the ggignore tag).
const alice = { username: "alice", email: "alice@example.com", password: "correct-horse" }; // ggignore

beforeEach(async () => {
  app = createApp(registerAuthRoutes, registerUserRoutes);
  // The only way an installation gets its first admin; password is hard-coded.
  await bootstrapAdmin();
  adminCookie = await loginAs(app, "admin", "admin");
});

/** Creates a user through the admin API and returns their id and a session cookie. */
async function createUserAsAdmin(body: Record<string, unknown>) {
  const response = await request(app).post("/api/users").set("Cookie", adminCookie).send(body);
  expect(response.status).toBe(201);
  return response.body as {
    id: number;
    username: string;
    isAdmin: boolean;
    role: string;
    forceChangePassword: boolean;
  };
}

async function currentUser(cookie: string) {
  const response = await request(app).get("/api/auth/me").set("Cookie", cookie);
  expect(response.status).toBe(200);
  return response.body;
}

describe("the default admin bootstrap", () => {
  // The username namespace is case-insensitive everywhere else - registration,
  // admin creation and now login - so the bootstrap has to see "Admin" as the
  // admin account too. Creating a second row differing only in case would make
  // the login lookup ambiguous.
  it("does not add a second admin when one exists under different capitalisation", async () => {
    const listed = await request(app).get("/api/users").set("Cookie", adminCookie);
    const admin = listed.body.find((user: { username: string }) => user.username === "admin");
    await request(app)
      .put(`/api/users/${admin.id}`)
      .set("Cookie", adminCookie)
      .send({ username: "Admin" })
      .expect(200);

    await bootstrapAdmin();

    const after = await request(app).get("/api/users").set("Cookie", adminCookie);
    expect(after.body.map((user: { username: string }) => user.username)).toEqual(["Admin"]);
  });
});

describe("an account that must still change its password", () => {
  // The flag used to be enforced only by a redirect in the login page, so a
  // session for admin/admin could drive every route while the password was
  // still admin.
  it("is refused every route but the password change, then admitted", async () => {
    await createUserAsAdmin({ username: "bob", password: "bobs-password" });
    const cookie = await loginAs(app, "bob", "bobs-password");

    const refused = await request(app).post("/api/users/language").set("Cookie", cookie).send({ language: "de" });
    expect(refused.status).toBe(403);
    expect(refused.body).toEqual({
      message: "You must change your password before continuing",
      code: "PASSWORD_CHANGE_REQUIRED",
    });

    // What the change-password page itself needs still works.
    await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);

    const changed = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: "bobs-password", newPassword: "bobs-own-password" })
      .expect(200);

    // The change invalidates the sessions issued before it, this one included,
    // and answers with a fresh cookie so the page can carry straight on.
    const fresh = changed.headers["set-cookie"][0];
    expect(fresh).toMatch(/^token=/);
    await request(app).post("/api/users/language").set("Cookie", fresh).send({ language: "de" }).expect(200);
  });
});

describe("initializeAdminUser", () => {
  it("does not bring admin/admin back once the bootstrap account has been renamed", async () => {
    const admins = await request(app).get("/api/users").set("Cookie", adminCookie);
    const admin = admins.body.find((user: { role: string }) => user.role === "admin");

    await request(app).put(`/api/users/${admin.id}`).set("Cookie", adminCookie).send({ username: "paul" }).expect(200);

    // What every startup runs. It used to look for an account *named* admin.
    await initializeAdminUser();

    const after = await request(app).get("/api/users").set("Cookie", adminCookie);
    expect(after.body.map((user: { username: string }) => user.username)).toEqual(["paul"]);
    await request(app).post("/api/auth/login").send({ username: "admin", password: "admin" }).expect(401);
  });

  it("still creates the default admin on an install with no admin at all", async () => {
    const admins = await request(app).get("/api/users").set("Cookie", adminCookie);
    const admin = admins.body.find((user: { role: string }) => user.role === "admin");
    await storage.deleteUser(admin.id);

    await initializeAdminUser();

    const created = await storage.getUserByUsername("admin");
    expect(created).toMatchObject({ role: "admin", forceChangePassword: true });
  });
});

describe("a session issued before an admin set a new password", () => {
  it("is refused", async () => {
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password", forceChangePassword: false });
    const cookie = await loginAs(app, "bob", "bobs-password");

    // Two seconds on, so the token's whole-second iat is unambiguously earlier.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2_000);
    try {
      // Throwaway test-database credential, not a real login anywhere (hence the ggignore tag).
      await request(app).put(`/api/users/${bob.id}`).set("Cookie", adminCookie).send({ password: "set-by-admin-1" }).expect(200); // ggignore

      const response = await request(app).get("/api/auth/me").set("Cookie", cookie);
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Session expired because the password was changed");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("POST /api/users/language", () => {
  it("rejects a request with no session cookie", async () => {
    const response = await request(app).post("/api/users/language").send({ language: "de" });

    expect(response.status).toBe(401);
  });

  it.each(["en", "de", "pl"])("stores the %s preference", async (language) => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app).post("/api/users/language").set("Cookie", cookie).send({ language });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Language preference updated successfully");
    expect((await currentUser(cookie)).language).toBe(language);
  });

  it.each([["fr"], [undefined], [""]])("rejects %s", async (language) => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app).post("/api/users/language").set("Cookie", cookie).send({ language });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid language. Supported languages are 'en', 'de' and 'pl'.");
  });
});

describe("POST /api/users/units", () => {
  it("rejects a request with no session cookie", async () => {
    const response = await request(app).post("/api/users/units").send({ currency: "USD" });

    expect(response.status).toBe(401);
  });

  it("stores currency and temperature unit together", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/users/units")
      .set("Cookie", cookie)
      .send({ currency: "PLN", temperatureUnit: "F" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Units preferences updated successfully");
    expect(await currentUser(cookie)).toMatchObject({ currency: "PLN", temperatureUnit: "F" });
  });

  it("rejects an unsupported currency", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/users/units")
      .set("Cookie", cookie)
      .send({ currency: "XYZ" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/^Invalid currency\. Supported currencies are: EUR, USD/);
    expect((await currentUser(cookie)).currency).toBe("EUR");
  });

  it("rejects an unsupported temperature unit", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/users/units")
      .set("Cookie", cookie)
      .send({ temperatureUnit: "K" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid temperature unit. Supported units are 'C' and 'F'.");
  });

  it("accepts an empty body and changes nothing", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app).post("/api/users/units").set("Cookie", cookie).send({});

    expect(response.status).toBe(200);
    expect(await currentUser(cookie)).toMatchObject({ currency: "EUR", temperatureUnit: "C" });
  });
});

describe("POST /api/users/notification-preferences", () => {
  it("rejects a request with no session cookie", async () => {
    const response = await request(app)
      .post("/api/users/notification-preferences")
      .send({ notifyLowStock: false });

    expect(response.status).toBe(401);
  });

  it("stores every preference at once", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/users/notification-preferences")
      .set("Cookie", cookie)
      .send({
        lowStockThresholdPercent: 42,
        notifyLowStock: false,
        notifyDryingReminder: false,
        dryingReminderDays: 7,
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Notification preferences updated successfully");
    expect(await currentUser(cookie)).toMatchObject({
      lowStockThresholdPercent: 42,
      notifyLowStock: false,
      notifyDryingReminder: false,
      dryingReminderDays: 7,
    });
  });

  it.each([
    ["a threshold below 0", { lowStockThresholdPercent: -1 }, "lowStockThresholdPercent must be a number between 0 and 100"],
    ["a threshold above 100", { lowStockThresholdPercent: 101 }, "lowStockThresholdPercent must be a number between 0 and 100"],
    ["a non-numeric threshold", { lowStockThresholdPercent: "high" }, "lowStockThresholdPercent must be a number between 0 and 100"],
    ["a non-boolean notifyLowStock", { notifyLowStock: "yes" }, "notifyLowStock must be a boolean"],
    ["a non-boolean notifyDryingReminder", { notifyDryingReminder: 1 }, "notifyDryingReminder must be a boolean"],
    ["fewer than one drying reminder day", { dryingReminderDays: 0 }, "dryingReminderDays must be a positive number"],
  ])("rejects %s", async (_label, body, message) => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/users/notification-preferences")
      .set("Cookie", cookie)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(message);
  });

  it("accepts an empty body and changes nothing", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/users/notification-preferences")
      .set("Cookie", cookie)
      .send({});

    expect(response.status).toBe(200);
    expect(await currentUser(cookie)).toMatchObject({
      lowStockThresholdPercent: 15,
      notifyLowStock: true,
      notifyDryingReminder: true,
      dryingReminderDays: 30,
    });
  });
});

describe("GET /api/users", () => {
  it("rejects a request with no session cookie", async () => {
    const response = await request(app).get("/api/users");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });

  it("rejects a non-admin", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app).get("/api/users").set("Cookie", cookie);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Insufficient privileges");
  });

  it("lists every account without password hashes", async () => {
    await registerAndVerify(app, alice);

    const response = await request(app).get("/api/users").set("Cookie", adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.map((user: { username: string }) => user.username).sort()).toEqual([
      "admin",
      "alice",
    ]);
    for (const user of response.body) {
      expect(user).not.toHaveProperty("password");
    }
  });
});

describe("POST /api/users", () => {
  it("rejects a non-admin", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app)
      .post("/api/users")
      .set("Cookie", cookie)
      .send({ username: "intruder", password: "some-password" });

    expect(response.status).toBe(403);
  });

  it("creates an account that can log in straight away, with no email verification", async () => {
    const created = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

    expect(created).toMatchObject({
      username: "bob",
      isAdmin: false,
      role: "user",
      forceChangePassword: true,
    });
    expect(created).not.toHaveProperty("password");

    const cookie = await loginAs(app, "bob", "bobs-password");
    expect(await currentUser(cookie)).toMatchObject({ emailVerified: true, email: null });
  });

  it("creates an admin when asked, keeping role and isAdmin in step", async () => {
    const created = await createUserAsAdmin({
      username: "root",
      password: "roots-password",
      isAdmin: true,
      forceChangePassword: false,
    });

    expect(created).toMatchObject({ isAdmin: true, role: "admin" });

    const cookie = await loginAs(app, "root", "roots-password");
    await request(app).get("/api/users").set("Cookie", cookie).expect(200);
  });

  it("can opt the new account out of the forced password change", async () => {
    const created = await createUserAsAdmin({
      username: "bob",
      password: "bobs-password",
      forceChangePassword: false,
    });

    expect(created.forceChangePassword).toBe(false);
  });

  it("rejects a username that already exists, ignoring case", async () => {
    await createUserAsAdmin({ username: "bob", password: "bobs-password" });

    const response = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ username: "BOB", password: "another-password" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Username already exists");
  });

  it.each([
    ["no password", { username: "bob" }, "Password is required"],
    ["a password shorter than 8 characters", { username: "bob", password: "short" }, "Password must be at least 8 characters"],
    ["a username shorter than 3 characters", { username: "ab", password: "bobs-password" }, "Username must be at least 3 characters"],
    ["a username with punctuation", { username: "not.allowed", password: "bobs-password" }, "Username may only contain letters, numbers, underscores, and hyphens"],
  ])("rejects %s, applying the same rules as self-registration", async (_label, body, message) => {
    const response = await request(app).post("/api/users").set("Cookie", adminCookie).send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(message);
  });
});

describe("PUT /api/users/:id", () => {
  it("rejects a non-admin", async () => {
    const cookie = await registerAndVerify(app, alice);
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

    const response = await request(app)
      .put(`/api/users/${bob.id}`)
      .set("Cookie", cookie)
      .send({ username: "bobby" });

    expect(response.status).toBe(403);
  });

  it("rejects an id that is not a number", async () => {
    const response = await request(app)
      .put("/api/users/not-a-number")
      .set("Cookie", adminCookie)
      .send({ username: "bobby" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid user ID");
  });

  it("reports an unknown user as not found", async () => {
    const response = await request(app)
      .put("/api/users/9999")
      .set("Cookie", adminCookie)
      .send({ username: "bobby" });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found");
  });

  it("renames a user", async () => {
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

    const response = await request(app)
      .put(`/api/users/${bob.id}`)
      .set("Cookie", adminCookie)
      .send({ username: "bobby" });

    expect(response.status).toBe(200);
    expect(response.body.username).toBe("bobby");
    await expect(loginAs(app, "bobby", "bobs-password")).resolves.toBeTruthy();
  });

  it("rejects a rename onto another user's name, ignoring case", async () => {
    await createUserAsAdmin({ username: "bob", password: "bobs-password" });
    const carol = await createUserAsAdmin({ username: "carol", password: "carols-password" });

    const response = await request(app)
      .put(`/api/users/${carol.id}`)
      .set("Cookie", adminCookie)
      .send({ username: "BOB" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Username already exists");
  });

  it("applies a rename that only changes capitalisation", async () => {
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

    const response = await request(app)
      .put(`/api/users/${bob.id}`)
      .set("Cookie", adminCookie)
      .send({ username: "Bob" });

    expect(response.status).toBe(200);
    expect(response.body.username).toBe("Bob");

    const listed = await request(app).get("/api/users").set("Cookie", adminCookie);
    expect(listed.body.map((user: { username: string }) => user.username)).toContain("Bob");
  });

  it("changes a user's password", async () => {
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

    await request(app)
      .put(`/api/users/${bob.id}`)
      .set("Cookie", adminCookie)
      .send({ password: "a-new-password" })
      .expect(200);

    await expect(loginAs(app, "bob", "a-new-password")).resolves.toBeTruthy();
    await request(app)
      .post("/api/auth/login")
      .send({ username: "bob", password: "bobs-password" })
      .expect(401);
  });

  it("promotes a user to admin", async () => {
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password", forceChangePassword: false });

    const response = await request(app)
      .put(`/api/users/${bob.id}`)
      .set("Cookie", adminCookie)
      .send({ isAdmin: true });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ isAdmin: true, role: "admin" });

    const cookie = await loginAs(app, "bob", "bobs-password");
    await request(app).get("/api/users").set("Cookie", cookie).expect(200);
  });

  it("refuses to demote the only admin", async () => {
    const admins = await request(app).get("/api/users").set("Cookie", adminCookie);
    const admin = admins.body.find((user: { role: string }) => user.role === "admin");

    const response = await request(app)
      .put(`/api/users/${admin.id}`)
      .set("Cookie", adminCookie)
      .send({ isAdmin: false });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Cannot remove admin privileges from the last admin user");
  });

  it("demotes an admin once another one exists", async () => {
    const second = await createUserAsAdmin({
      username: "root",
      password: "roots-password",
      isAdmin: true,
    });

    const response = await request(app)
      .put(`/api/users/${second.id}`)
      .set("Cookie", adminCookie)
      .send({ isAdmin: false });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ isAdmin: false, role: "user" });

    const cookie = await loginAs(app, "root", "roots-password");
    await request(app).get("/api/users").set("Cookie", cookie).expect(403);
  });

  it("clears the forced password change", async () => {
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

    const response = await request(app)
      .put(`/api/users/${bob.id}`)
      .set("Cookie", adminCookie)
      .send({ forceChangePassword: false });

    expect(response.status).toBe(200);
    expect(response.body.forceChangePassword).toBe(false);
  });

  // The existence check at the top of the handler cannot cover the row being
  // deleted between it and the update. Before, nothing came back and the route
  // answered 200 with an empty body.
  it("reports a user that disappeared mid-update as not found", async () => {
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });
    vi.spyOn(storage, "updateUser").mockResolvedValue(undefined);
    onTestFinished(() => {
      vi.restoreAllMocks();
    });

    const response = await request(app)
      .put(`/api/users/${bob.id}`)
      .set("Cookie", adminCookie)
      .send({ username: "bobby" });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found");
  });

  it("returns the unchanged user for a request that changes nothing", async () => {
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

    const response = await request(app).put(`/api/users/${bob.id}`).set("Cookie", adminCookie).send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: bob.id,
      username: "bob",
      isAdmin: false,
      role: "user",
      forceChangePassword: true,
    });
    await expect(loginAs(app, "bob", "bobs-password")).resolves.toBeTruthy();
  });

  // Renaming applies the same rules as creating, or a name POST /api/users
  // refuses could still be reached by creating a valid one and renaming it.
  it.each([
    ["a username shorter than 3 characters", { username: "ab" }, "Username must be at least 3 characters"],
    ["a username longer than 30 characters", { username: "b".repeat(31) }, "Username must be at most 30 characters"],
    ["a username with punctuation", { username: "not.allowed" }, "Username may only contain letters, numbers, underscores, and hyphens"],
    ["a password shorter than 8 characters", { password: "short" }, "Password must be at least 8 characters"],
  ])("rejects %s, applying the same rules as creating an account", async (_label, body, message) => {
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

    const response = await request(app).put(`/api/users/${bob.id}`).set("Cookie", adminCookie).send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(message);

    const unchanged = await storage.getUser(bob.id);
    expect(unchanged?.username).toBe("bob");
    await expect(loginAs(app, "bob", "bobs-password")).resolves.toBeTruthy();
  });

  // Before either endpoint was validated an admin could create any name at all,
  // so an upgraded install may hold one the rules now refuse. The edit form
  // prefills the username, which would resubmit that name unchanged on any edit
  // - locking the account out of administration over a field nobody touched.
  // The rules apply to a name being set, not to one already held.
  // The exemption for a name already held is unchanged by usernames widening to
  // Latin script - it just applies to a smaller set now. `müller` is a legal
  // name from this branch on, so a still-refused example has to be one the rule
  // still refuses: a dot was never allowed, in any charset.
  describe("a username the rules still refuse, held since before they applied", () => {
    async function createLegacyUser(username: string) {
      return await storage.createUser({
        username,
        password: await hashPassword("muellers-password"),
        email: `${encodeURIComponent(username)}@example.com`,
        role: "user",
        isAdmin: false,
        emailVerified: true,
        forceChangePassword: false,
      });
    }

    it("still accepts an edit that resubmits it unchanged", async () => {
      const legacy = await createLegacyUser("max.mustermann");

      const response = await request(app)
        .put(`/api/users/${legacy.id}`)
        .set("Cookie", adminCookie)
        .send({ username: "max.mustermann", isAdmin: true });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ username: "max.mustermann", isAdmin: true });
    });

    it("still accepts a password reset that resubmits it unchanged", async () => {
      const legacy = await createLegacyUser("max.mustermann2");

      await request(app)
        .put(`/api/users/${legacy.id}`)
        .set("Cookie", adminCookie)
        .send({ username: "max.mustermann2", password: "a-new-password" })
        .expect(200);

      await expect(loginAs(app, "max.mustermann2", "a-new-password")).resolves.toBeTruthy();
    });

    // Recasing is setting a new name, not keeping the one already held, so it
    // gets the same answer any other rename to a refused name would.
    it("refuses to change it, even by capitalisation alone", async () => {
      const legacy = await createLegacyUser("max.mustermann3");

      const response = await request(app)
        .put(`/api/users/${legacy.id}`)
        .set("Cookie", adminCookie)
        .send({ username: "Max.mustermann3" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Username may only contain letters, numbers, underscores, and hyphens",
      );

      const unchanged = await storage.getUser(legacy.id);
      expect(unchanged?.username).toBe("max.mustermann3");
    });

    // The exemption is for the name this user already has, not for refused
    // names generally.
    it("does not let another user be renamed onto a name like it", async () => {
      await createLegacyUser("max.mustermann4");
      const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

      const response = await request(app)
        .put(`/api/users/${bob.id}`)
        .set("Cookie", adminCookie)
        .send({ username: "max.mustermann4" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Username may only contain letters, numbers, underscores, and hyphens",
      );
    });
  });

  // The counterpart: a name that used to be refused and now is not. These two
  // used to be the cases above - they are the behaviour change this branch makes.
  describe("a username with diacritics, now that they are allowed", () => {
    it("can be recased, because folding makes it the same account", async () => {
      const mueller = await createUserAsAdmin({
        username: "m\u00fcller",
        password: "muellers-password",
      });

      const response = await request(app)
        .put(`/api/users/${mueller.id}`)
        .set("Cookie", adminCookie)
        .send({ username: "M\u00fcller" });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ username: "M\u00fcller" });
    });

    it("still refuses another user renamed onto it, in any spelling", async () => {
      await createUserAsAdmin({ username: "m\u00fcller", password: "muellers-password" });
      const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

      for (const taken of ["m\u00fcller", "M\u00dcLLER", "mu\u0308ller"]) {
        const response = await request(app)
          .put(`/api/users/${bob.id}`)
          .set("Cookie", adminCookie)
          .send({ username: taken });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Username already exists");
      }
    });
  });

  // The endpoint validated nothing before, so an empty string meant "leave this
  // alone" - the edit form still sends one for a password it did not touch.
  it("treats an empty username or password as a field to leave alone", async () => {
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

    const response = await request(app)
      .put(`/api/users/${bob.id}`)
      .set("Cookie", adminCookie)
      .send({ username: "", password: "", forceChangePassword: false });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ username: "bob", forceChangePassword: false });
    await expect(loginAs(app, "bob", "bobs-password")).resolves.toBeTruthy();
  });
});

describe("DELETE /api/users/:id", () => {
  it("rejects a non-admin", async () => {
    const cookie = await registerAndVerify(app, alice);
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

    const response = await request(app).delete(`/api/users/${bob.id}`).set("Cookie", cookie);

    expect(response.status).toBe(403);
  });

  it("rejects an id that is not a number", async () => {
    const response = await request(app).delete("/api/users/not-a-number").set("Cookie", adminCookie);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid user ID");
  });

  it("reports an unknown user as not found", async () => {
    const response = await request(app).delete("/api/users/9999").set("Cookie", adminCookie);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User not found");
  });

  it("deletes a user, who can then no longer log in", async () => {
    const bob = await createUserAsAdmin({ username: "bob", password: "bobs-password" });

    const response = await request(app).delete(`/api/users/${bob.id}`).set("Cookie", adminCookie);

    expect(response.status).toBe(204);
    await request(app)
      .post("/api/auth/login")
      .send({ username: "bob", password: "bobs-password" })
      .expect(401);
  });

  it("refuses to delete the only admin", async () => {
    const admins = await request(app).get("/api/users").set("Cookie", adminCookie);
    const admin = admins.body.find((user: { role: string }) => user.role === "admin");

    const response = await request(app).delete(`/api/users/${admin.id}`).set("Cookie", adminCookie);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Cannot delete the last admin user");
  });

  it("deletes an admin once another one exists", async () => {
    const second = await createUserAsAdmin({
      username: "root",
      password: "roots-password",
      isAdmin: true,
    });

    const response = await request(app).delete(`/api/users/${second.id}`).set("Cookie", adminCookie);

    expect(response.status).toBe(204);
  });
});

describe("/api/user-sharing", () => {
  it("rejects requests with no session cookie", async () => {
    await request(app).get("/api/user-sharing").expect(401);
    await request(app).post("/api/user-sharing").send({ isPublic: true }).expect(401);
  });

  it("starts with nothing shared", async () => {
    const cookie = await registerAndVerify(app, alice);

    const response = await request(app).get("/api/user-sharing").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("shares one material and reads it back", async () => {
    const cookie = await registerAndVerify(app, alice);
    const petg = await storage.createMaterial({ name: "PETG" });

    const created = await request(app)
      .post("/api/user-sharing")
      .set("Cookie", cookie)
      .send({ materialId: petg.id, isPublic: true });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ materialId: petg.id, isPublic: true });

    const listed = await request(app).get("/api/user-sharing").set("Cookie", cookie);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({ materialId: petg.id, isPublic: true });
  });

  it("replaces the existing setting for a material rather than adding a second", async () => {
    const cookie = await registerAndVerify(app, alice);
    const petg = await storage.createMaterial({ name: "PETG" });

    await request(app)
      .post("/api/user-sharing")
      .set("Cookie", cookie)
      .send({ materialId: petg.id, isPublic: true })
      .expect(201);
    await request(app)
      .post("/api/user-sharing")
      .set("Cookie", cookie)
      .send({ materialId: petg.id, isPublic: false })
      .expect(201);

    const listed = await request(app).get("/api/user-sharing").set("Cookie", cookie);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].isPublic).toBe(false);
  });

  it("defaults isPublic to false when it is left out", async () => {
    const cookie = await registerAndVerify(app, alice);
    const petg = await storage.createMaterial({ name: "PETG" });

    const created = await request(app)
      .post("/api/user-sharing")
      .set("Cookie", cookie)
      .send({ materialId: petg.id });

    expect(created.status).toBe(201);
    expect(created.body.isPublic).toBe(false);
  });

  it("shows a user only their own settings", async () => {
    const aliceCookie = await registerAndVerify(app, alice);
    const petg = await storage.createMaterial({ name: "PETG" });
    await request(app)
      .post("/api/user-sharing")
      .set("Cookie", aliceCookie)
      .send({ materialId: petg.id, isPublic: true })
      .expect(201);

    const bobCookie = await registerAndVerify(app, {
      username: "bob",
      email: "bob@example.com",
      password: "bobs-password",
    });

    const response = await request(app).get("/api/user-sharing").set("Cookie", bobCookie);
    expect(response.body).toEqual([]);
  });
});

describe("POST /api/user-sharing for a global share", () => {
  it("replaces the previous global setting rather than adding a second row", async () => {
    const cookie = await registerAndVerify(app, alice);

    await request(app).post("/api/user-sharing").set("Cookie", cookie).send({ isPublic: true }).expect(201);
    await request(app).post("/api/user-sharing").set("Cookie", cookie).send({ isPublic: true }).expect(201);

    const listed = await request(app).get("/api/user-sharing").set("Cookie", cookie);
    expect(listed.body).toHaveLength(1);
  });

  it("leaves nothing public once sharing is switched off", async () => {
    const cookie = await registerAndVerify(app, alice);

    await request(app).post("/api/user-sharing").set("Cookie", cookie).send({ isPublic: true }).expect(201);
    await request(app).post("/api/user-sharing").set("Cookie", cookie).send({ isPublic: false }).expect(201);

    const listed = await request(app).get("/api/user-sharing").set("Cookie", cookie);
    expect(listed.body.map((s: { isPublic: boolean }) => s.isPublic)).toEqual([false]);
  });

  it("keeps a global setting separate from a per-material one", async () => {
    const cookie = await registerAndVerify(app, alice);
    const petg = await storage.createMaterial({ name: "PETG" });

    await request(app).post("/api/user-sharing").set("Cookie", cookie).send({ isPublic: true }).expect(201);
    await request(app)
      .post("/api/user-sharing")
      .set("Cookie", cookie)
      .send({ materialId: petg.id, isPublic: true })
      .expect(201);

    const listed = await request(app).get("/api/user-sharing").set("Cookie", cookie);
    expect(listed.body).toHaveLength(2);
  });
});

describe("POST /api/user-sharing", () => {
  it("refuses a material id that is not a positive integer", async () => {
    const cookie = await registerAndVerify(app, alice);

    const res = await request(app).post("/api/user-sharing").set("Cookie", cookie).send({ materialId: "1; drop", isPublic: true });

    expect(res.status).toBe(400);
  });

  it("refuses a material the caller cannot see", async () => {
    const cookie = await registerAndVerify(app, alice);
    const bobCookie = await registerAndVerify(app, { username: "bob", email: "bob@example.com", password: "bobs-password" });
    const bob = await request(app).get("/api/auth/me").set("Cookie", bobCookie);
    const [bobsMaterial] = await db.insert(materials).values({ userId: bob.body.id, name: "BobOnly" }).returning();

    const res = await request(app).post("/api/user-sharing").set("Cookie", cookie).send({ materialId: bobsMaterial.id, isPublic: true });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Unknown material");
  });

  it("accepts the whole-collection setting and a Global Catalog material", async () => {
    const cookie = await registerAndVerify(app, alice);
    const petg = await storage.createMaterial({ name: "PETG" });

    await request(app).post("/api/user-sharing").set("Cookie", cookie).send({ isPublic: true }).expect(201);
    await request(app).post("/api/user-sharing").set("Cookie", cookie).send({ materialId: petg.id, isPublic: true }).expect(201);
  });
});
