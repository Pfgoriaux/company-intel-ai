# Company Intel AI - Dockerfile
# Uses Xvfb for headful Chrome in container

FROM node:20-slim

# Install Chrome and Xvfb
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    xvfb \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install Patchright Chrome
RUN npx patchright install chrome

# Copy source code
COPY . .

# Set display for Xvfb
ENV DISPLAY=:99

# Expose port
EXPOSE 3002

# Clean up any stale Xvfb locks and start
CMD rm -f /tmp/.X99-lock && Xvfb :99 -screen 0 1920x1080x24 -ac & sleep 1 && node src/index.mjs
