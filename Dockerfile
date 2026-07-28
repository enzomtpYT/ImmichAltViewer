# Build Stage for Frontend
FROM node:18-alpine as frontend-build
WORKDIR /app/front-react
COPY front-react/package*.json ./
RUN npm install
COPY front-react/ ./
RUN npm run build

# Final Stage for Backend
FROM python:3.11-slim
WORKDIR /app

# Install backend dependencies
COPY back/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY back/ ./back

# Copy built frontend assets from the previous stage
# The backend expects them in ../front-react/dist relative to main.py
COPY --from=frontend-build /app/front-react/dist ./front-react/dist

# Expose the port
EXPOSE 8000

# Health check using the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Set the working directory to back where main.py is
WORKDIR /app/back

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
