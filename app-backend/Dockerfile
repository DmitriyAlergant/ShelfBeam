# ── Build stage ──
FROM node:20-alpine AS build
WORKDIR /app
COPY app-backend/package*.json ./
RUN npm ci
COPY app-backend/tsconfig.json ./
COPY app-backend/src/ ./src/
RUN npm run build

# ── Runtime stage ──
FROM node:20-alpine
WORKDIR /app
COPY app-backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist/ ./dist/
COPY app-backend/drizzle/ ./drizzle/
CMD ["npm", "start"]
