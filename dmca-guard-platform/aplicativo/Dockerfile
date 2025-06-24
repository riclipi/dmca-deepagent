# Use Node.js 18 Alpine
FROM node:18-alpine AS deps

# Install necessary packages including OpenSSL 3
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    openssl-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --include=dev

# Generate Prisma client with correct OpenSSL
RUN npx prisma generate

# Build stage
FROM node:18-alpine AS builder

# Install OpenSSL 3
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    openssl-dev

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy application code
COPY . .

# Set environment variables for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Set temporary env vars for build (Railway will override these)
ENV DATABASE_URL="postgresql://temp:temp@localhost:5432/temp"
ENV NEXTAUTH_SECRET="temp-secret-for-build"
ENV RESEND_API_KEY="re_temp_key"

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

# Install OpenSSL 3 for runtime
RUN apk add --no-cache \
    libc6-compat \
    openssl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create app user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Copy node_modules for Prisma
COPY --from=builder /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]