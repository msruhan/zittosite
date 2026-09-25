# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api ./apps/api
COPY apps/web/package.json ./apps/web/
RUN npm ci \
  && mkdir -p apps/api/node_modules
ENV PATH="/app/node_modules/.bin:/app/apps/api/node_modules/.bin:${PATH}"
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma \
  && cd apps/api && nest build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
WORKDIR /app/apps/api
EXPOSE 4000
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
