import type { Express } from "express";
import { createServer, type Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import { z } from "zod";
import {
  InsertFilament,
  insertManufacturerSchema,
  insertMaterialSchema,
  insertColorSchema,
  insertDiameterSchema,
  insertStorageLocationSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { authenticate, isAdmin, hashPassword, verifyPassword, generateToken, initializeAdminUser } from "./auth";
import { users, userSharing, changePasswordSchema } from "../shared/schema";
import { db } from "./db";
import { eq, count, isNull, and } from "drizzle-orm";
import "./types"; // Import types for Express Request extension

export async function registerRoutes(app: Express, authenticate: any, db: any, schema: any, logger: any): Promise<Server> {
  // Initialize admin user
  await initializeAdminUser();

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      const [user] = await db.select().from(users).where(eq(users.username, username));

      if (!user || !(await verifyPassword(password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Update last login
      await db.update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, user.id));

      // Generate token
      const token = generateToken(user.id);

      // Set cookie
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Return user info (without password)
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        user: userWithoutPassword,
        forceChangePassword: user.forceChangePassword
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
  });

  app.get("/api/auth/me", authenticate, async (req, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/change-password", authenticate, async (req, res) => {
    try {
      const result = changePasswordSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error.format() });
      }

      const { currentPassword, newPassword } = result.data;

      const [user] = await db.select().from(users).where(eq(users.id, req.userId));

      if (!user || !(await verifyPassword(currentPassword, user.password))) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const hashedPassword = await hashPassword(newPassword);

      await db.update(users)
        .set({
          password: hashedPassword,
          forceChangePassword: false
        })
        .where(eq(users.id, req.userId));

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

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
      console.error("Update language error:", error);
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
        forceChangePassword: users.forceChangePassword,
        language: users.language,
        createdAt: users.createdAt,
        lastLogin: users.lastLogin
      }).from(users);

      res.json(usersList);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Create a new user (admin only)
  app.post("/api/users", authenticate, isAdmin, async (req, res) => {
    try {
      const { username, password, isAdmin, forceChangePassword } = req.body;

      // Check if username already exists
      const existingUser = await db.select().from(users).where(eq(users.username, username));

      if (existingUser.length > 0) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const [newUser] = await db.insert(users)
        .values({
          username,
          password: hashedPassword,
          isAdmin: isAdmin || false,
          forceChangePassword: forceChangePassword !== false
        })
        .returning({
          id: users.id,
          username: users.username,
          isAdmin: users.isAdmin,
          forceChangePassword: users.forceChangePassword,
          createdAt: users.createdAt
        });

      res.status(201).json(newUser);
    } catch (error) {
      console.error("Create user error:", error);
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

      const { username, password, isAdmin, forceChangePassword } = req.body;

      // Check if user exists
      const existingUser = await db.select().from(users).where(eq(users.id, id));

      if (existingUser.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prepare update data
      const updateData: any = {};

      if (username) {
        // Check if new username already exists (if changed)
        if (username !== existingUser[0].username) {
          const usernameExists = await db.select().from(users).where(eq(users.username, username));

          if (usernameExists.length > 0) {
            return res.status(400).json({ message: "Username already exists" });
          }

          updateData.username = username;
        }
      }

      if (password) {
        updateData.password = await hashPassword(password);
      }

      if (isAdmin !== undefined) {
        updateData.isAdmin = isAdmin;
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
          forceChangePassword: users.forceChangePassword,
          createdAt: users.createdAt,
          lastLogin: users.lastLogin
        });

      res.json(updatedUser);
    } catch (error) {
      console.error("Update user error:", error);
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
      if (existingUser[0].isAdmin) {
        const adminCount = await db.select({ count: count() }).from(users).where(eq(users.isAdmin, true));

        if (adminCount[0].count <= 1) {
          return res.status(400).json({ message: "Cannot delete the last admin user" });
        }
      }

      // Delete user
      await db.delete(users).where(eq(users.id, id));

      res.status(204).end();
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // User sharing routes

  // Get user sharing settings
  app.get("/api/user-sharing", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const sharingSettings = await db.select().from(userSharing)
        .where(and(eq(userSharing.userId, userId)));

      res.json(sharingSettings);
    } catch (error) {
      console.error("Get user sharing settings error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update user sharing settings
  app.post("/api/user-sharing", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { materialId, isPublic } = req.body;

      // Check if setting already exists
      const existingSetting = await db.select()
        .from(userSharing)
        .where(
          materialId
            ? and(eq(userSharing.userId, userId), eq(userSharing.materialId, materialId))
            : and(eq(userSharing.userId, userId), isNull(userSharing.materialId))
        );

      if (existingSetting.length > 0) {
        // Update existing setting
        const [updated] = await db.update(userSharing)
          .set({ isPublic })
          .where(eq(userSharing.id, existingSetting[0].id))
          .returning();

        return res.json(updated);
      }

      // Create new setting
      const [newSetting] = await db.insert(userSharing)
        .values({
          userId,
          materialId: materialId || null,
          isPublic
        })
        .returning();

      res.status(201).json(newSetting);
    } catch (error) {
      console.error("Update user sharing settings error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });



  // Keep the old endpoint for backward compatibility
  app.get("/api/public/filaments/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Get user information
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Redirect to the new endpoint
      res.redirect(`/api/public/filaments/user/${user.username}`);
    } catch (error) {
      console.error("Get public filaments error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get public filaments for a specific user by ID
  app.get("/api/public/filaments/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Get user information
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's sharing settings
      const sharingSettings = await db.select().from(userSharing)
        .where(and(
          eq(userSharing.userId, userId),
          eq(userSharing.isPublic, true)
        ));

      // Check if user has any public filaments
      if (sharingSettings.length === 0) {
        return res.status(404).json({ message: "No public filaments found" });
      }

      // Check if user has global sharing enabled
      const hasGlobalSharing = sharingSettings.some((s: any) => s.materialId === null);

      // Get shared materials
      const sharedMaterialIds = sharingSettings
        .filter((s: any) => s.materialId !== null)
        .map((s: any) => s.materialId);

      // Get all filaments for this user
      const filaments = await storage.getFilaments(userId);

      // Filter filaments based on sharing settings
      const publicFilaments = filaments.filter((filament: any) => {
        // Check for global sharing (null materialId)
        if (hasGlobalSharing) return true;

        // Check for material-specific sharing
        return filament.material &&
               sharedMaterialIds.includes(parseInt(filament.material));
      });

      // Return filaments with user information
      res.json({
        filaments: publicFilaments,
        user: {
          id: user.id,
          username: user.username
        }
      });
    } catch (error) {
      console.error("Get public filaments error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Protect existing routes with authentication
  app.get("/api/filaments", authenticate, async (req, res) => {
    try {
      const filaments = await storage.getFilaments(req.userId);

      // Check if export parameter is set
      if (req.query.export === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="filaments.csv"');

        // Create CSV header and content
        let csvContent = 'name,manufacturer,material,colorName,colorCode,diameter,printTemp,totalWeight,remainingPercentage,purchaseDate,purchasePrice,status,spoolType,dryerCount,lastDryingDate,storageLocation\n';

        filaments.forEach(filament => {
          // Format date fields
          const purchaseDate = filament.purchaseDate ? new Date(filament.purchaseDate).toISOString().split('T')[0] : '';
          const lastDryingDate = filament.lastDryingDate ? new Date(filament.lastDryingDate).toISOString().split('T')[0] : '';

          // Escape fields that might contain commas
          const escapeCsvField = (field: any): string => {
            if (field === null || field === undefined) return '';
            const str = String(field);
            return str.includes(',') ? `"${str}"` : str;
          };

          csvContent += `${escapeCsvField(filament.name)},`;
          csvContent += `${escapeCsvField(filament.manufacturer)},`;
          csvContent += `${escapeCsvField(filament.material)},`;
          csvContent += `${escapeCsvField(filament.colorName)},`;
          csvContent += `${escapeCsvField(filament.colorCode)},`;
          csvContent += `${escapeCsvField(filament.diameter)},`;
          csvContent += `${escapeCsvField(filament.printTemp)},`;
          csvContent += `${escapeCsvField(filament.totalWeight)},`;
          csvContent += `${escapeCsvField(filament.remainingPercentage)},`;
          csvContent += `${escapeCsvField(purchaseDate)},`;
          csvContent += `${escapeCsvField(filament.purchasePrice)},`;
          csvContent += `${escapeCsvField(filament.status)},`;
          csvContent += `${escapeCsvField(filament.spoolType)},`;
          csvContent += `${escapeCsvField(filament.dryerCount)},`;
          csvContent += `${escapeCsvField(lastDryingDate)},`;
          csvContent += `${escapeCsvField(filament.storageLocation)}\n`;
        });

        return res.send(csvContent);
      } else if (req.query.export === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="filaments.json"');

        return res.send(JSON.stringify(filaments, null, 2));
      }

      res.json(filaments);
    } catch (error) {
      console.error("Error fetching filaments:", error);
      res.status(500).json({ message: "Failed to fetch filaments" });
    }
  });

  // GET a single filament by ID
  app.get("/api/filaments/:id", authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid filament ID" });
      }

      const filament = await storage.getFilament(id, req.userId);
      if (!filament) {
        return res.status(404).json({ message: "Filament not found" });
      }

      res.json(filament);
    } catch (error) {
      console.error("Error fetching filament:", error);
      res.status(500).json({ message: "Failed to fetch filament" });
    }
  });

  // POST create a new filament
  app.post("/api/filaments", authenticate, async (req, res) => {
    try {
      // Check if this is a CSV import
      if (req.query.import === 'csv' && req.body.csvData) {
        const results = {
          created: 0,
          duplicates: 0,
          errors: 0
        };

        // Parse CSV data
        const csvLines = req.body.csvData.split('\n');

        // Check if header exists
        let startIndex = 0;
        const headerRow = csvLines[0].toLowerCase();

        // Expected columns in the CSV
        const expectedColumns = [
          'name', 'manufacturer', 'material', 'colorname', 'colorcode',
          'diameter', 'printtemp', 'totalweight', 'remainingpercentage',
          'purchasedate', 'purchaseprice', 'status', 'spooltype',
          'dryercount', 'lastdryingdate', 'storagelocation'
        ];

        // If header exists, skip the first line
        if (expectedColumns.some(col => headerRow.includes(col))) {
          startIndex = 1;
          console.log("CSV header detected, starting import from line 2");
        }

        // Map column indices if header exists
        let columnMap: Record<string, number> = {};
        if (startIndex === 1) {
          const headers = headerRow.split(',').map((h: string) => h.trim().toLowerCase());
          expectedColumns.forEach(col => {
            const index = headers.findIndex((h: string) => h === col);
            if (index !== -1) {
              columnMap[col] = index;
            }
          });
        }

        // Get existing filaments to check for duplicates
        const existingFilaments = await storage.getFilaments(req.userId);

        // Process each line
        for (let i = startIndex; i < csvLines.length; i++) {
          const line = csvLines[i].trim();
          if (!line) continue;

          try {
            // Parse CSV line, handling quoted fields correctly
            const parseCSVLine = (line: string): string[] => {
              const result: string[] = [];
              let current = '';
              let inQuotes = false;

              for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                  result.push(current);
                  current = '';
                } else {
                  current += char;
                }
              }

              result.push(current);
              return result;
            };

            const values = parseCSVLine(line);

            // Extract values based on column mapping or default order
            const getValue = (columnName: string, defaultIndex: number): string => {
              if (startIndex === 1 && columnMap[columnName] !== undefined) {
                return values[columnMap[columnName]] || '';
              }
              return values[defaultIndex] || '';
            };

            const name = getValue('name', 0);
            const manufacturer = getValue('manufacturer', 1);
            const material = getValue('material', 2);
            const colorName = getValue('colorname', 3);
            const colorCode = getValue('colorcode', 4);
            const diameter = getValue('diameter', 5);
            const printTemp = getValue('printtemp', 6);
            const totalWeight = getValue('totalweight', 7);
            const remainingPercentage = getValue('remainingpercentage', 8);
            const purchaseDate = getValue('purchasedate', 9);
            const purchasePrice = getValue('purchaseprice', 10);
            const status = getValue('status', 11);
            const spoolType = getValue('spooltype', 12);
            const dryerCount = getValue('dryercount', 13);
            const lastDryingDate = getValue('lastdryingdate', 14);
            const storageLocation = getValue('storagelocation', 15);

            // Validate required fields
            if (!name || !material || !colorName) {
              console.warn(`Missing required fields at line ${i + 1}, skipping...`);
              results.errors++;
              continue;
            }

            // Check for duplicates by name
            const isDuplicate = existingFilaments.some(f =>
              f.name.toLowerCase() === name.toLowerCase()
            );

            if (isDuplicate) {
              console.log(`Duplicate filament: "${name}" at line ${i + 1}, skipping...`);
              results.duplicates++;
              continue;
            }

            // Prepare data for insertion
            const insertData: InsertFilament = {
              userId: req.userId,
              name,
              manufacturer,
              material,
              colorName,
              colorCode,
              printTemp,
              diameter: diameter ? diameter.toString() : undefined,
              totalWeight: totalWeight ? totalWeight.toString() : "1",
              remainingPercentage: remainingPercentage ? remainingPercentage.toString() : "100",
              purchaseDate: purchaseDate ? purchaseDate : undefined,
              purchasePrice: purchasePrice ? purchasePrice.toString() : undefined,
              status: status || undefined,
              spoolType: spoolType || undefined,
              dryerCount: dryerCount ? parseInt(dryerCount) : 0,
              lastDryingDate: lastDryingDate ? lastDryingDate : undefined,
              storageLocation
            };

            // Create the filament
            await storage.createFilament(insertData);
            results.created++;
            console.log(`Created filament: "${name}" at line ${i + 1}`);
          } catch (err) {
            console.error(`Error importing filament at line ${i + 1}:`, err);
            results.errors++;
          }
        }

        return res.status(201).json(results);
      } else if (req.query.import === 'json' && req.body.jsonData) {
        const results = {
          created: 0,
          duplicates: 0,
          errors: 0
        };

        try {
          // Parse JSON data
          const filaments = JSON.parse(req.body.jsonData);

          if (!Array.isArray(filaments)) {
            return res.status(400).json({ message: "Invalid JSON format. Expected an array of filaments." });
          }

          // Get existing filaments to check for duplicates
          const existingFilaments = await storage.getFilaments(req.userId);

          // Process each filament
          for (const filament of filaments) {
            try {
              // Check required fields
              if (!filament.name || !filament.material || !filament.colorName) {
                console.warn(`Missing required fields in filament, skipping...`);
                results.errors++;
                continue;
              }

              // Check for duplicates by name
              const isDuplicate = existingFilaments.some(f =>
                f.name.toLowerCase() === filament.name.toLowerCase()
              );

              if (isDuplicate) {
                console.log(`Duplicate filament: "${filament.name}", skipping...`);
                results.duplicates++;
                continue;
              }

              // Prepare data for insertion
              const insertData: InsertFilament = {
                userId: req.userId,
                name: filament.name,
                manufacturer: filament.manufacturer,
                material: filament.material,
                colorName: filament.colorName,
                colorCode: filament.colorCode,
                printTemp: filament.printTemp,
                diameter: filament.diameter ? filament.diameter.toString() : undefined,
                totalWeight: filament.totalWeight ? filament.totalWeight.toString() : "1",
                remainingPercentage: filament.remainingPercentage ? filament.remainingPercentage.toString() : "100",
                purchaseDate: filament.purchaseDate || undefined,
                purchasePrice: filament.purchasePrice ? filament.purchasePrice.toString() : undefined,
                status: filament.status || undefined,
                spoolType: filament.spoolType || undefined,
                dryerCount: filament.dryerCount || 0,
                lastDryingDate: filament.lastDryingDate || undefined,
                storageLocation: filament.storageLocation
              };

              // Create the filament
              await storage.createFilament(insertData);
              results.created++;
              console.log(`Created filament: "${filament.name}"`);
            } catch (err) {
              console.error(`Error importing filament:`, err);
              results.errors++;
            }
          }

          return res.status(201).json(results);
        } catch (err) {
          console.error("Error parsing JSON data:", err);
          return res.status(400).json({ message: "Invalid JSON format" });
        }
      }

      // Regular single filament creation
      console.log("Received request to create filament:", req.body);

      // Manuell die Eingabedaten für die Datenbank vorbereiten
      const data = req.body;
      const insertData: InsertFilament = {
        userId: req.userId,
        name: data.name,
        manufacturer: data.manufacturer,
        material: data.material,
        colorName: data.colorName,
        colorCode: data.colorCode,
        printTemp: data.printTemp,
        // Numerische Werte als Strings speichern
        diameter: data.diameter ? data.diameter.toString() : undefined,
        totalWeight: data.totalWeight.toString(),
        remainingPercentage: data.remainingPercentage.toString(),
        // Fehlende Felder hinzufügen
        purchaseDate: data.purchaseDate,
        purchasePrice: data.purchasePrice ? data.purchasePrice.toString() : undefined,
        status: data.status,
        spoolType: data.spoolType,
        dryerCount: data.dryerCount,
        lastDryingDate: data.lastDryingDate,
        storageLocation: data.storageLocation
      };

      console.log("Prepared insert data:", insertData);
      const newFilament = await storage.createFilament(insertData);
      console.log("Created new filament:", newFilament);
      res.status(201).json(newFilament);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        console.error("Validation error:", validationError.message);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating filament:", error);
      res.status(500).json({ message: "Failed to create filament" });
    }
  });

  // PATCH update an existing filament
  app.patch("/api/filaments/:id", authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid filament ID" });
      }

      console.log("Received request to update filament:", req.body);

      // Manuell die Eingabedaten für die Datenbank vorbereiten
      const data = req.body;
      const updateData: Partial<InsertFilament> = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer;
      if (data.material !== undefined) updateData.material = data.material;
      if (data.colorName !== undefined) updateData.colorName = data.colorName;
      if (data.colorCode !== undefined) updateData.colorCode = data.colorCode;
      if (data.printTemp !== undefined) updateData.printTemp = data.printTemp;

      // Numerische Werte als Strings speichern
      if (data.diameter !== undefined) updateData.diameter = data.diameter.toString();
      if (data.totalWeight !== undefined) updateData.totalWeight = data.totalWeight.toString();
      if (data.remainingPercentage !== undefined) updateData.remainingPercentage = data.remainingPercentage.toString();

      // Fehlende Felder hinzufügen
      if (data.purchaseDate !== undefined) updateData.purchaseDate = data.purchaseDate;
      if (data.purchasePrice !== undefined) updateData.purchasePrice = data.purchasePrice.toString();
      if (data.status !== undefined) updateData.status = data.status;
      if (data.spoolType !== undefined) updateData.spoolType = data.spoolType;
      if (data.dryerCount !== undefined) updateData.dryerCount = data.dryerCount;
      if (data.lastDryingDate !== undefined) updateData.lastDryingDate = data.lastDryingDate;
      if (data.storageLocation !== undefined) updateData.storageLocation = data.storageLocation;

      console.log("Prepared update data:", updateData);

      const updatedFilament = await storage.updateFilament(id, updateData, req.userId);
      if (!updatedFilament) {
        return res.status(404).json({ message: "Filament not found" });
      }

      console.log("Updated filament:", updatedFilament);
      res.json(updatedFilament);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        console.error("Validation error:", validationError.message);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error updating filament:", error);
      res.status(500).json({ message: "Failed to update filament" });
    }
  });

  // BATCH DELETE multiple filaments
  app.delete("/api/filaments/batch", authenticate, async (req, res) => {
    try {
      console.log("Batch delete request body:", JSON.stringify(req.body));
      const { ids } = req.body;

      console.log("Received IDs for deletion:", ids);

      if (!Array.isArray(ids) || ids.length === 0) {
        console.log("Invalid request: ids must be a non-empty array");
        return res.status(400).json({ message: "Invalid request: ids must be a non-empty array" });
      }

      // Convert all IDs to numbers and filter out invalid ones
      const validIds = ids
        .map(id => {
          const numId = Number(id);
          if (isNaN(numId)) {
            console.log(`Invalid ID for deletion: ${id} converts to NaN`);
            return null;
          }
          return numId;
        })
        .filter(id => id !== null) as number[];

      console.log("Valid IDs for deletion after conversion:", validIds);

      if (validIds.length === 0) {
        console.log("No valid IDs found for deletion");
        return res.status(400).json({ message: "No valid filament IDs provided" });
      }

      // Delete each filament individually to avoid SQL issues
      let deletedCount = 0;
      for (const id of validIds) {
        try {
          const success = await storage.deleteFilament(id, req.userId);
          if (success) {
            deletedCount++;
            console.log(`Successfully deleted filament with ID ${id}`);
          } else {
            console.log(`Filament with ID ${id} not found or not owned by user ${req.userId}`);
          }
        } catch (err) {
          console.error(`Error deleting filament with ID ${id}:`, err);
        }
      }

      console.log(`Total deleted: ${deletedCount} out of ${validIds.length} requested`);

      res.json({
        message: `Successfully deleted ${deletedCount} filaments`,
        deletedCount
      });
    } catch (error) {
      console.error("Error batch deleting filaments:", error);
      res.status(500).json({ message: "Failed to delete filaments" });
    }
  });

  // BATCH UPDATE multiple filaments (original endpoint)
  app.patch("/api/filaments/batch", authenticate, async (req, res) => {
    try {
      console.log("Batch update request body:", JSON.stringify(req.body));
      const { ids, updates } = req.body;

      console.log("Received IDs:", ids);
      console.log("Received updates:", updates);

      if (!Array.isArray(ids) || ids.length === 0) {
        console.log("Invalid request: ids must be a non-empty array");
        return res.status(400).json({ message: "Invalid request: ids must be a non-empty array" });
      }

      if (!updates || typeof updates !== 'object') {
        console.log("Invalid request: updates must be an object");
        return res.status(400).json({ message: "Invalid request: updates must be an object" });
      }

      // Convert all IDs to numbers and filter out invalid ones
      const validIds = ids
        .map(id => {
          const numId = Number(id);
          if (isNaN(numId)) {
            console.log(`Invalid ID: ${id} converts to NaN`);
            return null;
          }
          return numId;
        })
        .filter(id => id !== null) as number[];

      console.log("Valid IDs after conversion:", validIds);

      if (validIds.length === 0) {
        console.log("No valid IDs found");
        return res.status(400).json({ message: "No valid filament IDs provided" });
      }

      // Prepare update data
      const updateData: Partial<InsertFilament> = {};

      // Process each field, ensuring proper type conversion
      if (updates.name !== undefined) updateData.name = String(updates.name);
      if (updates.manufacturer !== undefined) updateData.manufacturer = String(updates.manufacturer);
      if (updates.material !== undefined) updateData.material = String(updates.material);
      if (updates.colorName !== undefined) updateData.colorName = String(updates.colorName);
      if (updates.colorCode !== undefined) updateData.colorCode = String(updates.colorCode);
      if (updates.printTemp !== undefined) updateData.printTemp = String(updates.printTemp);

      // Numeric values stored as strings
      if (updates.diameter !== undefined) updateData.diameter = String(updates.diameter);
      if (updates.totalWeight !== undefined) updateData.totalWeight = String(updates.totalWeight);
      if (updates.remainingPercentage !== undefined) updateData.remainingPercentage = String(updates.remainingPercentage);

      // Additional fields
      if (updates.purchaseDate !== undefined) updateData.purchaseDate = updates.purchaseDate;
      if (updates.purchasePrice !== undefined) updateData.purchasePrice = String(updates.purchasePrice);
      if (updates.status !== undefined) updateData.status = String(updates.status);
      if (updates.spoolType !== undefined) updateData.spoolType = String(updates.spoolType);
      if (updates.dryerCount !== undefined) updateData.dryerCount = Number(updates.dryerCount);
      if (updates.lastDryingDate !== undefined) updateData.lastDryingDate = updates.lastDryingDate;
      if (updates.storageLocation !== undefined) updateData.storageLocation = String(updates.storageLocation);

      console.log("Update data prepared:", updateData);

      // Update each filament individually to avoid SQL issues
      let updatedCount = 0;
      for (const id of validIds) {
        try {
          const filament = await storage.getFilament(id, req.userId);
          if (filament) {
            await storage.updateFilament(id, updateData, req.userId);
            updatedCount++;
            console.log(`Successfully updated filament with ID ${id}`);
          } else {
            console.log(`Filament with ID ${id} not found or not owned by user ${req.userId}`);
          }
        } catch (err) {
          console.error(`Error updating filament with ID ${id}:`, err);
        }
      }

      console.log(`Total updated: ${updatedCount} out of ${validIds.length} requested`);

      res.json({
        message: `Successfully updated ${updatedCount} filaments`,
        updatedCount
      });
    } catch (error) {
      console.error("Error batch updating filaments:", error);
      res.status(500).json({ message: "Failed to update filaments" });
    }
  });

  // NEW BATCH UPDATE endpoint with simplified implementation
  app.patch("/api/filaments/batch-update", authenticate, async (req, res) => {
    try {
      console.log("DEBUG: NEW Batch update request body:", JSON.stringify(req.body));
      console.log("DEBUG: User ID from request:", req.userId);
      console.log("DEBUG: Request headers:", req.headers);

      // Check if the request body is properly parsed
      if (!req.body) {
        console.log("DEBUG: Request body is empty or not parsed");
        return res.status(400).json({ message: "Empty request body" });
      }

      // Handle case where body might be a string
      let data = req.body;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.error("Error parsing request body:", e);
          return res.status(400).json({ message: "Invalid request format" });
        }
      }

      // Handle case where the body might be nested in a 'body' property
      if (data.body && typeof data.body === 'string') {
        try {
          data = JSON.parse(data.body);
        } catch (e) {
          console.error("Error parsing nested body:", e);
          // Continue with the original data
        }
      }

      // Extract ids and updates from the data
      const { ids, updates } = data;

      console.log("DEBUG: NEW Received IDs:", ids);
      console.log("DEBUG: NEW Received updates:", updates);
      console.log("DEBUG: Type of ids:", typeof ids);
      console.log("DEBUG: Type of updates:", typeof updates);

      if (!Array.isArray(ids) || ids.length === 0) {
        console.log("DEBUG: NEW Invalid request: ids must be a non-empty array");
        return res.status(400).json({ message: "Invalid request: ids must be a non-empty array" });
      }

      if (!updates || typeof updates !== 'object') {
        console.log("DEBUG: NEW Invalid request: updates must be an object");
        return res.status(400).json({ message: "Invalid request: updates must be an object" });
      }

      // Convert all IDs to numbers and filter out invalid ones
      const validIds = ids
        .map(id => {
          console.log(`DEBUG: Processing ID: ${id}, type: ${typeof id}`);
          // Ensure we're working with a string first, then parse as integer
          const numId = parseInt(String(id), 10);
          console.log(`DEBUG: Converted ID: ${numId}, isNaN: ${isNaN(numId)}`);
          if (isNaN(numId)) {
            console.log(`DEBUG: NEW Invalid ID: ${id} converts to NaN`);
            return null;
          }
          return numId;
        })
        .filter(id => id !== null) as number[];

      console.log("DEBUG: NEW Valid IDs after conversion:", validIds);

      if (validIds.length === 0) {
        console.log("DEBUG: NEW No valid IDs found");
        return res.status(400).json({ message: "No valid filament IDs provided" });
      }

      // Update each filament individually to avoid SQL issues
      let updatedCount = 0;
      for (const id of validIds) {
        try {
          console.log(`DEBUG: Attempting to get filament with ID ${id} for user ${req.userId}`);

          // Check if the user ID is valid
          if (!req.userId || isNaN(Number(req.userId))) {
            console.log(`DEBUG: Invalid user ID: ${req.userId}`);
            return res.status(401).json({ message: "Invalid user ID" });
          }

          // Try to get the filament
          const filament = await storage.getFilament(id, req.userId);
          console.log(`DEBUG: Filament retrieval result:`, filament ? "Found" : "Not found");

          if (filament) {
            // Create a simple update object with just the fields we need
            const updateData: Partial<InsertFilament> = {};

            // Only copy the fields that are present in the updates object
            if (updates.status !== undefined) {
              updateData.status = String(updates.status);
              console.log(`DEBUG: Adding status to update: ${updateData.status}`);
            }
            if (updates.storageLocation !== undefined) {
              updateData.storageLocation = String(updates.storageLocation);
              console.log(`DEBUG: Adding storageLocation to update: ${updateData.storageLocation}`);
            }
            if (updates.remainingPercentage !== undefined) {
              updateData.remainingPercentage = String(updates.remainingPercentage);
              console.log(`DEBUG: Adding remainingPercentage to update: ${updateData.remainingPercentage}`);
            }

            console.log(`DEBUG: Updating filament ${id} with:`, updateData);

            try {
              const updated = await storage.updateFilament(id, updateData, req.userId);
              console.log(`DEBUG: Update result:`, updated);

              if (updated) {
                updatedCount++;
                console.log(`DEBUG: Successfully updated filament with ID ${id}`);
              } else {
                console.log(`DEBUG: Failed to update filament with ID ${id}`);
              }
            } catch (updateErr) {
              console.error(`DEBUG: Error during updateFilament call:`, updateErr);
            }
          } else {
            console.log(`DEBUG: Filament with ID ${id} not found or not owned by user ${req.userId}`);
          }
        } catch (err) {
          console.error(`DEBUG: Error updating filament with ID ${id}:`, err);
        }
      }

      console.log(`NEW Total updated: ${updatedCount} out of ${validIds.length} requested`);

      res.json({
        message: `Successfully updated ${updatedCount} filaments`,
        updatedCount
      });
    } catch (error) {
      console.error("NEW Error batch updating filaments:", error);
      res.status(500).json({ message: "Failed to update filaments" });
    }
  });

  // SUPER SIMPLE BATCH UPDATE endpoint - last resort
  app.post("/api/filaments/simple-batch-update", authenticate, async (req, res) => {
    try {
      console.log("SIMPLE BATCH UPDATE request body:", JSON.stringify(req.body));
      console.log("SIMPLE BATCH UPDATE user ID:", req.userId);

      const { id, field, value } = req.body;

      if (!id || !field || value === undefined) {
        console.log("SIMPLE BATCH UPDATE missing required fields");
        return res.status(400).json({ message: "Missing required fields" });
      }

      console.log(`SIMPLE BATCH UPDATE params: id=${id}, field=${field}, value=${value}`);

      // Convert ID to number
      const numId = Number(id);
      if (isNaN(numId)) {
        console.log(`SIMPLE BATCH UPDATE invalid ID: ${id}`);
        return res.status(400).json({ message: "Invalid ID" });
      }

      // Check if the user ID is valid
      if (!req.userId || isNaN(Number(req.userId))) {
        console.log(`SIMPLE BATCH UPDATE invalid user ID: ${req.userId}`);
        return res.status(401).json({ message: "Invalid user ID" });
      }

      // Get the filament
      const filament = await storage.getFilament(numId, req.userId);
      console.log(`SIMPLE BATCH UPDATE filament found:`, filament ? "Yes" : "No");

      if (!filament) {
        return res.status(404).json({ message: "Filament not found" });
      }

      // Create update object with just the one field
      const updateData: Partial<InsertFilament> = {};

      // Only support a few specific fields
      if (field === "status") {
        updateData.status = String(value);
      } else if (field === "storageLocation") {
        updateData.storageLocation = String(value);
      } else if (field === "remainingPercentage") {
        updateData.remainingPercentage = String(value);
      } else {
        return res.status(400).json({ message: "Unsupported field" });
      }

      console.log(`SIMPLE BATCH UPDATE update data:`, updateData);

      // Update the filament
      const updated = await storage.updateFilament(numId, updateData, req.userId);
      console.log(`SIMPLE BATCH UPDATE result:`, updated ? "Success" : "Failed");

      if (!updated) {
        return res.status(500).json({ message: "Failed to update filament" });
      }

      res.json({
        message: "Successfully updated filament",
        filament: updated
      });
    } catch (error) {
      console.error("SIMPLE BATCH UPDATE error:", error);
      res.status(500).json({ message: "Failed to update filament" });
    }
  });

  // DELETE a filament
  app.delete("/api/filaments/:id", authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid filament ID" });
      }

      const success = await storage.deleteFilament(id, req.userId);
      if (!success) {
        return res.status(404).json({ message: "Filament not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting filament:", error);
      res.status(500).json({ message: "Failed to delete filament" });
    }
  });

  // GET statistics for the dashboard
  app.get("/api/statistics", authenticate, async (req, res) => {
    try {
      const filaments = await storage.getFilaments(req.userId);

      const totalSpools = filaments.length;

      let totalWeight = 0;
      let totalRemainingWeight = 0;
      let lowStockCount = 0; // Count of spools with < 25% remaining

      // For material distribution
      const materialCounts: Record<string, number> = {};
      const colorCounts: Record<string, number> = {};

      // For estimated value (average cost per kg is ~30 EUR, adjusting based on material)
      const materialValues: Record<string, number> = {
        'pla': 25,
        'petg': 30,
        'abs': 30,
        'tpu': 40,
        'asa': 40,
        'pa': 60,
        'pc': 60,
        'pva': 65,
        'hips': 30,
        'pla-cf': 50,
        'pa-cf': 75,
        'petg-cf': 55,
        'pet-cf': 55,
        'pla-hf': 35,
        'pp': 40,
        'petg-hf': 40,
        'pps': 80,
        'peek': 150,
        'pei': 100
      };
      const defaultValue = 30; // Default EUR per kg
      let totalValue = 0;
      let totalPurchaseValue = 0;

      // Für Filament-Altersberechnung
      const now = new Date();
      const ageInDays: number[] = [];

      // Ältestes und neuestes Filament
      let oldestFilament: {name: string, days: number} | null = null;
      let newestFilament: {name: string, days: number} | null = null;

      filaments.forEach(filament => {
        const total = Number(filament.totalWeight);
        totalWeight += total;

        const remaining = (total * Number(filament.remainingPercentage)) / 100;
        totalRemainingWeight += remaining;

        // Count low stock items
        if (Number(filament.remainingPercentage) < 25) {
          lowStockCount++;
        }

        // Material distribution
        const material = filament.material ? filament.material.toLowerCase() : 'other';
        materialCounts[material] = (materialCounts[material] || 0) + 1;

        // Color distribution
        const color = filament.colorName || 'Unbekannt';
        colorCounts[color] = (colorCounts[color] || 0) + 1;

        // Estimate value of remaining filament
        const materialValue = materialValues[material] || defaultValue;
        const remainingValue = remaining * materialValue;
        totalValue += remainingValue;

        // Calculate total purchase value
        if (filament.purchasePrice) {
          totalPurchaseValue += Number(filament.purchasePrice);
        } else {
          // If no purchase price is set, estimate based on material and weight
          totalPurchaseValue += total * materialValue;
        }

        // Calculate filament age if purchase date exists
        if (filament.purchaseDate) {
          const purchaseDate = new Date(filament.purchaseDate);
          const ageInMilliseconds = now.getTime() - purchaseDate.getTime();
          const days = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));

          ageInDays.push(days);

          // Track oldest filament
          if (oldestFilament === null || days > oldestFilament.days) {
            oldestFilament = {name: filament.name, days};
          }

          // Track newest filament
          if (newestFilament === null || days < newestFilament.days) {
            newestFilament = {name: filament.name, days};
          }
        }
      });

      // Durchschnittliches Alter der Filamente berechnen
      const averageAge = ageInDays.length > 0
        ? Math.round(ageInDays.reduce((sum, days) => sum + days, 0) / ageInDays.length)
        : 0;

      const averageRemaining = totalSpools > 0
        ? Math.round((totalRemainingWeight / totalWeight) * 100)
        : 0;

      // Calculate material distribution percentages
      const materialDistribution: {name: string, percentage: number}[] = [];
      Object.entries(materialCounts).forEach(([material, count]) => {
        const percentage = Math.round((count / totalSpools) * 100);
        // Only include materials that represent at least 5% of the collection
        if (percentage >= 5) {
          materialDistribution.push({
            name: material.toUpperCase(),
            percentage
          });
        }
      });

      // Sort by percentage (descending)
      materialDistribution.sort((a, b) => b.percentage - a.percentage);

      // Get top 3 materials
      const topMaterials = materialDistribution.slice(0, 3).map(m => m.name);

      // Get top 3 colors
      const topColors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([color]) => color);

      res.json({
        totalSpools,
        totalWeight: totalWeight.toFixed(2),
        remainingWeight: totalRemainingWeight.toFixed(2),
        averageRemaining,
        lowStockCount,
        materialDistribution: materialDistribution.slice(0, 5), // Top 5 materials
        topMaterials,
        topColors,
        estimatedValue: Math.round(totalValue), // Rounded to nearest EUR
        totalPurchaseValue: Math.round(totalPurchaseValue), // Total purchase value
        averageAge, // Average age in days
        oldestFilament, // Oldest filament info
        newestFilament // Newest filament info
      });
    } catch (error) {
      console.error("Error calculating statistics:", error);
      res.status(500).json({ message: "Failed to calculate statistics" });
    }
  });

  // API-Routen für die Einstellungslisten

  // --- Hersteller (Manufacturers) ---

  // GET all manufacturers
  app.get("/api/manufacturers", authenticate, async (req, res) => {
    try {
      const manufacturers = await storage.getManufacturers();

      // Check if export parameter is set
      if (req.query.export === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="manufacturers.csv"');

        // Create CSV header and content
        let csvContent = 'name\n';
        manufacturers.forEach(manufacturer => {
          csvContent += `${manufacturer.name}\n`;
        });

        return res.send(csvContent);
      }

      res.json(manufacturers);
    } catch (error) {
      console.error("Error fetching manufacturers:", error);
      res.status(500).json({ message: "Failed to fetch manufacturers" });
    }
  });

  // POST create a new manufacturer
  app.post("/api/manufacturers", authenticate, async (req, res) => {
    try {
      // Check if this is a CSV import
      if (req.query.import === 'csv' && req.body.csvData) {
        const results = {
          created: 0,
          duplicates: 0,
          errors: 0
        };

        // Parse CSV data
        const csvLines = req.body.csvData.split('\n');

        // Determine if there's a header and find the column index for the name
        let headerRow = csvLines[0].toLowerCase();
        let startIndex = 0;
        let nameColumnIndex = 0;

        // Check if header exists by looking for common header names
        if (headerRow.includes('name') || headerRow.includes('hersteller') || headerRow.includes('vendor')) {
          startIndex = 1;
          // If there are multiple columns, determine which one has the name
          if (headerRow.includes(',')) {
            const headers = headerRow.split(',');
            for (let i = 0; i < headers.length; i++) {
              if (headers[i].includes('name') || headers[i].includes('hersteller') || headers[i].includes('vendor')) {
                nameColumnIndex = i;
                break;
              }
            }
          }
        }

        console.log(`CSV Import: Starting at line ${startIndex}, name column index: ${nameColumnIndex}`);

        for (let i = startIndex; i < csvLines.length; i++) {
          const line = csvLines[i].trim();
          if (!line) continue;

          try {
            // Get the name from the appropriate column if there are multiple columns
            let name;
            if (line.includes(',')) {
              const columns = line.split(',');
              name = columns[nameColumnIndex].trim();
            } else {
              name = line.trim();
            }

            if (!name) {
              console.warn(`Empty name at line ${i + 1}, skipping`);
              continue;
            }

            // Überprüfe auf leere Namen
            if (!name || name.trim() === '') {
              console.warn(`Leerer Herstellername in Zeile ${i + 1}, überspringe...`);
              continue;
            }

            // Check if manufacturer already exists
            const existingManufacturers = await storage.getManufacturers();
            const existingManufacturer = existingManufacturers.find(m =>
              m.name.toLowerCase() === name.toLowerCase()
            );

            if (existingManufacturer) {
              console.log(`Doppelter Hersteller: "${name}" in Zeile ${i + 1}, bereits vorhanden mit ID ${existingManufacturer.id}`);
              results.duplicates++;
              continue;
            }

            // Create new manufacturer
            const validatedData = insertManufacturerSchema.parse({ name });
            await storage.createManufacturer(validatedData);
            console.log(`Created manufacturer: "${name}" at line ${i + 1}`);
            results.created++;
          } catch (err) {
            console.error(`Error importing manufacturer at line ${i + 1}:`, err);
            results.errors++;
          }
        }

        return res.status(201).json(results);
      }

      // Regular single manufacturer creation
      const data = req.body;
      const validatedData = insertManufacturerSchema.parse(data);
      const newManufacturer = await storage.createManufacturer(validatedData);
      res.status(201).json(newManufacturer);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating manufacturer:", error);
      res.status(500).json({ message: "Failed to create manufacturer" });
    }
  });

  // DELETE a manufacturer
  app.delete("/api/manufacturers/:id", authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid manufacturer ID" });
      }

      // 1. Get the manufacturer to find its name
      const manufacturers = await storage.getManufacturers();
      const manufacturer = manufacturers.find(m => m.id === id);

      if (!manufacturer) {
        return res.status(404).json({ message: "Manufacturer not found" });
      }

      // 2. Check if any filaments use this manufacturer
      const filaments = await storage.getFilaments(req.userId);
      const inUse = filaments.some(f => f.manufacturer === manufacturer.name);

      if (inUse) {
        return res.status(400).json({
          message: "Cannot delete manufacturer that is in use by filaments",
          detail: "Diese Hersteller wird von einem oder mehreren Filamenten verwendet"
        });
      }

      // 3. Now we can safely delete
      const success = await storage.deleteManufacturer(id);
      if (!success) {
        return res.status(404).json({ message: "Manufacturer not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting manufacturer:", error);
      res.status(500).json({ message: "Failed to delete manufacturer" });
    }
  });

  // PATCH update manufacturer order
  app.patch("/api/manufacturers/:id/order", authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid manufacturer ID" });
      }

      const { newOrder } = req.body;
      if (typeof newOrder !== 'number') {
        return res.status(400).json({ message: "newOrder must be a number" });
      }

      const updatedManufacturer = await storage.updateManufacturerOrder(id, newOrder);
      if (!updatedManufacturer) {
        return res.status(404).json({ message: "Manufacturer not found" });
      }

      res.json(updatedManufacturer);
    } catch (error) {
      console.error("Error updating manufacturer order:", error);
      res.status(500).json({ message: "Failed to update manufacturer order" });
    }
  });

  // --- Materialien (Materials) ---

  // GET all materials
  app.get("/api/materials", authenticate, async (req, res) => {
    try {
      const materials = await storage.getMaterials();

      // Check if export parameter is set
      if (req.query.export === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="materials.csv"');

        // Create CSV header and content
        let csvContent = 'name\n';
        materials.forEach(material => {
          csvContent += `${material.name}\n`;
        });

        return res.send(csvContent);
      }

      res.json(materials);
    } catch (error) {
      console.error("Error fetching materials:", error);
      res.status(500).json({ message: "Failed to fetch materials" });
    }
  });

  // POST create a new material
  app.post("/api/materials", authenticate, async (req, res) => {
    try {
      // Check if this is a CSV import
      if (req.query.import === 'csv' && req.body.csvData) {
        const results = {
          created: 0,
          duplicates: 0,
          errors: 0
        };

        // Parse CSV data
        const csvLines = req.body.csvData.split('\n');

        // Determine if there's a header and find the column index for the name
        let headerRow = csvLines[0].toLowerCase();
        let startIndex = 0;
        let nameColumnIndex = 0;

        // Check if header exists by looking for common header names
        if (headerRow.includes('name') || headerRow.includes('material') || headerRow.includes('type')) {
          startIndex = 1;
          // If there are multiple columns, determine which one has the name
          if (headerRow.includes(',')) {
            const headers = headerRow.split(',');
            for (let i = 0; i < headers.length; i++) {
              if (headers[i].includes('name') || headers[i].includes('material') || headers[i].includes('type')) {
                nameColumnIndex = i;
                break;
              }
            }
          }
        }

        console.log(`CSV Import Materials: Starting at line ${startIndex}, name column index: ${nameColumnIndex}`);

        for (let i = startIndex; i < csvLines.length; i++) {
          const line = csvLines[i].trim();
          if (!line) continue;

          try {
            // Get the name from the appropriate column if there are multiple columns
            let name;
            if (line.includes(',')) {
              const columns = line.split(',');
              name = columns[nameColumnIndex].trim();
            } else {
              name = line.trim();
            }

            if (!name) {
              console.warn(`Empty material name at line ${i + 1}, skipping`);
              continue;
            }

            // Überprüfe auf leere Namen
            if (!name || name.trim() === '') {
              console.warn(`Leerer Materialname in Zeile ${i + 1}, überspringe...`);
              continue;
            }

            // Check if material already exists
            const existingMaterials = await storage.getMaterials();
            const existingMaterial = existingMaterials.find(m =>
              m.name.toLowerCase() === name.toLowerCase()
            );

            if (existingMaterial) {
              console.log(`Doppeltes Material: "${name}" in Zeile ${i + 1}, bereits vorhanden mit ID ${existingMaterial.id}`);
              results.duplicates++;
              continue;
            }

            // Create new material
            const validatedData = insertMaterialSchema.parse({ name });
            await storage.createMaterial(validatedData);
            console.log(`Created material: "${name}" at line ${i + 1}`);
            results.created++;
          } catch (err) {
            console.error(`Error importing material at line ${i + 1}:`, err);
            results.errors++;
          }
        }

        return res.status(201).json(results);
      }

      // Regular single material creation
      const data = req.body;
      const validatedData = insertMaterialSchema.parse(data);
      const newMaterial = await storage.createMaterial(validatedData);
      res.status(201).json(newMaterial);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating material:", error);
      res.status(500).json({ message: "Failed to create material" });
    }
  });

  // DELETE a material
  app.delete("/api/materials/:id", authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid material ID" });
      }

      // 1. Get the material to find its name
      const materials = await storage.getMaterials();
      const material = materials.find(m => m.id === id);

      if (!material) {
        return res.status(404).json({ message: "Material not found" });
      }

      // 2. Check if any filaments use this material
      const filaments = await storage.getFilaments(req.userId);
      const inUse = filaments.some(f => f.material === material.name);

      if (inUse) {
        return res.status(400).json({
          message: "Cannot delete material that is in use by filaments",
          detail: "Dieses Material wird von einem oder mehreren Filamenten verwendet"
        });
      }

      // 3. Now we can safely delete
      const success = await storage.deleteMaterial(id);
      if (!success) {
        return res.status(404).json({ message: "Material not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting material:", error);
      res.status(500).json({ message: "Failed to delete material" });
    }
  });

  // PATCH update material order
  app.patch("/api/materials/:id/order", authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid material ID" });
      }

      const { newOrder } = req.body;
      if (typeof newOrder !== 'number') {
        return res.status(400).json({ message: "newOrder must be a number" });
      }

      const updatedMaterial = await storage.updateMaterialOrder(id, newOrder);
      if (!updatedMaterial) {
        return res.status(404).json({ message: "Material not found" });
      }

      res.json(updatedMaterial);
    } catch (error) {
      console.error("Error updating material order:", error);
      res.status(500).json({ message: "Failed to update material order" });
    }
  });

  // --- Farben (Colors) ---

  // GET all colors
  app.get("/api/colors", authenticate, async (req, res) => {
    try {
      const colors = await storage.getColors();

      // Check if export parameter is set
      if (req.query.export === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="colors.csv"');

        // Create CSV header and content
        let csvContent = 'name,code\n';
        colors.forEach(color => {
          csvContent += `${color.name},${color.code}\n`;
        });

        return res.send(csvContent);
      }

      res.json(colors);
    } catch (error) {
      console.error("Error fetching colors:", error);
      res.status(500).json({ message: "Failed to fetch colors" });
    }
  });

  // POST create a new color
  app.post("/api/colors", authenticate, async (req, res) => {
    try {
      // Check if this is a CSV import
      if (req.query.import === 'csv' && req.body.csvData) {
        const results = {
          created: 0,
          duplicates: 0,
          errors: 0
        };

        // Parse CSV data
        const csvLines = req.body.csvData.split('\n');
        // Skip header row if present
        const startIndex = csvLines[0].toLowerCase().includes('name') || csvLines[0].toLowerCase().includes('brand') ? 1 : 0;

        // Get existing colors once to improve performance
        const existingColors = await storage.getColors();

        for (let i = startIndex; i < csvLines.length; i++) {
          const line = csvLines[i].trim();
          if (!line) continue;

          try {
            // Manuelles Parsen von CSV-Zeilen mit oder ohne Anführungszeichen
            // Format: Brand,Color Name,Hex Code
            let name, code;

            const firstCommaIndex = line.indexOf(',');
            if (firstCommaIndex === -1) {
              results.errors++;
              console.error(`No commas found in line ${i + 1}: ${line}`);
              continue;
            }

            const secondCommaIndex = line.indexOf(',', firstCommaIndex + 1);
            if (secondCommaIndex === -1) {
              // Einfaches Format: Name,Code
              name = line.substring(0, firstCommaIndex).trim().replace(/"/g, '');
              code = line.substring(firstCommaIndex + 1).trim().replace(/"/g, '');
            } else {
              // Format: Brand,Color Name,Hex Code
              const brand = line.substring(0, firstCommaIndex).trim().replace(/"/g, '');
              const colorName = line.substring(firstCommaIndex + 1, secondCommaIndex).trim().replace(/"/g, '');
              name = `${colorName} (${brand})`;
              code = line.substring(secondCommaIndex + 1).trim().replace(/"/g, '');
            }

            // Überprüfe, ob alle benötigten Werte vorhanden sind
            if (!name || !code) {
              results.errors++;
              console.error(`Missing required values in line ${i + 1}: ${line}`);
              continue;
            }

            // Make sure code is a valid color code
            if (!code.startsWith('#')) {
              code = '#' + code;
            }

            // Check if color already exists - look for exact combination of name and code
            const exists = existingColors.some(c =>
              c.name.toLowerCase() === name.toLowerCase() &&
              c.code.toLowerCase() === code.toLowerCase()
            );

            if (exists) {
              results.duplicates++;
              continue;
            }

            // Create new color
            const validatedData = insertColorSchema.parse({ name, code });
            await storage.createColor(validatedData);
            results.created++;
          } catch (err) {
            console.error(`Error importing color at line ${i + 1}:`, err);
            results.errors++;
          }
        }

        return res.status(201).json(results);
      }

      // Regular single color creation
      const data = req.body;
      const validatedData = insertColorSchema.parse(data);
      const newColor = await storage.createColor(validatedData);
      res.status(201).json(newColor);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating color:", error);
      res.status(500).json({ message: "Failed to create color" });
    }
  });

  // DELETE a color
  app.delete("/api/colors/:id", authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid color ID" });
      }

      // 1. Get the color to find its name
      const colors = await storage.getColors();
      const color = colors.find(c => c.id === id);

      if (!color) {
        return res.status(404).json({ message: "Color not found" });
      }

      // 2. Check if any filaments use this color name or color code
      const filaments = await storage.getFilaments(req.userId);
      const inUse = filaments.some(f =>
        f.colorName === color.name ||
        f.colorCode === color.code
      );

      if (inUse) {
        return res.status(400).json({
          message: "Cannot delete color that is in use by filaments",
          detail: "Diese Farbe wird von einem oder mehreren Filamenten verwendet"
        });
      }

      // 3. Now we can safely delete
      const success = await storage.deleteColor(id);
      if (!success) {
        return res.status(404).json({ message: "Color not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting color:", error);
      res.status(500).json({ message: "Failed to delete color" });
    }
  });

  // --- Durchmesser (Diameters) ---

  // GET all diameters
  app.get("/api/diameters", authenticate, async (req, res) => {
    try {
      const diameters = await storage.getDiameters();

      // Check if export parameter is set
      if (req.query.export === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="diameters.csv"');

        // Create CSV header and content
        let csvContent = 'value\n';
        diameters.forEach(diameter => {
          csvContent += `${diameter.value}\n`;
        });

        return res.send(csvContent);
      }

      res.json(diameters);
    } catch (error) {
      console.error("Error fetching diameters:", error);
      res.status(500).json({ message: "Failed to fetch diameters" });
    }
  });

  // POST create a new diameter
  app.post("/api/diameters", authenticate, async (req, res) => {
    try {
      // Check if this is a CSV import
      if (req.query.import === 'csv' && req.body.csvData) {
        const results = {
          created: 0,
          duplicates: 0,
          errors: 0
        };

        // Parse CSV data
        const csvLines = req.body.csvData.split('\n');
        // Skip header row if present
        const startIndex = csvLines[0].toLowerCase().includes('value') ? 1 : 0;

        for (let i = startIndex; i < csvLines.length; i++) {
          const line = csvLines[i].trim();
          if (!line) continue;

          try {
            const value = line;

            // Check if diameter already exists
            const existingDiameters = await storage.getDiameters();
            const exists = existingDiameters.some(d => d.value.toLowerCase() === value.toLowerCase());

            if (exists) {
              results.duplicates++;
              continue;
            }

            // Create new diameter
            const validatedData = insertDiameterSchema.parse({ value });
            await storage.createDiameter(validatedData);
            results.created++;
          } catch (err) {
            console.error(`Error importing diameter at line ${i + 1}:`, err);
            results.errors++;
          }
        }

        return res.status(201).json(results);
      }

      // Regular single diameter creation
      const data = req.body;
      const validatedData = insertDiameterSchema.parse(data);
      const newDiameter = await storage.createDiameter(validatedData);
      res.status(201).json(newDiameter);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating diameter:", error);
      res.status(500).json({ message: "Failed to create diameter" });
    }
  });

  // DELETE a diameter
  app.delete("/api/diameters/:id", authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid diameter ID" });
      }

      // 1. Get the diameter to find its value
      const diameters = await storage.getDiameters();
      const diameter = diameters.find(d => d.id === id);

      if (!diameter) {
        return res.status(404).json({ message: "Diameter not found" });
      }

      // 2. Check if any filaments use this diameter
      const filaments = await storage.getFilaments(req.userId);
      const inUse = filaments.some(f => f.diameter === diameter.value.toString());

      if (inUse) {
        return res.status(400).json({
          message: "Cannot delete diameter that is in use by filaments",
          detail: "Dieser Durchmesser wird von einem oder mehreren Filamenten verwendet"
        });
      }

      // 3. Now we can safely delete
      const success = await storage.deleteDiameter(id);
      if (!success) {
        return res.status(404).json({ message: "Diameter not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting diameter:", error);
      res.status(500).json({ message: "Failed to delete diameter" });
    }
  });

  // --- Lagerorte (Storage Locations) ---

  // GET all storage locations
  app.get("/api/storage-locations", authenticate, async (req, res) => {
    try {
      const locations = await storage.getStorageLocations();

      // Check if export parameter is set
      if (req.query.export === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="storage-locations.csv"');

        // Create CSV header and content
        let csvContent = 'name\n';
        locations.forEach(location => {
          csvContent += `${location.name}\n`;
        });

        return res.send(csvContent);
      }

      res.json(locations);
    } catch (error) {
      console.error("Error fetching storage locations:", error);
      res.status(500).json({ message: "Failed to fetch storage locations" });
    }
  });

  // POST create a new storage location
  app.post("/api/storage-locations", authenticate, async (req, res) => {
    try {
      // Check if this is a CSV import
      if (req.query.import === 'csv' && req.body.csvData) {
        const results = {
          created: 0,
          duplicates: 0,
          errors: 0
        };

        // Parse CSV data
        const csvLines = req.body.csvData.split('\n');
        // Skip header row if present
        const startIndex = csvLines[0].toLowerCase().includes('name') ? 1 : 0;

        for (let i = startIndex; i < csvLines.length; i++) {
          const line = csvLines[i].trim();
          if (!line) continue;

          try {
            const name = line;

            // Überprüfe auf leere Namen
            if (!name || name.trim() === '') {
              console.warn(`Leerer Lagerort-Name in Zeile ${i + 1}, überspringe...`);
              continue;
            }

            // Check if storage location already exists
            const existingLocations = await storage.getStorageLocations();
            const existingLocation = existingLocations.find(l =>
              l.name.toLowerCase() === name.toLowerCase()
            );

            if (existingLocation) {
              console.log(`Doppelter Lagerort: "${name}" in Zeile ${i + 1}, bereits vorhanden mit ID ${existingLocation.id}`);
              results.duplicates++;
              continue;
            }

            // Create new storage location
            const validatedData = insertStorageLocationSchema.parse({ name });
            await storage.createStorageLocation(validatedData);
            results.created++;
          } catch (err) {
            console.error(`Error importing storage location at line ${i + 1}:`, err);
            results.errors++;
          }
        }

        return res.status(201).json(results);
      }

      // Regular single storage location creation
      const data = req.body;
      const validatedData = insertStorageLocationSchema.parse(data);
      const newLocation = await storage.createStorageLocation(validatedData);
      res.status(201).json(newLocation);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating storage location:", error);
      res.status(500).json({ message: "Failed to create storage location" });
    }
  });

  // DELETE a storage location
  app.delete("/api/storage-locations/:id", authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid storage location ID" });
      }

      // 1. Get the storage location to find its name
      const locations = await storage.getStorageLocations();
      const location = locations.find(l => l.id === id);

      if (!location) {
        return res.status(404).json({ message: "Storage location not found" });
      }

      // 2. Check if any filaments use this storage location
      const filaments = await storage.getFilaments(req.userId);
      const inUse = filaments.some(f => f.storageLocation === location.name);

      if (inUse) {
        return res.status(400).json({
          message: "Cannot delete storage location that is in use by filaments",
          detail: "Dieser Lagerort wird von einem oder mehreren Filamenten verwendet"
        });
      }

      // 3. Now we can safely delete
      const success = await storage.deleteStorageLocation(id);
      if (!success) {
        return res.status(404).json({ message: "Storage location not found" });
      }

      res.status(204).end();
    } catch (error) {
      console.error("Error deleting storage location:", error);
      res.status(500).json({ message: "Failed to delete storage location" });
    }
  });

  // PATCH update storage location order
  app.patch("/api/storage-locations/:id/order", authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid storage location ID" });
      }

      const { newOrder } = req.body;
      if (typeof newOrder !== 'number') {
        return res.status(400).json({ message: "newOrder must be a number" });
      }

      const updatedLocation = await storage.updateStorageLocationOrder(id, newOrder);
      if (!updatedLocation) {
        return res.status(404).json({ message: "Storage location not found" });
      }

      res.json(updatedLocation);
    } catch (error) {
      console.error("Error updating storage location order:", error);
      res.status(500).json({ message: "Failed to update storage location order" });
    }
  });

  // --- Theme Einstellungen ---

  // GET aktuelles Theme
  app.get("/api/theme", (_req, res) => {
    try {
      const themePath = path.resolve("./theme.json");
      if (!fs.existsSync(themePath)) {
        return res.status(404).json({ message: "Theme file not found" });
      }

      const theme = JSON.parse(fs.readFileSync(themePath, 'utf-8'));
      res.json(theme);
    } catch (error) {
      console.error("Error reading theme:", error);
      res.status(500).json({ message: "Failed to read theme" });
    }
  });

  // UPDATE Theme
  app.post("/api/theme", (req, res) => {
    try {
      const themeSchema = z.object({
        variant: z.enum(["professional", "tint", "vibrant"]),
        primary: z.string(),
        appearance: z.enum(["light", "dark", "system"]),
        radius: z.number()
      });

      const data = req.body;
      const validatedData = themeSchema.parse(data);

      const themePath = path.resolve("./theme.json");
      fs.writeFileSync(themePath, JSON.stringify(validatedData, null, 2));

      res.json(validatedData);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error updating theme:", error);
      res.status(500).json({ message: "Failed to update theme" });
    }
  });

  // User sharing routes
  app.post("/api/sharing", authenticate, async (req, res) => {
    try {
      const { materialId, isPublic } = req.body;

      // Check if sharing already exists
      const existingSharing = await db.select()
        .from(userSharing)
        .where(
          and(
            eq(userSharing.userId, req.userId),
            materialId ? eq(userSharing.materialId, materialId) : isNull(userSharing.materialId)
          )
        );

      if (existingSharing.length > 0) {
        // Update existing sharing
        await db.update(userSharing)
          .set({ isPublic })
          .where(eq(userSharing.id, existingSharing[0].id));
      } else {
        // Create new sharing
        await db.insert(userSharing).values({
          userId: req.userId,
          materialId: materialId || null,
          isPublic
        });
      }

      res.json({ message: "Sharing preferences updated" });
    } catch (error) {
      console.error("Sharing update error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/sharing", authenticate, async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const sharingSettings = await db.select()
        .from(userSharing)
        .where(and(eq(userSharing.userId, req.user.id)));

      res.json(sharingSettings);
    } catch (error) {
      console.error("Get sharing error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Public filament routes (for sharing)
  app.get("/api/public/filaments/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Get user's sharing settings
      const sharingSettings = await db.select()
        .from(userSharing)
        .where(and(
          eq(userSharing.userId, userId),
          eq(userSharing.isPublic, true)
        ));

      if (sharingSettings.length === 0) {
        return res.status(404).json({ message: "No shared filaments found" });
      }

      // Check if user has global sharing enabled
      const hasGlobalSharing = sharingSettings.some((s: any) => s.materialId === null);

      // Get shared materials
      const sharedMaterialIds = sharingSettings
        .filter((s: any) => s.materialId !== null)
        .map((s: any) => s.materialId);

      // Get all filaments for this user
      const allFilaments = await storage.getFilaments(req.userId);

      // Filter filaments based on sharing settings
      const sharedFilaments = allFilaments.filter((filament: any) => {
        // Check for global sharing
        if (hasGlobalSharing) return true;

        // Check for material-specific sharing
        return filament.material &&
               sharedMaterialIds.includes(parseInt(filament.material));
      });

      res.json(sharedFilaments);
    } catch (error) {
      console.error("Get public filaments error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
