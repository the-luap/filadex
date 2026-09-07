import type { Express } from "express";
import { type User, adminCreateUserSchema, adminUpdateUserSchema, usernameSchema } from "../../shared/schema";
import { isSupportedLanguage } from "@shared/languages";
import { authenticate, isAdmin, hashPassword } from "../auth";
import { storage, type UserChanges, type UserPreferences } from "../storage";
import { logger as appLogger } from "../utils/logger";

// What the admin endpoints say about a user. Never the password hash, and the
// same fields whether the user was just changed or not.
function managedUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    role: user.role,
    forceChangePassword: user.forceChangePassword,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
}

export function registerUserRoutes(app: Express): void {
  // Update user language preference
  app.post("/api/users/language", authenticate, async (req, res) => {
    try {
      const { language } = req.body;

      // Validate language
      if (!isSupportedLanguage(language)) {
        return res.status(400).json({ message: "Invalid language. Supported languages are 'en', 'de' and 'pl'." });
      }

      await storage.updateUserPreferences(req.userId, { language });

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

      const updateData: UserPreferences = {};

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

      await storage.updateUserPreferences(req.userId, updateData);

      res.json({ message: "Units preferences updated successfully" });
    } catch (error) {
      appLogger.error("Update units error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update user notification preferences (low-stock / drying-reminder emails)
  app.post("/api/users/notification-preferences", authenticate, async (req, res) => {
    try {
      const { lowStockThresholdPercent, notifyLowStock, notifyDryingReminder, dryingReminderDays } = req.body;
      const updateData: UserPreferences = {};

      if (lowStockThresholdPercent !== undefined) {
        const value = Number(lowStockThresholdPercent);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          return res.status(400).json({ message: "lowStockThresholdPercent must be a number between 0 and 100" });
        }
        updateData.lowStockThresholdPercent = value;
      }

      if (notifyLowStock !== undefined) {
        if (typeof notifyLowStock !== "boolean") {
          return res.status(400).json({ message: "notifyLowStock must be a boolean" });
        }
        updateData.notifyLowStock = notifyLowStock;
      }

      if (notifyDryingReminder !== undefined) {
        if (typeof notifyDryingReminder !== "boolean") {
          return res.status(400).json({ message: "notifyDryingReminder must be a boolean" });
        }
        updateData.notifyDryingReminder = notifyDryingReminder;
      }

      if (dryingReminderDays !== undefined) {
        const value = Number(dryingReminderDays);
        if (!Number.isFinite(value) || value < 1) {
          return res.status(400).json({ message: "dryingReminderDays must be a positive number" });
        }
        updateData.dryingReminderDays = value;
      }

      await storage.updateUserPreferences(req.userId, updateData);

      res.json({ message: "Notification preferences updated successfully" });
    } catch (error) {
      appLogger.error("Update notification preferences error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // User management routes (admin only)
  app.get("/api/users", authenticate, isAdmin, async (_req, res) => {
    try {
      res.json(await storage.listUsers());
    } catch (error) {
      appLogger.error("Get users error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Create a new user (admin only)
  app.post("/api/users", authenticate, isAdmin, async (req, res) => {
    try {
      const parsed = adminCreateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const { username, password, isAdmin: makeAdmin, forceChangePassword } = parsed.data;

      // Check if username already exists (case-insensitive)
      if (await storage.getUserByUsername(username)) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);
      const role = makeAdmin ? "admin" : "user";

      // Create user. isAdmin/role are kept in sync - role is the source of truth
      // for authorization, isAdmin is a mirror kept for backward compatibility.
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        isAdmin: makeAdmin || false,
        role,
        emailVerified: true, // admin-created accounts skip self-registration's email verification
        forceChangePassword: forceChangePassword !== false
      });

      const { lastLogin, ...created } = managedUser(newUser);
      res.status(201).json(created);
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

      const parsed = adminUpdateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const { username, password, isAdmin: makeAdmin, forceChangePassword } = parsed.data;

      // Check if user exists
      const existingUser = await storage.getUser(id);

      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prepare update data
      const updateData: UserChanges = {};

      if (username) {
        // The rules apply to a name being set, not to one already held. An
        // upgraded install may hold a name they now refuse, from before either
        // endpoint validated anything, and the edit form prefills the username -
        // so resubmitting it unchanged has to stay an edit the admin can make.
        // Anything else, recasing included, is setting a new name and is checked.
        if (username !== existingUser.username) {
          const validated = usernameSchema.safeParse(username);
          if (!validated.success) {
            return res.status(400).json({ message: validated.error.errors[0]?.message || "Invalid input" });
          }
        }

        // Only a name that resolves to a different user can collide. Changing
        // just the capitalisation is this same user renaming themselves, so it
        // skips the check - but it is still applied, unlike before, when it was
        // silently dropped and left nothing to update at all.
        if (username.toLowerCase() !== existingUser.username.toLowerCase()) {
          if (await storage.getUserByUsername(username)) {
            return res.status(400).json({ message: "Username already exists" });
          }
        }

        updateData.username = username;
      }

      if (password) {
        updateData.password = await hashPassword(password);
      }

      if (makeAdmin !== undefined) {
        // Prevent demoting the last remaining admin - would lock everyone out of admin functions
        if (existingUser.role === "admin" && !makeAdmin) {
          if (await storage.countAdmins() <= 1) {
            return res.status(400).json({ message: "Cannot remove admin privileges from the last admin user" });
          }
        }
        updateData.isAdmin = makeAdmin;
        updateData.role = makeAdmin ? "admin" : "user";
      }

      if (forceChangePassword !== undefined) {
        updateData.forceChangePassword = forceChangePassword;
      }

      // updateUser treats an empty change set as a no-op, so a request that asks
      // for no change answers with the user unchanged rather than failing.
      const updatedUser = await storage.updateUser(id, updateData);

      // The existence check above cannot cover the row being deleted between it
      // and the update. Nothing came back, so there is nothing to answer with.
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(managedUser(updatedUser));
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
      const existingUser = await storage.getUser(id);

      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deleting the last admin user
      if (existingUser.role === "admin" && await storage.countAdmins() <= 1) {
        return res.status(400).json({ message: "Cannot delete the last admin user" });
      }

      await storage.deleteUser(id);

      res.status(204).end();
    } catch (error) {
      appLogger.error("Delete user error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // User sharing routes
  app.get("/api/user-sharing", authenticate, async (req, res) => {
    try {
      res.json(await storage.getUserSharing(req.userId));
    } catch (error) {
      appLogger.error("Get user sharing settings error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/user-sharing", authenticate, async (req, res) => {
    try {
      const { materialId, isPublic } = req.body;

      const newSharing = await storage.setUserSharing(
        req.userId,
        materialId ?? null,
        isPublic || false,
      );

      res.status(201).json(newSharing);
    } catch (error) {
      appLogger.error("Create user sharing setting error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
}

