FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application - build frontend, server, migrators, and seeders
RUN npm run build

# Production image
FROM node:22-alpine AS production

WORKDIR /app

# su-exec lets the entrypoint start as root - to take ownership of the mounted
# volume - and then drop to the unprivileged `node` user the image ships with.
RUN apk add --no-cache su-exec

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy compiled bundles and static assets from build stage
COPY --from=build --chown=node:node /app/dist ./dist
# The migration runners apply the SQL migrations from migrations/ at runtime
COPY --from=build --chown=node:node /app/migrations ./migrations

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# The data directory the SQLite database and its backups live in. Owned by the
# user the server runs as; the entrypoint re-asserts this for a mounted volume.
RUN mkdir -p /data && chown -R node:node /app /data

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# /api/auth/me answers 401 to an anonymous request, which is enough to know the
# server is up and the routes are mounted.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/auth/me').then(r=>process.exit(r.status===401||r.status===200?0:1)).catch(()=>process.exit(1))"

# Use the entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/index.pg.js"]

# Expose port
EXPOSE 8080
