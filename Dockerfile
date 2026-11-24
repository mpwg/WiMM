FROM oven/bun:1.4.5-slim@sha256:b780593f3e10918cbdaec3d5a08d52224b9198069a65eb47812085c2ec007643 AS base
WORKDIR /app

FROM base AS build
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

FROM base AS runtime
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000
RUN groupadd --gid 10001 wimm && useradd --uid 10001 --gid 10001 --no-create-home wimm && mkdir -p /data/receipts && chown -R 10001:10001 /data
COPY --from=build /app/.output ./.output
COPY --from=build /app/tools/manage.mjs ./tools/manage.mjs
COPY --from=build /app/migrations ./migrations
USER 10001:10001
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
