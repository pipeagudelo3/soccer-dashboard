FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
