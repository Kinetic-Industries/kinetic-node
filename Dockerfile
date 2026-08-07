FROM node:20-alpine

WORKDIR /app

# Copy manifest first for layer caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/
COPY admin-ui/ ./admin-ui/

# Create runtime directories
RUN mkdir -p /app/data/certs /app/sites

EXPOSE 8080 8443 4040

VOLUME ["/app/data", "/app/sites"]

CMD ["node", "src/server.js"]