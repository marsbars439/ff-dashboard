# Frontend Dockerfile with build arguments
FROM node:18-alpine

# Accept build argument for API URL
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Install serve for serving the built app
RUN npm install -g serve

# Set working directory
WORKDIR /app

# Copy package.json
COPY package.json ./

# Install dependencies
RUN npm install

# Copy public directory (needed for React build)
COPY public/ ./public/

# Copy src directory (the React source code)
COPY src/ ./src/

# Build the React app with the correct API URL
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Serve the built app
CMD ["serve", "-s", "build", "-l", "3000"]