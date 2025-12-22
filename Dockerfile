# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy backend files
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy Resources folder (courses and turbo config)
COPY Resources/ ./Resources/

# Create data directory for SQLite
RUN mkdir -p /app/backend/data && \
    chown -R node:node /app

USER node

EXPOSE 8080

CMD ["node", "backend/src/server.js"]
