---
status: accepted
date: 2026-09-03
---

# Defer unifying timestamp columns on `timestamptz`

Some tables store `timestamp with time zone` and others `timestamp without time
zone`, because the base tables predate the generated migrations and the columns
added later were declared without a zone. `shared/schema.ts` records both,
faithfully, so the schema matches what is actually deployed. Unifying on
`timestamptz` is the right end state and we are **not** doing it yet, because
the conversion cannot currently be made safely.

## Why it is not safe today

`ALTER COLUMN ... TYPE timestamptz` interprets each stored value in the
converting session's `TimeZone` unless told otherwise. The values were written
by `defaultNow()`, that is Postgres `now()` cast to whatever the *writing*
session's `TimeZone` was. So the conversion is only lossless if every write ever
made happened in the same zone we convert from.

We cannot assert that. Nothing in this repository sets `TZ` — not `Dockerfile`,
not `docker-compose.template.yml`, not `docker-entrypoint.sh`. The official
Postgres image happens to default to UTC, but Filadex also supports being
pointed at an operator's existing database, where the `timezone` GUC is whatever
they configured. A conversion that assumed UTC would silently shift every
affected row on those installs, and the damage would be invisible: the values
would still look like plausible timestamps.

## What would make it safe

Any one of these turns the assumption into a fact, and the conversion then
becomes an ordinary migration using an explicit
`USING <column> AT TIME ZONE 'UTC'`:

- Pin the server's zone (`TZ=UTC` in the image, and assert `SHOW timezone` at
  startup) for long enough that every remaining `timestamp` value provably
  postdates the pin.
- Have the migration read the database's `timezone` setting and convert from
  that rather than from an assumption — correct only if the setting has not
  changed since the rows were written, which is itself unverifiable.
- Accept the shift on the columns where it does not matter. Of the affected
  columns, several are throttling markers (`low_stock_notified_at`,
  `drying_reminder_notified_at`) where an hours-scale error changes nothing a
  user would notice, while `catalog_requests.reviewed_at` and the various
  `created_at` columns are displayed.

## Consequences

`shared/schema.ts` keeps two spellings of the same concept, and every new
timestamp column has to make a choice that looks arbitrary. New columns should
use `timestamptz`; the mixture is a fact about the deployed database, not a
style anyone chose.

The related decision to drop `filaments.created_at` and `filaments.updated_at`
is *not* deferred: those columns are written by nothing and read by nothing, so
no value can be misinterpreted by removing them.

This decision is Postgres-only in scope. A SQLite installation stores every
timestamp as epoch milliseconds, which carries no zone, so both spellings map to
one representation there: such a database is born with the unified form this ADR
defers reaching on Postgres, and can never acquire the mixture. See
`docs/adr/0004`.
