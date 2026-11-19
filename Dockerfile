# syntax=docker/dockerfile:1

FROM node:24-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Для каркаса оставляем devDependencies: в контейнере нужен Prisma CLI
# для `prisma migrate deploy`. В продакшене образ можно разделить на
# отдельный job миграций и урезанный runtime.
FROM node:24-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3000
CMD ["node", "dist/main.js"]
