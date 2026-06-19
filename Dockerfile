# Stage 1: Build & Dependencies
FROM node:25-alpine AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Stage 2: Production Runner
FROM node:25-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Start command (running node directly handles system signals correctly)
CMD ["node", "server.js"]
