FROM node:20-alpine as build

WORKDIR /app

# Set environment variable to skip Puppeteer download (for ARM compatibility)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application - build both frontend and backend
RUN npm run build
# Create server directory structure for migrations and init scripts
RUN mkdir -p dist/migrations
# Copy TypeScript migration files (will be run with tsx) - use shell to handle optional files
RUN if ls migrations/*.ts 1> /dev/null 2>&1; then cp migrations/*.ts dist/migrations/; fi
# Copy init-data.ts for database initialization
COPY init-data.ts dist/
# Copy run-migration.ts
COPY run-migration.ts dist/

# Production image
FROM node:20-alpine as production

# Install PostgreSQL client for database initialization
RUN apk add --no-cache postgresql-client netcat-openbsd

WORKDIR /app

# Set environment variable to skip Puppeteer download (for ARM compatibility)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies including tsx for running TypeScript scripts
RUN npm ci --omit=dev
# Install tsx and TypeScript for running migration scripts
RUN npm install --save-dev tsx typescript
# Install PostgreSQL client and database dependencies
RUN npm install pg drizzle-orm zod
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/tsconfig.json ./tsconfig.json
RUN mkdir -p ./migrations && if [ -d /app/dist/migrations ] && [ "$(ls -A /app/dist/migrations 2>/dev/null)" ]; then cp -r /app/dist/migrations/* ./migrations/; fi || true
COPY --from=build /app/init-data.ts ./init-data.ts
COPY --from=build /app/run-migration.ts ./run-migration.ts

# Kopiere das Entrypoint-Skript
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Umgebungsvariablen
ENV NODE_ENV=production
ENV PORT=8080

# Verwende das Entrypoint-Skript als Startpunkt
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]

# Stelle sicher, dass der Container auf Port 8080 hört
EXPOSE 8080
