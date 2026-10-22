FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Run as non-root user for security
RUN addgroup -S drandee && adduser -S drandeecore -G drandee
USER drandeecore

# Install production dependencies only
COPY --chown=drandeecore:drandee package*.json ./
RUN npm ci --only=production

# Copy backend source
COPY --chown=drandeecore:drandee . .

# Copy frontend build so server.js SEO interceptor can read index.html
COPY --from=frontend-build --chown=drandeecore:drandee /app/frontend/build ./frontend/build

EXPOSE 5000

# Start command
CMD ["npm", "start"]
