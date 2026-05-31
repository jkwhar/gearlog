# Simple LAN-only API for carLog
# Using Debian slim to avoid Alpine/native build issues with better-sqlite3.
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ pkg-config \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

# Prune dev artifacts (optional small cleanup)
RUN npm cache clean --force

EXPOSE 5000
CMD ["npm", "start"]
