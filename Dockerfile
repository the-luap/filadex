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

# Build the application - only build the frontend
RUN npm run vite:build
# Create a simple server file
RUN mkdir -p dist
COPY server.js dist/index.js
# Create server directory structure
RUN mkdir -p dist/server dist/shared
# Copy schema.js to the correct location
COPY shared/schema.js dist/shared/schema.js

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

# Install production dependencies
RUN npm ci --omit=dev
# Install PostgreSQL client and database dependencies
RUN npm install pg drizzle-orm zod
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/init-data.js ./init-data.js

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