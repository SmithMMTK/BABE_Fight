# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Production stage
FROM node:20-alpine

# Build arguments for version tracking
ARG APP_VERSION=dev
ARG BUILD_TIME
ARG GIT_COMMIT=unknown

# Set as environment variables
ENV APP_VERSION=$APP_VERSION \
    BUILD_TIME=$BUILD_TIME \
    GIT_COMMIT=$GIT_COMMIT

WORKDIR /app

# Copy backend files
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy Resources folder (courses and turbo config)
COPY Resources/ ./Resources/

# Copy version config
COPY version.config.json ./version.config.json

# Create data directory for SQLite
RUN mkdir -p /app/backend/data && \
    chown -R node:node /app

USER node

EXPOSE 8080

CMD ["node", "backend/src/server.js"]
