# SPDX-License-Identifier: AGPL-3.0-or-later
# Node 24.21.0-bookworm, über den Digest unveränderlich festgelegt.
FROM node@sha256:64af3819f9275802414d7cdc38c27e9d82bd564dec4d4da87d008255d36c63b4

ARG RUST_VERSION=1.98.1

USER root

RUN install --directory --mode=0700 --owner=node --group=node /home/node/.ssh

RUN apt-get update \
  && apt-get install --yes --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    file \
    git \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libssl-dev \
    libwebkit2gtk-4.1-dev \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*

USER node

RUN curl --fail --silent --show-error --location https://sh.rustup.rs \
  | sh -s -- -y --profile minimal --default-toolchain ${RUST_VERSION}

ENV PATH="/home/node/.cargo/bin:${PATH}"
ENV COREPACK_HOME="/home/node/.cache/corepack"

USER root

RUN mkdir --parents "${COREPACK_HOME}" \
  && chown node:node "${COREPACK_HOME}" \
  && corepack enable

USER node

RUN corepack prepare pnpm@12.8.1 --activate \
  && pnpm config set store-dir /home/node/.local/share/pnpm/store --global
