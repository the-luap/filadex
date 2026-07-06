import type { Express } from "express";
import { createServer, type Server } from "http";
import { initializeAdminUser } from "../auth";
import { registerAuthRoutes } from "./auth";
import { registerUserRoutes } from "./users";
import { registerFilamentRoutes } from "./filaments";
import { registerBatchRoutes } from "./batch";
import { registerSettingsRoutes } from "./settings";
import { registerPublicRoutes } from "./public";
import { registerStatisticsRoutes } from "./statistics";
import { registerThemeRoutes } from "./theme";
import { registerEmailSettingsRoutes } from "./email-settings";
import { registerCatalogRequestRoutes } from "./catalog-requests";
// All routes have been extracted - routes.ts is now empty or contains only legacy code
// Keeping registerRemainingRoutes import for backward compatibility
import { registerRemainingRoutes } from "../routes";

/**
 * Register all routes for the application
 * This function combines routes from separate files with remaining routes
 * from routes.ts for backward compatibility during migration
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize admin user
  await initializeAdminUser();

  // Register routes from separate files (all routes extracted).
  // registerBatchRoutes must come before registerFilamentRoutes: otherwise
  // filaments.ts's "/api/filaments/:id" matches "/api/filaments/batch" first
  // (with id="batch"), and the batch endpoints never get reached.
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerBatchRoutes(app);
  registerFilamentRoutes(app);
  registerSettingsRoutes(app);
  registerPublicRoutes(app);
  registerStatisticsRoutes(app);
  registerThemeRoutes(app);
  registerEmailSettingsRoutes(app);
  registerCatalogRequestRoutes(app);

  // Register any remaining routes from routes.ts (should be empty now)
  registerRemainingRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}

