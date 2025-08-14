# Backend Dockerfile - Fixed
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

# Install dependencies and rebuild SQLite3
RUN npm ci --only=production && \
    npm rebuild sqlite3

# Copy source code
COPY . .

# Create data directory for SQLite
RUN mkdir -p data uploads

# Create a startup script that handles everything
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "🚀 Starting FF Dashboard Backend..."' >> /app/start.sh && \
    echo 'echo "🗄️  Initializing database..."' >> /app/start.sh && \
    echo 'npm run init-db || echo "⚠️  Database might already exist"' >> /app/start.sh && \
    echo 'echo "🎯 Starting server..."' >> /app/start.sh && \
    echo 'exec npm start' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose port
EXPOSE 3001

# Use startup script
CMD ["/app/start.sh"]