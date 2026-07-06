import type { Express } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  catalogRequests,
  users,
  insertCatalogRequestSchema,
  insertManufacturerSchema,
  insertMaterialSchema,
  insertColorSchema,
  insertDiameterSchema,
  insertStorageLocationSchema,
  type CatalogRequest,
} from "../../shared/schema";
import { authenticate, isAdmin } from "../auth";
import { storage } from "../storage";
import { sendMail } from "../utils/mailer";
import { catalogRequestReviewedEmail } from "../utils/email-templates";
import { logger as appLogger } from "../utils/logger";
import { ZodError } from "zod";

// Maps each entity type to its payload validator and the storage method that
// actually creates the real catalog entry once a request is approved.
const ENTITY_CONFIG = {
  manufacturer: { schema: insertManufacturerSchema, create: (data: any) => storage.createManufacturer(data), label: (p: any) => p.name },
  material: { schema: insertMaterialSchema, create: (data: any) => storage.createMaterial(data), label: (p: any) => p.name },
  color: { schema: insertColorSchema, create: (data: any) => storage.createColor(data), label: (p: any) => p.name },
  diameter: { schema: insertDiameterSchema, create: (data: any) => storage.createDiameter(data), label: (p: any) => `${p.value}mm` },
  storageLocation: { schema: insertStorageLocationSchema, create: (data: any) => storage.createStorageLocation(data), label: (p: any) => p.name },
} as const;

export function registerCatalogRequestRoutes(app: Express): void {
  // Submit a new catalog request (any authenticated user).
  app.post("/api/catalog-requests", authenticate, async (req, res) => {
    try {
      const { entityType, payload } = insertCatalogRequestSchema.parse(req.body);

      // Validate the payload matches the shape expected for this entity type
      // before it ever reaches an admin's review queue.
      ENTITY_CONFIG[entityType].schema.parse(payload);

      const [created] = await db.insert(catalogRequests).values({
        userId: req.userId,
        entityType,
        payload,
      }).returning();

      res.status(201).json(created);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid request payload" });
      }
      appLogger.error("Error creating catalog request:", error);
      res.status(500).json({ message: "Failed to submit request" });
    }
  });

  // Review queue (admin only), optionally filtered by status.
  app.get("/api/catalog-requests", authenticate, isAdmin, async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;

      const requests = await db
        .select({
          id: catalogRequests.id,
          entityType: catalogRequests.entityType,
          payload: catalogRequests.payload,
          status: catalogRequests.status,
          reviewNote: catalogRequests.reviewNote,
          reviewedAt: catalogRequests.reviewedAt,
          createdAt: catalogRequests.createdAt,
          requestedBy: users.username,
        })
        .from(catalogRequests)
        .leftJoin(users, eq(catalogRequests.userId, users.id))
        .where(status ? eq(catalogRequests.status, status) : undefined)
        .orderBy(desc(catalogRequests.createdAt));

      res.json(requests);
    } catch (error) {
      appLogger.error("Error fetching catalog requests:", error);
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  // Current user's own requests, so they can see what happened to their submissions.
  app.get("/api/catalog-requests/mine", authenticate, async (req, res) => {
    try {
      const requests = await db
        .select()
        .from(catalogRequests)
        .where(eq(catalogRequests.userId, req.userId))
        .orderBy(desc(catalogRequests.createdAt));

      res.json(requests);
    } catch (error) {
      appLogger.error("Error fetching your catalog requests:", error);
      res.status(500).json({ message: "Failed to fetch your requests" });
    }
  });

  async function loadPendingRequest(id: number): Promise<CatalogRequest | undefined> {
    const [request] = await db.select().from(catalogRequests).where(and(eq(catalogRequests.id, id), eq(catalogRequests.status, "pending")));
    return request;
  }

  async function notifyRequester(request: CatalogRequest, approved: boolean, reviewNote?: string | null) {
    const [requester] = await db.select().from(users).where(eq(users.id, request.userId));
    if (!requester?.email) return;

    const config = ENTITY_CONFIG[request.entityType as keyof typeof ENTITY_CONFIG];
    const entityLabel = config ? config.label(request.payload as any) : request.entityType;

    await sendMail({
      to: requester.email,
      ...catalogRequestReviewedEmail((requester.language as "en" | "de") || "en", approved, entityLabel, reviewNote),
    });
  }

  // Approve a pending request: creates the real catalog entry and notifies the requester (admin only).
  app.post("/api/catalog-requests/:id/approve", authenticate, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid request ID" });
      }

      const request = await loadPendingRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Pending request not found" });
      }

      const config = ENTITY_CONFIG[request.entityType as keyof typeof ENTITY_CONFIG];
      if (!config) {
        return res.status(400).json({ message: "Unknown entity type" });
      }

      const validatedPayload = config.schema.parse(request.payload);
      await config.create(validatedPayload);

      const [updated] = await db
        .update(catalogRequests)
        .set({ status: "approved", reviewedBy: req.userId, reviewedAt: new Date() })
        .where(eq(catalogRequests.id, id))
        .returning();

      await notifyRequester(request, true).catch((err) => appLogger.error("Failed to notify requester of approval:", err));

      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid request payload" });
      }
      // Most likely a unique-constraint violation because the entity already exists
      // (e.g. two users requested the same manufacturer) - surface a friendly message.
      appLogger.error("Error approving catalog request:", error);
      res.status(400).json({ message: "Could not create this entry - it may already exist in the catalog" });
    }
  });

  // Reject a pending request with an optional note (admin only).
  app.post("/api/catalog-requests/:id/reject", authenticate, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid request ID" });
      }

      const request = await loadPendingRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Pending request not found" });
      }

      const reviewNote = typeof req.body?.note === "string" ? req.body.note : null;

      const [updated] = await db
        .update(catalogRequests)
        .set({ status: "rejected", reviewNote, reviewedBy: req.userId, reviewedAt: new Date() })
        .where(eq(catalogRequests.id, id))
        .returning();

      await notifyRequester(request, false, reviewNote).catch((err) => appLogger.error("Failed to notify requester of rejection:", err));

      res.json(updated);
    } catch (error) {
      appLogger.error("Error rejecting catalog request:", error);
      res.status(500).json({ message: "Failed to reject request" });
    }
  });
}
