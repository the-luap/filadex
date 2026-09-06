# Development Guide

This guide provides detailed information for developers working on Filadex.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Database Management](#database-management)
- [Code Style](#code-style)
- [Testing](#testing)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v16 or higher ([Download](https://nodejs.org/))
- **PostgreSQL** v12 or higher ([Download](https://www.postgresql.org/download/)) or **SQLite** (built-in; no external server needed)
- **npm** (comes with Node.js) or **yarn**
- **Git**

### Optional Tools

- **Docker** and **Docker Compose** (for containerized development)
- **VS Code** or your preferred IDE with TypeScript support

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/filadex.git
cd filadex
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set the database connection string:
 
```env
# For PostgreSQL:
DATABASE_URL=postgres://username:password@localhost:5432/filadex

# Or for SQLite:
# DATABASE_URL=file:./dev.db
```

### 4. Set Up Database

If using PostgreSQL, create the database first:

```bash
createdb filadex
# Or using psql:
# psql -U postgres -c "CREATE DATABASE filadex;"
```

Apply database migrations:

```bash
npm run db:migrate
```

(Optional) Initialize starter selection options or demo fixtures:

```bash
# Starter dropdown options (manufacturers, materials, colors):
npm run db:init

# Or full demo dataset:
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at:
- **Frontend & API**: http://localhost:5000
- **Default credentials**: `admin` / `admin` (change on first login)

### Using the Setup Script

Alternatively, use the automated setup script:

```bash
npm run setup
# or
bash scripts/setup-local.sh
```

## Project Structure

```
filadex/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   └── ui/         # shadcn/ui components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and helpers
│   │   └── i18n/           # Internationalization
│   └── public/             # Static assets
│
├── server/                 # Backend Express application
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API routes
│   ├── auth.ts            # Authentication logic
│   ├── db.ts              # Database connection
│   └── vite.ts            # Vite integration
│
├── shared/                 # Shared code between client/server
│   └── schema.ts          # Database schema (Drizzle ORM)
│
├── migrations/             # Database migration scripts
├── resources/              # CSV resource files
├── scripts/                # Utility scripts
├── docs/                   # Documentation
│
├── .env.example           # Environment variables template
├── .cursorrules           # AI agent development rules
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite configuration
└── tailwind.config.ts     # TailwindCSS configuration
```

## Development Workflow

### Running the Application

**Development mode** (with hot reload):
```bash
npm run dev
```

**Production build**:
```bash
npm run build
npm start
```

**Type checking** (without building):
```bash
npm run check
# or
npm run type-check
```

### Branch Strategy

- `main` - Production-ready code
- `dev` - Development branch for new features
- Feature branches - `feature/feature-name`

### Making Changes

1. Create a feature branch from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the [Code Style](#code-style) guidelines

3. Test your changes locally

4. Commit with descriptive messages:
   ```bash
   git add .
   git commit -m "feat: add new filament filter feature"
   ```

5. Push and create a pull request

## Database Management

### Schema Changes

The database schema is defined in `shared/schema.ts` using Drizzle ORM.

**To update the database schema:**

1. Modify the schema in `shared/schema.ts`
2. Generate a migration **for both engines** - `shared/schema.ts` feeds both, so
   a change that reaches only one leaves the other behind:
   ```bash
   npm run db:generate         # writes migrations/pg
   npm run db:generate:sqlite  # writes migrations/sqlite
   ```
   Each writes a new numbered `.sql` file and records it in that engine's
   `meta/_journal.json`. Commit the `.sql`, the journal, and the snapshot.
3. Apply it:
   ```bash
   npm run db:migrate
   ```

`npm run db:check-drift` regenerates both chains into a temp directory and
fails if either is missing a migration, so forgetting one is caught in CI rather
than in production.

#### Two drizzle-kit behaviours worth knowing

**Generated `.sql` files have no trailing newline.** This is drizzle-kit's output
format, not an oversight: `migrations/pg/0000_right_mathemanic.sql`,
`0002_nifty_joseph.sql`, `0004_materials_attention_dismissed.sql` and
`migrations/sqlite/0000_light_catseye.sql` are all written this way, while the
hand-written migrations beside them do end in one. Do not "fix" a generated file
to satisfy the CONTRIBUTING.md "end all files with a newline" rule - the next
`db:generate` silently reverts it, and it puts the file out of step with every
other generated migration. That rule is about files people write.

**Regenerating a chain from scratch needs the directory removed, not emptied.**
`drizzle-kit generate` reads `meta/_journal.json` before it writes anything and
dies with `ENOENT ... _journal.json` if the directory exists without it. To
rebuild a baseline, `rm -rf` the whole engine directory and let the command
recreate it. Only ever do this for an engine with no deployed databases; a
released chain is frozen, and rewriting it strands every installation on it.

**Note**: `npm run db:push` applies the schema directly, without a migration
file. It is convenient for a scratch database, but a deployment only ever gets
what is in `migrations/pg`, so anything that has to reach one needs a generated
migration.

### Running Migrations

`npm run db:migrate` (`scripts/migrate.ts`) is a development dispatcher into `scripts/migrate.pg.ts` or `scripts/migrate.sqlite.ts` based on `DATABASE_URL`. In production, `docker-entrypoint.sh` executes the bundled migrator (`dist/migrate.pg.js` or `dist/migrate.sqlite.js`) directly on container start.

On PostgreSQL, migration handles three cases: a fresh database is created from the generated migrations; a database already on them gets whatever is new; and a pre-Drizzle installation is first caught up on the frozen scripts in `migrations/legacy` (see the README there) and then recorded at the baseline. SQLite has no legacy chain and applies migrations directly from `migrations/sqlite`.

To check that an existing installation can still upgrade:

```bash
npm run db:verify-upgrade
```

It builds a pre-Drizzle database, seeds it, upgrades it, and compares the result
against a fresh install. It needs Docker, and CI runs it on every pull request.

### Initializing Data

Initialize the database with starter or demo fixtures:

```bash
# Basic starter options (manufacturers, materials, colors, diameters, locations)
npm run db:init

# Full demo dataset (refuses if users already exist)
npm run db:seed
```

Set `INIT_SAMPLE_DATA=true` in `.env` or container environment to automatically seed starter data on fresh installs.

### Database Engines & Connection

Filadex supports two database engines:

- **PostgreSQL** (default, recommended for multi-user deployments):
  Configured via `DATABASE_URL=postgres://user:password@host:port/database` or individual variables (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `PGHOST`, `PGPORT`).
- **SQLite** (single-user install option, no external database server needed):
  Configured via `DATABASE_URL=file:/path/to/filadex.db` (or `file:./dev.db` for local development). There is **no migration path** between the two engines in either direction. SQLite connections set WAL mode, producing `-wal` and `-shm` companion files beside the database file, which is why external backups should copy `/data` rather than naming one file.
  When running on SQLite, an admin-only **DB Backups** settings panel is available to create and download snapshots (using SQLite `VACUUM INTO`) and configure automated recurring backups with automatic pruning.

## Code Style

### TypeScript

- Use TypeScript for all new code
- Avoid `.js` files unless necessary (legacy scripts)
- Use strict TypeScript settings
- Prefer type inference, but be explicit for public APIs

### React Components

- Use functional components with hooks
- PascalCase for component names
- Props interfaces should be defined above the component
- Use named exports

Example:
```typescript
interface FilamentCardProps {
  filament: Filament;
  onEdit?: () => void;
}

export function FilamentCard({ filament, onEdit }: FilamentCardProps) {
  // Component implementation
}
```

### File Naming

- Components: `PascalCase.tsx` (e.g., `FilamentCard.tsx`)
- Utilities: `kebab-case.ts` (e.g., `api-utils.ts`)
- Types: `PascalCase.ts` (e.g., `types.ts`)

### API Routes

- Routes are defined in `server/routes.ts`
- Use middleware for authentication: `authenticate`, `isAdmin`
- Return consistent JSON responses
- Handle errors appropriately

Example:
```typescript
app.get('/api/filaments', authenticate, async (req, res) => {
  try {
    const filaments = await db.select().from(filaments).where(...);
    res.json(filaments);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});
```

### Styling

- Use TailwindCSS utility classes
- Use shadcn/ui components from `client/src/components/ui/`
- Theme configuration is in `theme.json`
- Dark mode is built-in

### Internationalization

- Translation files: `client/src/i18n/locales/`
- Use `useTranslation()` hook
- Add translations to both `en.ts` and `de.ts`
- Keep keys organized by feature

## Testing

### Manual Testing

1. Start the development server: `npm run dev`
2. Access http://localhost:5000
3. Test features manually

### Type Checking

```bash
npm run check
```

This runs TypeScript compiler without emitting files.

## Common Tasks

### Adding a New API Endpoint

1. Open `server/routes.ts`
2. Add your route with appropriate middleware:
   ```typescript
   app.get('/api/your-endpoint', authenticate, async (req, res) => {
     // Implementation
   });
   ```
3. Use Drizzle ORM for database queries
4. Return JSON responses

### Adding a New Component

1. Create component in `client/src/components/`
2. Use TypeScript interfaces for props
3. Style with TailwindCSS
4. Add translations if needed
5. Export if needed

### Adding a New Database Table

1. Define schema in `shared/schema.ts`:
   ```typescript
   export const yourTable = pgTable("your_table", {
     id: serial("id").primaryKey(),
     // ... fields
   });
   ```
2. Run `npm run db:push` to create the table
3. Update types if needed

### Adding Translations

1. Add keys to `client/src/i18n/locales/en.ts`:
   ```typescript
   export default {
     // ... existing
     yourKey: "Your English Text",
   };
   ```
2. Add same key to `client/src/i18n/locales/de.ts`
3. Use in components: `const { t } = useTranslation(); t('yourKey')`

## Troubleshooting

### Database Connection Issues

**Error**: `DATABASE_URL must be set`

- Ensure `.env` file exists and contains `DATABASE_URL`
- For PostgreSQL: verify connection string format: `postgres://user:password@host:port/database`
- For SQLite: verify file path format: `file:/path/to/filadex.db` or `file:./dev.db`

**Error**: `Connection refused` (PostgreSQL)

- Check PostgreSQL is running: `pg_isready` or `psql -U postgres`
- Verify host and port in connection string
- Check firewall settings

**Error**: SQLite directory or permission error

- Ensure the directory containing the SQLite database file exists and is writable by the running process (or mounted container volume).

### Port Already in Use

**Error**: `Port 5000 is already in use`

- Change `PORT` in `.env` file
- Or kill the process using port 5000:
  ```bash
  lsof -ti:5000 | xargs kill
  ```

### TypeScript Errors

**Error**: Type errors after changes

- Run `npm run check` to see all errors
- Ensure all imports are correct
- Check `tsconfig.json` paths are configured

### Build Issues

**Error**: Build fails

- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf dist`
- Check Node.js version: `node -v` (should be v16+)

### Database Schema Issues

**Error**: Table doesn't exist

- Run `npm run db:push` to sync schema
- Check `shared/schema.ts` for correct table definitions

## Additional Resources

- [API Documentation](./API.md)
- [Translation Guide](./TRANSLATION_GUIDE.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Project README](../README.md)

## Getting Help

- Check existing [GitHub Issues](https://github.com/yourusername/filadex/issues)
- Review documentation in `docs/` directory
- Ask questions in discussions or create an issue

---

Happy coding! 🚀

