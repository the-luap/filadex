---
status: accepted
date: 2026-09-11
---

# Admin-Managed Generic Terms for Similarity Matching

Similarity matching (ADR-0007) compares scanned entities against existing
catalog entries using token overlap. Tokens like "Lab", "Filament", and
"Materials" are common across unrelated manufacturers and materials, causing
false-positive similarity prompts on nearly every community import. Rather than
hardcode an exclusion list, generic terms are stored in a database table
(`generic_terms`) managed by administrators through a dedicated settings tab.

We considered hardcoding the list, but that forces a code deploy to adjust
false-positive rates — something an admin should control without developer
involvement. We also considered making it per-user, but similarity noise
thresholds are a site-wide concern, not a personal preference.

Default terms (`lab`, `labs`, `filament`, `filaments`, `3d`, `polymers`,
`material`, `materials`, `printing`, `print`, `studio`, `maker`) are
pre-populated on first launch via the seed script. The seed guard uses
`COALESCE(max(id), 0) = 0` rather than an emptiness check, so an admin who
deliberately empties the table does not get defaults re-inserted on the next
container restart.
