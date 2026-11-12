FROM node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
RUN npm install --global pnpm@12.16.1

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS runtime
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000
WORKDIR /app
RUN groupadd --gid 10001 wimm && useradd --uid 10001 --gid 10001 --no-create-home wimm && mkdir -p /data/receipts && chown -R 10001:10001 /data
COPY --from=build /app/.output ./.output
COPY --from=build /app/tools/manage.mjs ./tools/manage.mjs
COPY --from=build /app/migrations ./migrations
RUN ln -s .output/server/node_modules node_modules
USER 10001:10001
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
