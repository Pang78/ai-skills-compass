# Stage 1: Install dependencies
FROM node:22-slim AS deps
WORKDIR /app

# Copy package manifests and patch script, then install dependencies
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

# Stage 2: Build application
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

# Run vinext build
RUN npm run build

# Stage 3: Production runner
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for container execution
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs appuser

# Copy built artifacts and dependencies
COPY --from=builder /app/public ./public
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER appuser

EXPOSE 3000

CMD ["npm", "run", "start"]
