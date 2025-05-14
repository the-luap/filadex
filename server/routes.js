import { createServer } from "http";
import { storage } from "./storage.js";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { isAdmin, hashPassword, verifyPassword, generateToken, initializeAdminUser } from "./auth.js";
import { users, userSharing, changePasswordSchema } from "../shared/schema.js";
import { eq, count, isNull, and } from "drizzle-orm";

export async function registerRoutes(app, authenticate, db, schema, logger) {
  // Initialize admin user
  await initializeAdminUser();

  // Filament routes
  app.get("/api/filaments", authenticate, async (req, res) => {
    try {
      const filaments = await storage.getFilaments(req.userId);
      res.json(filaments);
    } catch (error) {
      logger.error("Error fetching filaments:", error);
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
      logger.error("Error fetching filament:", error);
      res.status(500).json({ message: "Failed to fetch filament" });
    }
  });

  // POST create a new filament
  app.post("/api/filaments", authenticate, async (req, res) => {
    try {
      logger.info("Received request to create filament:", req.body);

      // Prepare the input data for the database
      const data = req.body;
      const insertData = {
        userId: req.userId,
        name: data.name,
        manufacturer: data.manufacturer,
        material: data.material,
        colorName: data.colorName,
        colorCode: data.colorCode,
        printTemp: data.printTemp,
        // Store numeric values as strings
        diameter: data.diameter ? data.diameter.toString() : undefined,
        totalWeight: data.totalWeight.toString(),
        remainingPercentage: data.remainingPercentage.toString(),
        // Add missing fields
        purchaseDate: data.purchaseDate,
        purchasePrice: data.purchasePrice ? data.purchasePrice.toString() : undefined,
        status: data.status,
        spoolType: data.spoolType,
        dryerCount: data.dryerCount,
        lastDryingDate: data.lastDryingDate,
        storageLocation: data.storageLocation
      };

      logger.info("Prepared insert data:", insertData);
      const newFilament = await storage.createFilament(insertData);
      logger.info("Created new filament:", newFilament);
      res.status(201).json(newFilament);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        logger.error("Validation error:", validationError.message);
        return res.status(400).json({ message: validationError.message });
      }
      logger.error("Error creating filament:", error);
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

      // Prepare the input data for the database
      const data = req.body;
      const updateData = {};

      // Only update fields that are included in the request
      if (data.name !== undefined) updateData.name = data.name;
      if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer;
      if (data.material !== undefined) updateData.material = data.material;
      if (data.colorName !== undefined) updateData.colorName = data.colorName;
      if (data.colorCode !== undefined) updateData.colorCode = data.colorCode;
      if (data.printTemp !== undefined) updateData.printTemp = data.printTemp;
      if (data.diameter !== undefined) updateData.diameter = data.diameter.toString();
      if (data.totalWeight !== undefined) updateData.totalWeight = data.totalWeight.toString();
      if (data.remainingPercentage !== undefined) updateData.remainingPercentage = data.remainingPercentage.toString();
      if (data.purchaseDate !== undefined) updateData.purchaseDate = data.purchaseDate;
      if (data.purchasePrice !== undefined) updateData.purchasePrice = data.purchasePrice ? data.purchasePrice.toString() : null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.spoolType !== undefined) updateData.spoolType = data.spoolType;
      if (data.dryerCount !== undefined) updateData.dryerCount = data.dryerCount;
      if (data.lastDryingDate !== undefined) updateData.lastDryingDate = data.lastDryingDate;
      if (data.storageLocation !== undefined) updateData.storageLocation = data.storageLocation;

      logger.info("Prepared update data:", updateData);

      const updatedFilament = await storage.updateFilament(id, updateData, req.userId);
      if (!updatedFilament) {
        return res.status(404).json({ message: "Filament not found" });
      }

      res.json(updatedFilament);
    } catch (error) {
      logger.error("Error updating filament:", error);
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
      logger.error("Error deleting filament:", error);
      res.status(500).json({ message: "Failed to delete filament" });
    }
  });

  // Statistics endpoint
  app.get("/api/statistics", authenticate, async (req, res) => {
    try {
      // Get filaments for the current user
      const filaments = await storage.getFilaments(req.userId);

      // Calculate statistics
      const totalSpools = filaments.length;

      // Calculate total and remaining weight
      let totalWeight = 0;
      let remainingWeight = 0;

      filaments.forEach(filament => {
        const total = parseFloat(filament.totalWeight);
        const remaining = total * (parseFloat(filament.remainingPercentage) / 100);

        totalWeight += total;
        remainingWeight += remaining;
      });

      // Calculate average remaining percentage
      const averageRemaining = totalSpools > 0
        ? Math.round(filaments.reduce((sum, f) => sum + parseFloat(f.remainingPercentage), 0) / totalSpools)
        : 0;

      // Count low stock filaments (less than 25% remaining)
      const lowStockCount = filaments.filter(f => parseFloat(f.remainingPercentage) < 25).length;

      // Calculate material distribution
      const materialCounts = {};
      filaments.forEach(f => {
        if (f.material) {
          materialCounts[f.material] = (materialCounts[f.material] || 0) + 1;
        }
      });

      const materialDistribution = Object.entries(materialCounts).map(([name, count]) => ({
        name,
        percentage: Math.round((count / totalSpools) * 100)
      })).sort((a, b) => b.percentage - a.percentage);

      // Get top materials and colors
      const topMaterials = Object.entries(materialCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      const colorCounts = {};
      filaments.forEach(f => {
        if (f.colorName) {
          colorCounts[f.colorName] = (colorCounts[f.colorName] || 0) + 1;
        }
      });

      const topColors = Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      // Calculate estimated value and total purchase value
      let estimatedValue = 0;
      let totalPurchaseValue = 0;

      filaments.forEach(f => {
        if (f.purchasePrice) {
          const price = parseFloat(f.purchasePrice);
          if (!isNaN(price)) {
            const total = price;
            totalPurchaseValue += total;

            // Estimated value based on remaining percentage
            const remaining = total * (parseFloat(f.remainingPercentage) / 100);
            estimatedValue += remaining;
          }
        }
      });

      // Calculate age statistics
      const now = new Date();
      const ages = filaments
        .filter(f => f.purchaseDate)
        .map(f => {
          const purchaseDate = new Date(f.purchaseDate);
          const ageInDays = Math.floor((now - purchaseDate) / (1000 * 60 * 60 * 24));
          return { name: f.name, days: ageInDays };
        });

      const averageAge = ages.length > 0
        ? Math.round(ages.reduce((sum, a) => sum + a.days, 0) / ages.length)
        : 0;

      const oldestFilament = ages.length > 0
        ? ages.reduce((oldest, current) => current.days > oldest.days ? current : oldest, ages[0])
        : null;

      const newestFilament = ages.length > 0
        ? ages.reduce((newest, current) => current.days < newest.days ? current : newest, ages[0])
        : null;

      // Return statistics
      res.json({
        totalSpools,
        totalWeight: totalWeight.toFixed(2),
        remainingWeight: remainingWeight.toFixed(2),
        averageRemaining,
        lowStockCount,
        materialDistribution,
        topMaterials,
        topColors,
        estimatedValue: Math.round(estimatedValue),
        totalPurchaseValue: Math.round(totalPurchaseValue),
        averageAge,
        oldestFilament,
        newestFilament
      });
    } catch (error) {
      logger.error("Error calculating statistics:", error);
      res.status(500).json({ message: "Failed to calculate statistics" });
    }
  });

  // Return a server instance
  const httpServer = createServer(app);
  return httpServer;
}
