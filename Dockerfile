# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install Python and WeasyPrint dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-pillow \
    py3-cffi \
    py3-brotli \
    pango \
    cairo \
    gdk-pixbuf \
    fontconfig \
    ttf-freefont \
    font-noto \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-por

# Install Python packages
RUN pip3 install --no-cache-dir --break-system-packages \
    weasyprint \
    jinja2 \
    pdfplumber \
    pytesseract \
    pillow

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared

# Create uploads directory
RUN mkdir -p uploads/faturas_geradas uploads/relatorios

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose the application port
EXPOSE 5000

# Start the application
CMD ["node", "dist/index.cjs"]
