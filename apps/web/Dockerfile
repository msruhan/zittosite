# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_USE_MOCK=0
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
COPY apps/api/package.json ./apps/api/
RUN npm ci \
  && mkdir -p apps/web/node_modules
ENV PATH="/app/node_modules/.bin:/app/apps/web/node_modules/.bin:${PATH}"
RUN cd apps/web && next build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
