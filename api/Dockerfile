# Imagen de producción de la API (Railway la detecta si el directorio raíz del servicio es /api).
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY drizzle ./drizzle

# Aplica las migraciones y arranca. Railway inyecta PORT.
CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]
