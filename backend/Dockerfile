# Backend Dockerfile - Multi-architecture SQLite3 fix
FROM node:18-alpine

# Install build dependencies for SQLite3
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies first (without building SQLite3 yet)
# Use `npm install` instead of `npm ci` to avoid strict lockfile checks
# during multi-architecture builds where the lock file may be out of date.
RUN npm install --omit=dev

# Copy source code
COPY . .

# Create directories
RUN mkdir -p data uploads

# Create startup script that rebuilds SQLite3 at runtime for current architecture
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "🚀 Starting FF Dashboard Backend..."' >> /app/start.sh && \
    echo 'echo "🔧 Rebuilding SQLite3 for current architecture..."' >> /app/start.sh && \
    echo 'npm rebuild sqlite3' >> /app/start.sh && \
    echo 'echo "✅ SQLite3 rebuild completed"' >> /app/start.sh && \
    echo 'echo "🗄️  Initializing database..."' >> /app/start.sh && \
    echo 'npm run init-db || echo "⚠️  Database might already exist"' >> /app/start.sh && \
    echo 'echo "🎯 Starting server..."' >> /app/start.sh && \
    echo 'exec node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose port
EXPOSE 3001

# Use startup script
CMD ["/app/start.sh"]