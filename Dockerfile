FROM node:20-alpine AS build

WORKDIR /app

# Set environment variable to skip Puppeteer download (for ARM compatibility)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application - build frontend, server, migrators, and seeders
RUN npm run build

# Production image
FROM node:20-alpine AS production

WORKDIR /app

# Set environment variable to skip Puppeteer download (for ARM compatibility)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy compiled bundles and static assets from build stage
COPY --from=build /app/dist ./dist
# The migration runners apply the SQL migrations from migrations/ at runtime
COPY --from=build /app/migrations ./migrations

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Use the entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/index.pg.js"]

# Expose port
EXPOSE 8080
