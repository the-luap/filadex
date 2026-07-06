import type { Express } from "express";
import { eq, count, sql } from "drizzle-orm";
import { db } from "../db";
import { users, userSharing } from "../../shared/schema";
import { authenticate, isAdmin, hashPassword } from "../auth";
import { logger as appLogger } from "../utils/logger";
import { and } from "drizzle-orm";

export function registerUserRoutes(app: Express): void {
  // Update user language preference
  app.post("/api/users/language", authenticate, async (req, res) => {
    try {
      const { language } = req.body;

      // Validate language
      if (language !== 'en' && language !== 'de') {
        return res.status(400).json({ message: "Invalid language. Supported languages are 'en' and 'de'." });
      }

      // Update user language
      await db.update(users)
        .set({ language })
        .where(eq(users.id, req.userId));

      res.json({ message: "Language preference updated successfully" });
    } catch (error) {
      appLogger.error("Update language error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update user units preferences (currency and temperature)
  app.post("/api/users/units", authenticate, async (req, res) => {
    try {
      const { currency, temperatureUnit } = req.body;

      const updateData: any = {};

      // Validate and update currency
      if (currency) {
        const validCurrencies = ['EUR', 'USD', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'PLN', 'CZK', 'NOK', 'SEK', 'DKK', 'HUF', 'RON', 'BGN', 'HRK'];
        if (!validCurrencies.includes(currency)) {
          return res.status(400).json({ message: `Invalid currency. Supported currencies are: ${validCurrencies.join(', ')}` });
        }
        updateData.currency = currency;
      }

      // Validate and update temperature unit
      if (temperatureUnit) {
        if (temperatureUnit !== 'C' && temperatureUnit !== 'F') {
          return res.status(400).json({ message: "Invalid temperature unit. Supported units are 'C' and 'F'." });
        }
        updateData.temperatureUnit = temperatureUnit;
      }

      // Update user units
      if (Object.keys(updateData).length > 0) {
        await db.update(users)
          .set(updateData)
          .where(eq(users.id, req.userId));
      }

      res.json({ message: "Units preferences updated successfully" });
    } catch (error) {
      appLogger.error("Update units error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // User management routes (admin only)
  app.get("/api/users", authenticate, isAdmin, async (_req, res) => {
    try {
      const usersList = await db.select({
        id: users.id,
        username: users.username,
        isAdmin: users.isAdmin,
        role: users.role,
        email: users.email,
        emailVerified: users.emailVerified,
        forceChangePassword: users.forceChangePassword,
        language: users.language,
        currency: users.currency,
        temperatureUnit: users.temperatureUnit,
        createdAt: users.createdAt,
        lastLogin: users.lastLogin
      }).from(users);

      res.json(usersList);
    } catch (error) {
      appLogger.error("Get users error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Create a new user (admin only)
  app.post("/api/users", authenticate, isAdmin, async (req, res) => {
    try {
      const { username, password, isAdmin: makeAdmin, forceChangePassword } = req.body;

      // Check if username already exists (case-insensitive)
      const existingUser = await db.select().from(users).where(sql`LOWER(${users.username}) = LOWER(${username})`);

      if (existingUser.length > 0) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);
      const role = makeAdmin ? "admin" : "user";

      // Create user. isAdmin/role are kept in sync - role is the source of truth
      // for authorization, isAdmin is a mirror kept for backward compatibility.
      const [newUser] = await db.insert(users)
        .values({
          username,
          password: hashedPassword,
          isAdmin: makeAdmin || false,
          role,
          emailVerified: true, // admin-created accounts skip self-registration's email verification
          forceChangePassword: forceChangePassword !== false
        })
        .returning({
          id: users.id,
          username: users.username,
          isAdmin: users.isAdmin,
          role: users.role,
          forceChangePassword: users.forceChangePassword,
          createdAt: users.createdAt
        });

      res.status(201).json(newUser);
    } catch (error) {
      appLogger.error("Create user error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update a user (admin only)
  app.put("/api/users/:id", authenticate, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const { username, password, isAdmin: makeAdmin, forceChangePassword } = req.body;

      // Check if user exists
      const existingUser = await db.select().from(users).where(eq(users.id, id));

      if (existingUser.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prepare update data
      const updateData: any = {};

      if (username) {
        // Check if new username already exists (if changed, case-insensitive)
        if (username.toLowerCase() !== existingUser[0].username.toLowerCase()) {
          const usernameExists = await db.select().from(users).where(sql`LOWER(${users.username}) = LOWER(${username})`);

          if (usernameExists.length > 0) {
            return res.status(400).json({ message: "Username already exists" });
          }

          updateData.username = username;
        }
      }

      if (password) {
        updateData.password = await hashPassword(password);
      }

      if (makeAdmin !== undefined) {
        // Prevent demoting the last remaining admin - would lock everyone out of admin functions
        if (existingUser[0].role === "admin" && !makeAdmin) {
          const adminCount = await db.select({ count: count() }).from(users).where(eq(users.role, "admin"));
          if (adminCount[0].count <= 1) {
            return res.status(400).json({ message: "Cannot remove admin privileges from the last admin user" });
          }
        }
        updateData.isAdmin = makeAdmin;
        updateData.role = makeAdmin ? "admin" : "user";
      }

      if (forceChangePassword !== undefined) {
        updateData.forceChangePassword = forceChangePassword;
      }

      // Update user
      const [updatedUser] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          username: users.username,
          isAdmin: users.isAdmin,
          role: users.role,
          forceChangePassword: users.forceChangePassword,
          createdAt: users.createdAt,
          lastLogin: users.lastLogin
        });

      res.json(updatedUser);
    } catch (error) {
      appLogger.error("Update user error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Delete a user (admin only)
  app.delete("/api/users/:id", authenticate, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Check if user exists
      const existingUser = await db.select().from(users).where(eq(users.id, id));

      if (existingUser.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deleting the last admin user
      if (existingUser[0].role === "admin") {
        const adminCount = await db.select({ count: count() }).from(users).where(eq(users.role, "admin"));

        if (adminCount[0].count <= 1) {
          return res.status(400).json({ message: "Cannot delete the last admin user" });
        }
      }

      // Delete user
      await db.delete(users).where(eq(users.id, id));

      res.status(204).end();
    } catch (error) {
      appLogger.error("Delete user error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // User sharing routes
  app.get("/api/user-sharing", authenticate, async (req, res) => {
    try {
      const sharingSettings = await db.select().from(userSharing)
        .where(eq(userSharing.userId, req.userId));

      res.json(sharingSettings);
    } catch (error) {
      appLogger.error("Get user sharing settings error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/user-sharing", authenticate, async (req, res) => {
    try {
      const { materialId, isPublic } = req.body;

      // Delete existing sharing settings for this material
      await db.delete(userSharing)
        .where(and(
          eq(userSharing.userId, req.userId),
          eq(userSharing.materialId, materialId)
        ));

      // Create new sharing setting
      const [newSharing] = await db.insert(userSharing)
        .values({
          userId: req.userId,
          materialId,
          isPublic: isPublic || false
        })
        .returning();

      res.status(201).json(newSharing);
    } catch (error) {
      appLogger.error("Create user sharing setting error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
}

