import { insertFilamentSchema } from './shared/schema.js';
import { db } from './server/db.js';
import { filaments, manufacturers, materials, diameters, colors, storageLocations } from './shared/schema.js';
import fs from 'fs';
import path from 'path';

async function insertInitialData() {
  try {
    // Prüfe Lock-Datei, um wiederholte Initialisierung zu verhindern
    const lockFile = path.resolve('./init-data.lock');
    
    if (fs.existsSync(lockFile)) {
      console.log("Datenbank wurde bereits initialisiert (Lock-Datei gefunden). Überspringe Dateneinfügung.");
      process.exit(0);
      return;
    }
    
    console.log("Checking for existing data...");
    
    // Prüfen, ob alle erforderlichen Tabellen existieren
    try {
      await db.select().from(manufacturers).limit(1);
      await db.select().from(materials).limit(1);
      await db.select().from(colors).limit(1);
      await db.select().from(diameters).limit(1);
      await db.select().from(storageLocations).limit(1);
      await db.select().from(filaments).limit(1);
      console.log("Alle Tabellen existieren und sind zugänglich.");
    } catch (error) {
      console.error("Fehler beim Prüfen der Tabellen:", error);
      console.log("Versuche Tabellen zu erstellen...");
      
      try {
        // Erstelle hier die Tabellen manuell, wenn sie nicht existieren
        await db.execute(`
          CREATE TABLE IF NOT EXISTS manufacturers (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
          
          CREATE TABLE IF NOT EXISTS materials (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
          
          CREATE TABLE IF NOT EXISTS colors (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
          
          CREATE TABLE IF NOT EXISTS diameters (
            id SERIAL PRIMARY KEY,
            value NUMERIC NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
          
          CREATE TABLE IF NOT EXISTS storage_locations (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
          
          CREATE TABLE IF NOT EXISTS filaments (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            manufacturer TEXT,
            material TEXT NOT NULL,
            color_name TEXT,
            color_code TEXT,
            diameter NUMERIC,
            print_temp TEXT,
            total_weight NUMERIC NOT NULL,
            remaining_percentage NUMERIC NOT NULL,
            purchase_date DATE,
            purchase_price NUMERIC,
            status TEXT,
            spool_type TEXT,
            dryer_count INTEGER DEFAULT 0 NOT NULL,
            last_drying_date DATE,
            storage_location TEXT
          );
        `);
        console.log("Tabellen erfolgreich erstellt.");
      } catch (createError) {
        console.error("Fehler beim Erstellen der Tabellen:", createError);
        process.exit(1);
      }
    }
    
    // Prüfe, ob Daten bereits existieren
    const existingData = await db.select().from(manufacturers);
    
    if (existingData.length > 0) {
      console.log("Daten bereits in der Datenbank vorhanden, überspringe Initialisierung.");
      // Erstelle Lock-Datei, um zukünftige Initialisierungen zu verhindern
      fs.writeFileSync(lockFile, new Date().toISOString());
      process.exit(0);
      return;
    }
    
    console.log("Füge initiale Daten ein...");
    
    // Füge grundlegende Auswahlmöglichkeiten ein
    console.log("Füge grundlegende Materialien, Hersteller usw. ein...");
    try {
      await db.insert(manufacturers).values({ name: "Bambu Lab" }).onConflictDoNothing();
      await db.insert(manufacturers).values({ name: "Prusament" }).onConflictDoNothing();
      await db.insert(manufacturers).values({ name: "Filamentworld" }).onConflictDoNothing();
      await db.insert(manufacturers).values({ name: "Ninjatek" }).onConflictDoNothing();
      
      await db.insert(materials).values({ name: "PLA" }).onConflictDoNothing();
      await db.insert(materials).values({ name: "PETG" }).onConflictDoNothing();
      await db.insert(materials).values({ name: "ABS" }).onConflictDoNothing();
      await db.insert(materials).values({ name: "TPU" }).onConflictDoNothing();
      
      await db.insert(diameters).values({ value: 1.75 }).onConflictDoNothing();
      
      await db.insert(colors).values({ name: "Schwarz (Bambu Lab)", code: "#000000" }).onConflictDoNothing();
      await db.insert(colors).values({ name: "Weiß (Bambu Lab)", code: "#FFFFFF" }).onConflictDoNothing();
      await db.insert(colors).values({ name: "Transparent", code: "#FFFFFF" }).onConflictDoNothing();
      await db.insert(colors).values({ name: "Rot", code: "#F44336" }).onConflictDoNothing();
      await db.insert(colors).values({ name: "Grau", code: "#9E9E9E" }).onConflictDoNothing();
      
      await db.insert(storageLocations).values({ name: "Keller" }).onConflictDoNothing();
      
      console.log("Grundlegende Auswahlmöglichkeiten eingefügt.");
    } catch (insertError) {
      console.error("Fehler beim Einfügen der grundlegenden Auswahlmöglichkeiten:", insertError);
    }
    
    const initialFilaments = [
      {
        name: "PLA Schwarz Bambu Lab",
        manufacturer: "Bambu Lab",
        material: "PLA",
        colorName: "Schwarz",
        colorCode: "#000000",
        diameter: "1.75",
        printTemp: "200-220°C",
        totalWeight: "1",
        remainingPercentage: "65"
      },
      {
        name: "PETG Transparent",
        manufacturer: "Prusament",
        material: "PETG",
        colorName: "Transparent",
        colorCode: "#FFFFFF",
        diameter: "1.75",
        printTemp: "230-250°C",
        totalWeight: "1",
        remainingPercentage: "15"
      },
      {
        name: "ABS Rot",
        manufacturer: "Filamentworld",
        material: "ABS",
        colorName: "Rot",
        colorCode: "#F44336",
        diameter: "1.75", 
        printTemp: "240-260°C",
        totalWeight: "1",
        remainingPercentage: "0"
      },
      {
        name: "TPU Flexibel Grau",
        manufacturer: "Ninjatek",
        material: "TPU",
        colorName: "Grau",
        colorCode: "#9E9E9E",
        diameter: "1.75",
        printTemp: "210-230°C",
        totalWeight: "0.5",
        remainingPercentage: "75"
      }
    ];
    
    for (const filamentData of initialFilaments) {
      const parsedData = insertFilamentSchema.parse(filamentData);
      await db.insert(filaments).values(parsedData);
    }
    
    // Erstelle Lock-Datei, um zukünftige Initialisierungen zu verhindern
    fs.writeFileSync(lockFile, new Date().toISOString());
    console.log("Initiale Daten erfolgreich eingefügt und Lock-Datei erstellt!");
  } catch (error) {
    console.error("Fehler beim Einfügen initialer Daten:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

insertInitialData();
