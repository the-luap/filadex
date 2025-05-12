import type { Express } from "express";
import { createServer, type Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertFilamentSchema, InsertFilament,
  insertManufacturerSchema, InsertManufacturer,
  insertMaterialSchema, InsertMaterial,
  insertColorSchema, InsertColor,
  insertDiameterSchema, InsertDiameter,
  insertStorageLocationSchema, InsertStorageLocation
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // GET all filaments
  app.get("/api/filaments", async (req, res) => {
    try {
      const filaments = await storage.getFilaments();
      res.json(filaments);
    } catch (error) {
      console.error("Error fetching filaments:", error);
      res.status(500).json({ message: "Failed to fetch filaments" });
    }
  });

  // GET a single filament by ID
  app.get("/api/filaments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid filament ID" });
      }

      const filament = await storage.getFilament(id);
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
  app.post("/api/filaments", async (req, res) => {
    try {
      console.log("Received request to create filament:", req.body);
      
      // Manuell die Eingabedaten für die Datenbank vorbereiten
      const data = req.body;
      const insertData: InsertFilament = {
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
  app.patch("/api/filaments/:id", async (req, res) => {
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
      
      const updatedFilament = await storage.updateFilament(id, updateData);
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

  // DELETE a filament
  app.delete("/api/filaments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid filament ID" });
      }

      const success = await storage.deleteFilament(id);
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
  app.get("/api/statistics", async (req, res) => {
    try {
      const filaments = await storage.getFilaments();
      
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
  app.get("/api/manufacturers", async (req, res) => {
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
  app.post("/api/manufacturers", async (req, res) => {
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
  app.delete("/api/manufacturers/:id", async (req, res) => {
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
      const filaments = await storage.getFilaments();
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
  app.patch("/api/manufacturers/:id/order", async (req, res) => {
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
  app.get("/api/materials", async (req, res) => {
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
  app.post("/api/materials", async (req, res) => {
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
  app.delete("/api/materials/:id", async (req, res) => {
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
      const filaments = await storage.getFilaments();
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
  app.patch("/api/materials/:id/order", async (req, res) => {
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
  app.get("/api/colors", async (req, res) => {
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
  app.post("/api/colors", async (req, res) => {
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
  app.delete("/api/colors/:id", async (req, res) => {
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
      const filaments = await storage.getFilaments();
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
  app.get("/api/diameters", async (req, res) => {
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
  app.post("/api/diameters", async (req, res) => {
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
  app.delete("/api/diameters/:id", async (req, res) => {
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
      const filaments = await storage.getFilaments();
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
  app.get("/api/storage-locations", async (req, res) => {
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
  app.post("/api/storage-locations", async (req, res) => {
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
  app.delete("/api/storage-locations/:id", async (req, res) => {
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
      const filaments = await storage.getFilaments();
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
  app.patch("/api/storage-locations/:id/order", async (req, res) => {
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
  app.get("/api/theme", (req, res) => {
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

  const httpServer = createServer(app);

  return httpServer;
}
