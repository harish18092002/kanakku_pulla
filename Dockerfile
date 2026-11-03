# Two stages: the final image holds only Next's standalone output, so it costs less to store and starts faster.
FROM node:24-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
# Owned by the runtime user because next/image writes its cache under .next/cache.
COPY --chown=node:node --from=build /app/.next/standalone ./
COPY --chown=node:node --from=build /app/.next/static ./.next/static
COPY --chown=node:node --from=build /app/public ./public
# lib/config.ts reads <cwd>/.env. Cloud Run mounts the secret at /secrets/.env, because mounting it at
# /app/.env would hide the rest of /app. No -f on purpose: the build fails if a real .env reaches the image.
RUN ln -s /secrets/.env .env
USER node
CMD ["node", "server.js"]
