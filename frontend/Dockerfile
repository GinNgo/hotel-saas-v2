# ═══════════════════════════════════════════════════════════════
# Hotel SaaS Platform — Frontend Web Application (Angular 22)
# Multi-stage Enterprise Dockerfile
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Build Angular Static Bundle ──
FROM node:22-alpine AS build
WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install locked dependencies
RUN npm ci --legacy-peer-deps

# Copy application source code
COPY . .

# Compile optimized production bundle
RUN npm run build -- --configuration production

# ── Stage 2: Production Nginx High-Performance Web Server ──
FROM nginx:1.27-alpine AS runtime

# Remove default boilerplate website
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled Angular SPA assets from build stage
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# Deploy custom Nginx configuration with SPA routing and WebSocket proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check against /health endpoint
HEALTHCHECK --interval=20s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
