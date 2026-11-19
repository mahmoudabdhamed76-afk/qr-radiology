FROM node:22-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production PORT=3450 DATA_DIR=/app/data
VOLUME ["/app/data"]
EXPOSE 3450
CMD ["node", "server.js"]
