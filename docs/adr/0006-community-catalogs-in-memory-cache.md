---
status: accepted
date: 2026-09-08
---

# Community catalogs cached on server disk with in-memory search

Filadex integrates third-party filament catalogs (Open Filament Database and
SpoolmanDB) to autofill spool and filament type fields. Community catalogs are
now stored as local JSON files on disk with in-memory search indexes on the server,
rather than storing tens of thousands of rows in the primary application database.

## Context

Previously, Filadex synced SpoolmanDB by executing a full `TRUNCATE` and thousands
of row `INSERT`s into the `community_filament_cache` table. With the addition of
Open Filament Database (which adds >14,000 color variants and >22,000 sizes), storing
and indexing third-party catalog snapshots in PostgreSQL/SQLite would dramatically
increase database size, write churn, and backup weight on homelab SQLite installs.

## Decision

1. **Dual provider support**: Both Open Filament Database (OFD) and SpoolmanDB are
   supported as co-existing community catalog sources.
2. **Server-side cache on disk**: Raw catalog snapshots (`all.json.gz` from OFD and
   vendor JSON files from SpoolmanDB) are saved to local disk cache and indexed in
   memory for instant substring search and GTIN barcode lookup.
3. **Retire database table**: The `community_filament_cache` table is dropped from
   the relational database schema, eliminating large bulk transactions and keeping
   the database dedicated solely to user data.
4. **Scheduled background sync**: Automated daily refresh checks follow the same
   mutex and interval pattern used by the backup scheduler.
