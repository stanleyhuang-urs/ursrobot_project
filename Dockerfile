FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY . .
# prisma generate only needs DATABASE_URL to be defined (it validates the
# schema's env() reference, but never connects) — the real value is
# supplied at runtime via docker-compose.
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.js ./server.js

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
