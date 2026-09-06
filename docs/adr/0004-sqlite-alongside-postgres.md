---
status: accepted
date: 2026-09-05
---

# SQLite alongside Postgres, chosen at build time

Filadex requires a Postgres server, which is the single largest obstacle to the
deployment it is most often wanted for: one container on a homelab machine,
tracking one person's filament. This adds SQLite as an alternative engine, so
that `DATABASE_URL=file:/data/filadex.db` is a complete deployment.

**Postgres remains the supported default.** SQLite is a documented option for a
single-user install. Concretely, and this is what the promise is worth: a fresh
SQLite install is supported and covered by the whole test suite; there is **no
migration path** between the two engines in either direction; and nothing is
claimed about multiple concurrent writers. It is not a second first-class
backend, and the difference is a support promise rather than a difference in
test rigour — see *Both engines run the whole suite*, below.

This ADR builds directly on `docs/adr/0001`, which prepared the Postgres
codebase for exactly this and should be read first. Where 0001 predicted
something that turned out to be wrong, it is called out below rather than
quietly corrected.

## The shape of the thing

Two engines, one set of table definitions, and no adapter layer between the
application and Drizzle.

`shared/schema.ts` continues to hold one definition of every table, written in
the vocabulary `shared/columns.ts` provides. That file becomes two —
`columns.pg.ts` and `columns.sqlite.ts` — resolved through a TypeScript path
alias. The dialect is therefore chosen **when the code is compiled**, and
TypeScript only ever sees one of them. This is what keeps Drizzle's type
inference intact and keeps `server/storage.ts` and every route unchanged.

Everything else follows from that choice.

## Decisions

### The dialect is a build-time choice, and the image carries both builds

`tsconfig.json` keeps the Postgres alias; `tsconfig.sqlite.json` extends it and
overrides `@shared/columns` to point at the SQLite implementation. `npm run
check` runs twice, once per tsconfig, and CI runs both.

`npm run build` runs esbuild twice, producing `dist/index.pg.js` and
`dist/index.sqlite.js`, and `docker-entrypoint.sh` picks between them by the
scheme of `DATABASE_URL`. One image, one tag; a deployer changes a URL and
nothing else.

The alternative — deciding the dialect at runtime from `DATABASE_URL` inside
`server/db.ts`, which is what an earlier sketch of this work assumed — cannot
work alongside a single `shared/schema.ts`. If the schema is compiled against
one dialect then the artifact speaks one dialect, and no runtime switch can
change that. Making it genuinely runtime would mean `schema.ts` building both
table sets and `db` becoming a union type, which pushes the engine distinction
into every call site in `storage.ts`. That is the shallow-module failure 0001
rejected, wearing a different hat.

Two images (`filadex:latest` and `filadex:sqlite`) would also have worked and is
the fallback if doubling the build ever becomes a problem. It was not chosen
because switching engines should not mean switching image tags.

### The client is built once, and a test proves that is safe

`client/src/components/filament-modal.tsx` imports `insertFilamentSchema` — a
value, not a type — so the browser bundle pulls in `shared/schema.ts` and
through it the dialect's column implementations.

The client is nevertheless built **once**, because the `createInsertSchema`
outputs are identical across dialects: `numeric` produces a string validator on
both, `timestamp` a date, `bool` a boolean, `pk` a number. That is not an
assumption. `tests/schema-invariance.test.ts` generates every table schema and
every exported schema under both dialects and compares them field by field and
check by check — string lengths, number ranges, default values, enum members,
and both halves of a `ZodPipeline` — so a divergence that changes validation
fails there rather than in a browser.

The comparison has to go that deep to be worth anything. An earlier version
stopped at the Zod type name, which compared `ZodString` against `ZodString` and
never read its checks; a `varchar(n)` against a `text` would have shipped a
client that rejects input its own server accepts, with the test still green.

**One difference is real, expected, and asserted rather than compared.**
drizzle-zod derives an integer column's range from the engine's integer width:
±2³¹ for Postgres `integer`, ±(2⁵³−1) for SQLite. Every integer column differs.
Those bounds are pulled out of the equality comparison and checked on the
property that actually matters — Postgres, whose schemas the client bundles,
must be the *narrower* of the two. A client stricter than its server rejects
input the server would have taken, which is visible in the UI; the reverse ships
input the server rejects. Only the two known widths are exempt, so a column that
grows to `bigint` fails the comparison and has to be decided deliberately.

This is worth more than building the client twice would have been. Two bundles
would have *tolerated* a divergence; the test forbids one, and a failure is a
real bug in `columns.sqlite.ts` every time.

### `numeric` maps to `text` on SQLite, not to `numeric`

**This reverses a finding recorded during the assessment for 0001.** That
finding observed that Drizzle declares `data: string` for `numeric` on both
`pg-core` and `sqlite-core`, and concluded no conversion was needed. The
declared types agree. The runtime behaviour does not.

A SQLite column declared `NUMERIC` has numeric affinity, which converts a
string on write and returns a JavaScript **number** on read, whatever Drizzle's
types say:

```
CREATE TABLE t (weight NUMERIC, price NUMERIC)
INSERT ... VALUES ('1000', '0.10')     -- strings, as this codebase carries them
SELECT ...  ->  weight: 1000 (number),  price: 0.1 (number)
```

Money and weights are strings throughout Filadex precisely so that exactness is
never traded for a float, and `"0.10"` returning as `0.1` also changes what a
user sees. TypeScript would have insisted the value was a string the whole time.
A `TEXT` column round-trips `"1000"` and `"0.10"` byte-identically.

The capability given up is numeric comparison in SQL, because `TEXT` compares
lexicographically — `pct < '10'` matches nothing. **One place in the application
uses it**, and it is an equality rather than an ordering: `findOrCreateFilamentType`
matches a declared diameter against `filament_types.diameter`
(`server/storage.ts:171`), where a real `numeric` makes `'1.750'` and `'1.75'`
the same value and `TEXT` does not — so the same CSV import reused a filament
type on Postgres and created a second one on SQLite. That equality goes through
`eqNumeric` (`server/db/predicates.*.ts`), which casts on the SQLite side so
both engines answer the way Postgres always did. Everything else — every
ordering and every aggregation over these columns — happens in JavaScript
through `Number(...)`: `server/utils/notification-checks.ts:36`,
`server/routes/statistics.ts:56-82`, `server/routes/spoolman-compat.ts:65`. The
only SQL aggregates anywhere are `count()` (`server/storage.ts:504,628`) and
`max(updated_at)` (`:629`), neither over a numeric column.

A `customType` codec forcing the value back to a string was considered and
rejected: it preserves numeric comparison nobody performs, and it cannot undo
`"0.10"` → `0.1`, because the trailing zero is gone before the codec is reached.

One behavioural difference follows and is not fixable: `diameters.value` is
uniquely indexed, and Postgres `numeric` treats `1.75` and `1.750` as equal
while SQLite `TEXT` does not. A SQLite install will accept both as distinct
diameters.

### Primary keys use `AUTOINCREMENT`

A plain SQLite `INTEGER PRIMARY KEY` is a rowid alias and reuses the ids of
deleted rows. Postgres `serial` never does. `t.pk` therefore emits
`integer().primaryKey({ autoIncrement: true })`, accepting a `sqlite_sequence`
table and a marginally slower insert.

Without it, a deleted spool's id is eventually handed to an unrelated new spool,
and anything still holding the old id — a bookmarked URL, a cached client query,
an external integration that stored it — silently addresses different data. It
also keeps id behaviour identical across the two test runs.

### Timestamps are stored as epoch milliseconds

`t.timestamp` and `t.timestamptz` both map to
`integer({ mode: 'timestamp_ms' })`. Seconds (`mode: 'timestamp'`) would
silently truncate, which surfaces first as a flaky test the moment anything
writes and reads a timestamp within the same second.

**On SQLite the two spellings collapse into one, and that is not a loss.**
`docs/adr/0002` keeps them distinct because the *deployed Postgres databases*
contain both `timestamp with time zone` and `timestamp without time zone`, and
converting between them cannot currently be done safely. Epoch integers carry no
zone at all, so a SQLite install is born with the unified representation that
0002 defers reaching on Postgres, and can never acquire the mixture. The
distinction is a fact about Postgres deployments, not about Filadex.

### Case-insensitive matching is ASCII-only on SQLite, and that is accepted

`server/db/predicates.ts` becomes `predicates.pg.ts` and `predicates.sqlite.ts`
behind the same alias. `eqIgnoreCase` is `LOWER(a) = LOWER(b)` on both.
`containsIgnoreCase` is `ILIKE ... ESCAPE E'\\'` on Postgres and
`LIKE ... ESCAPE '\'` on SQLite.

SQLite's `LIKE` folds case for ASCII only, so a community-filament search for
`grun` will not match `Grün` on a SQLite install, where on Postgres it depends
on the database's collation. This is accepted rather than worked around. The
alternatives are worse: registering a custom collation makes a search silently
fall back to ASCII folding if connection setup fails, and folding in JavaScript
costs a shadow column and a write path, for a ranking nuisance on a single-user
install.

Usernames are the one place that price *was* paid — `foldUsername` and
`users.username_folded`, added on main while this branch was open. The
difference is what the comparison decides. A fold that disagrees between
installs decides which account a login reaches and whether two people can hold
one name, so it cannot be left to the engine; a fold that disagrees about
search decides only whether a suggestion appears while the user keeps typing.
Reading `username_folded` as a precedent for doing the same to
`community_filament_cache` would be reading the wrong half of it.

Catalog Material names fall on the *username* side of that line, and were
initially placed on the wrong one. `storage.resolveMaterial` decides which
Catalog Material a declared material resolves to, and therefore whether a spool
inherits a density and a hygroscopic flag and whether the owner's Personal
Catalog gains a second row that looks identical to one already in it — a
data-quality question, not a ranking one. Left to `LOWER()`, `Äbs` resolved to
`äbs` on Postgres and to nothing on SQLite, while the Add Material form, which
compares in JavaScript, answered 409 for the same pair on both. It now folds in
JavaScript through `foldMaterialName` (`server/utils/materials.ts`), which is
`foldUsername`'s rule applied to a trimmed name.

The price paid here is smaller than a shadow column: `resolveMaterial` reads the
in-scope catalog rather than a single indexed row, which is the Global Catalog
plus the caller's own entries — a set `getHygroscopicMaterialNames` already
reads whole for the same reason. The partial unique indexes on `lower(name)`
stay as they are and remain a backstop for the ASCII case on both engines; the
application, not the index, is what enforces the rule.

### One index key varies by dialect, and it is not a mistake

`shared/columns.ts` gains `nullableIndexKey(column)`: `coalesce(column, 0)` on
Postgres, the bare column on SQLite. It exists for
`materials_user_name_lower_idx`, and both halves of the reason must survive,
because either one alone reads like something to clean up.

**Postgres needs the `coalesce`.** drizzle-kit 0.30's introspection cannot
round-trip an index whose key list mixes a bare column with an expression, and
`npm run db:verify-upgrade` depends on that round-trip. The `coalesce` form is
also already applied on every deployed installation, so changing it would
generate an index drop and recreate that achieves nothing.

**SQLite cannot have it.** drizzle-kit splits an index's key list on commas
without respecting parentheses, so `coalesce("user_id", 0)` is torn in half and
each fragment quoted as a column name:

```sql
CREATE UNIQUE INDEX `materials_user_name_lower_idx`
  ON `materials` (`coalesce("user_id"`,` 0)`, lower("name")) WHERE ...
-- Error: no such column: coalesce("user_id"
```

This reproduces on drizzle-kit 0.30.4 and on 0.31.10, the current release, so
upgrading is not a fix. It affects `drizzle-kit/api`'s `generateSQLiteMigration`
as well as the CLI — that is the function `tests/helpers/db.ts` builds the test
schema with, so the entire SQLite test leg fails at `beforeAll` without this.
`materials_user_name_lower_idx` is the only affected index in the schema; every
other index key is a bare column or `lower(x)`, which contains no comma.

The bare column is semantically identical here, because the index is partial on
`WHERE user_id IS NOT NULL` and the `coalesce` is therefore a no-op for every
row it covers. Verified: with it, caseless uniqueness holds within the Global
Catalog and within each Personal Catalog, two users may hold the same name, and
a Personal entry may shadow a Global one — all of `docs/adr/0003`'s rules.

### Two migration runners, not one with a branch

`migrations/sqlite/` starts at `0000` containing the whole current schema. It
has no relationship to `migrations/pg/`'s history and never has to match it,
because there is no existing SQLite installation anywhere to baseline.

`scripts/migrate.pg.ts` keeps everything 0001 built — the legacy chain, the
baseline assertion, the advisory lock. `scripts/migrate.sqlite.ts` runs the
migrator and nothing else, because none of that machinery has a SQLite meaning.

They are separate files rather than one file with a branch because a branch does
not compile: `runLegacyMigrations(db)` takes a Postgres `db`, and under
`tsconfig.sqlite.json` the `db` in scope is SQLite-typed, so `npm run check`
would fail on the SQLite leg. Both are bundled by esbuild alongside the server,
which lets the production image drop `tsx`, `typescript` and `tsconfig.json` —
and with them the class of failure that GH issue #5 was.

### CI proves the migrations describe the schema, in both dialects

A job runs `drizzle-kit generate` for each dialect into a temporary directory
and fails if it would produce anything. That is the statement "the checked-in
migrations fully describe `shared/schema.ts`", and it catches the predictable
mistake — adding a column, generating the Postgres migration, forgetting the
SQLite one — on the pull request that causes it, naming the failure precisely.

The test matrix would eventually catch it too, but only if some test happens to
touch the new column, which is exactly the case where it was forgotten. The
check also retroactively guards the Postgres side, which had nothing like it.

### Both engines run the whole suite

All of the suite runs on both engines, as a CI matrix. `tests/helpers/db.ts`
becomes dialect-aware: dropping and recreating the schema versus deleting the
file, `TRUNCATE ... RESTART IDENTITY CASCADE` versus `DELETE FROM`,
`generateMigration` versus `generateSQLiteMigration`, and no container on the
SQLite leg — which makes it the faster of the two.

Running a chosen "engine-sensitive subset" on SQLite was rejected. Choosing that
subset means predicting which tests catch an engine difference, and the ones
that matter are the ones nobody predicted. The suite is the entire evidence that
SQLite works; running less of it against SQLite than against Postgres would make
the claim proportionally weaker.

This is why the support tier at the top of this ADR is expressed as *what SQLite
is supported for*, not as how well it is tested.

### The startup path stops being Postgres-shaped

The database readiness wait, the `CREATE DATABASE` check and the permission
probe move out of `docker-entrypoint.sh` and into `scripts/migrate.pg.ts`, which
already holds a `pg.Pool`. The entrypoint becomes: pick a bundle, run its
migrator, start the app.

`postgresql-client` and `netcat-openbsd` leave the image, alongside the
TypeScript toolchain. `docker-entrypoint.sh` goes from 125 lines to about ten,
and the SQLite branch is two of them rather than a fork of the whole startup
path. This is a larger change than adding SQLite strictly required, and it is
worth defending on its own terms: shelling out to `psql` to ask questions that
the migration runner's own connection can answer was never buying anything.

### One seeder with two modes, and the guard is a fact about the database

Three seeders existed and two of them were drifted copies of each other: the
`psql` block in `docker-entrypoint.sh`, `init-data.ts` (copied into the image
but run by nothing, and carrying its own hand-written `CREATE TABLE` block — a
second schema definition that `migrate.ts` has owned since 0001), and
`scripts/seed-demo-data.ts`.

They collapse into `scripts/seed.ts` with two modes. `--starter` fills the
dropdown lists on a fresh install when `INIT_SAMPLE_DATA=true` and is safe
against a live database. `--demo` is the development and CI fixture: it refuses
to run when users exist, and it populates every table. They stay distinguished
because a production install must not receive four demo accounts with a known
password.

Content resolves toward the fuller of the two drifted lists — four
manufacturers, not one — with English colour names, because `DEFAULT_LANGUAGE`
is `en` and seeding German strings into an English install is the more
surprising of the two.

The "already seeded" guard becomes a database fact: `manufacturers` is empty.
Both lock files it replaces — `/app/.init_done` and `./init-data.lock` — were
written into the container filesystem rather than a volume, so they vanished
whenever the container was recreated and the real work was already being done by
the row count beside them.

`scripts/verify-upgrade.ts` stays Postgres-only, deliberately: it exists to
prove that a pre-Drizzle installation upgrades without losing a row, and no such
SQLite installation can exist. The one raw `INSERT ... RETURNING` in the old
seeder existed only to serve it — drizzle spells out the full column list, which
would name `materials.user_id` before the migration adding it has run — and
moves into `verify-upgrade.ts`, where being Postgres-only is local and obvious.

### SQLite connections set three pragmas

`server/db.sqlite.ts` sets `journal_mode = WAL`, `busy_timeout = 5000` and
`foreign_keys = ON` on connection.

`foreign_keys` is the one that matters most and looks like the least. SQLite
ignores foreign key constraints unless it is on, so without it the
`ON DELETE CASCADE` behaviour the schema declares — and that the Postgres tests
verify — simply does not happen. That would be a correctness divergence between
engines rather than a cosmetic one.

WAL lets readers proceed during a write, at the cost of `-wal` and `-shm` files
beside the database, which is why the documentation says to copy `/data` rather
than naming one file. `busy_timeout` matters because Node serves requests
concurrently even in one process; without it a collided write returns
`SQLITE_BUSY` immediately and the user sees a 500 instead of a short wait.

### Backups are a first-class feature of a SQLite install

A SQLite deployment has no `pg_dump` and no database server whose backup story
somebody else owns, so the application takes responsibility. An admin-only **DB
backups** panel appears in settings when the engine is SQLite: write a snapshot
to `/data/backups/`, download one, and a schedule that writes them
automatically.

**Snapshots are taken with `VACUUM INTO`, not the C online-backup API.**
`@libsql/client` has no backup method — its interface is `batch`, `close`,
`execute`, `executeMultiple`, `migrate`, `reconnect`, `sync`, `transaction` —
and `better-sqlite3`, which does expose `sqlite3_backup_*`, requires
*synchronous* transaction callbacks, which `server/storage.ts:614` is not. That
incompatibility is the reason libsql was chosen in the first place. SQLite's own
documentation offers `VACUUM INTO` as "an alternative to the backup API for
generating backup copies of a live database"; it is plain SQL, so it runs
through `execute()`, and it produces a consistent, compacted copy. What is given
up is incremental progress reporting, on a database that will be a few megabytes.

The panel lists what is in `/data/backups/` with a download link per row, plus a
button that streams a fresh snapshot without leaving a file behind. A "keep the
last N" setting prunes after each successful run, because unbounded snapshots
filling `/data` is precisely the disaster the feature exists to prevent.

The schedule is off / daily at a time / weekly on a day at a time, driven by an
interval check rather than a cron expression. It matches how this codebase
already schedules work — `server/index.ts:92`, whose comment notes that a plain
interval is enough at this scale — and it adds no parser dependency and no text
field where a typo means backups silently never run.

Two things are enforced on the server, not in the UI. **The endpoints are
admin-only**, because a backup is every user's data, every password hash, every
API token hash and the stored SMTP credentials in one file. And **filenames are
server-generated and contained** to `/data/backups/`, never taken from the
request, so the download endpoint cannot be walked out of that directory. The
panel is hidden on Postgres by asking `GET /api/system/database`, but the
endpoints refuse there regardless — the client is built once for both engines
and cannot know at build time which one it is talking to, so its knowledge is
cosmetic and the server's check is the real gate.

## Consequences

**Every schema change now needs two migrations and passes two test runs.** This
is the standing cost of the decision and it does not go away. The CI drift check
is what makes forgetting it a loud failure at the right moment rather than a
quiet one later.

**Two `tsc` runs, two esbuild runs, two test legs.** CI is meaningfully slower.
The SQLite leg is the cheaper of the two, needing no container.

**A SQLite installation can never become a Postgres one, or the reverse.**
Nothing here builds an export/import path between engines, and adding one later
is a real project, not a script. A deployer picks once.

**`shared/schema.ts` stays the single definition of every table**, which was the
point. Two things vary underneath it — the column vocabulary and one index key —
and both are named, in one place each, with the reason attached.

**`docs/adr/0002` becomes Postgres-only in scope.** Its deferred `timestamptz`
unification concerns deployed Postgres databases; SQLite installs start unified
and are outside it.

## Deliberately not done

**No `SqliteStorage`.** Engine variation does not belong at the `IStorage` seam;
that would be a third copy of the domain logic. It belongs below it, and after
0001 closed the leak, `server/storage.ts` is the only place in the application
that imports `server/db`.

**`getDialect()` and `createBackup()` are the deliberate exceptions.** Neither
carries domain logic: `getDialect` returns the `dialect` constant and
`createBackup` forwards to `vacuumBackup`, both of which the `@db` alias has
already resolved per engine, so the variation still lives below the seam rather
than at it. They sit on `IStorage` precisely to keep the rule above true - the
alternative is for `server/backup-scheduler.ts` and `server/routes/backups.ts` to
import `server/db` themselves, which would make storage no longer the only
importer. An accessor on the seam is a smaller price than four new importers.

**No facade over Drizzle.** A `Database` type wrapping `select`/`insert`/`where`
/`transaction` would have an interface nearly as large as the thing it wraps, an
implementation that is pure pass-through, and it would destroy the type
inference that makes the schema worth having.

**No seam where nothing varies.** libsql's async driver removes the need for a
transaction abstraction, and `text` for `numeric` removes the need for a numeric
codec. Both problems were solved by choosing rather than by abstracting.

**No Postgres→SQLite migration tool**, and no attempt to make SQLite behave like
Postgres on Unicode case folding or `numeric` equality. Those differences are
documented above instead, because a shim that mostly works is worse than a
difference somebody can read about.
