FROM node:20-alpine as build

WORKDIR /app

# Installiere Abhängigkeiten
COPY package*.json ./
RUN npm ci

# Kopiere Sourcecode
COPY . .

# Baue die Anwendung
RUN npm run build

# Produkions-Image
FROM node:20-alpine as production

# Installiere PostgreSQL-Client für Datenbankinitialisierung
RUN apk add --no-cache postgresql-client netcat-openbsd

WORKDIR /app

# Kopiere package.json und package-lock.json
COPY package*.json ./

# Kopiere alle Abhängigkeiten und den Build der Anwendung
RUN npm ci
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