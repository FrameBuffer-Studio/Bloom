FROM node:26-alpine@sha256:6f08a523443ddedf52941874c203475b0ad503e859ad70cb26ab8be9a517dbd5 AS build
WORKDIR /app/site
COPY site/package.json site/package-lock.json site/.npmrc ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY docs/ /app/docs/
COPY site/ ./
RUN npm run check && npm run build

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:59c479c9b8c123e66047315c968aa2d35e31ae5149c856e4110a79c8b3563f0b
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080
COPY --from=build /app/site/dist ./dist
USER nonroot
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["/nodejs/bin/node", "/app/dist/server/healthcheck.mjs"]
CMD ["/app/dist/server/server.mjs"]
