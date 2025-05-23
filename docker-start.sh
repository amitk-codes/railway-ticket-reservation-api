#!/bin/bash

# Railway Ticket Reservation API - Docker Startup Script
# This script helps you get started with the Docker deployment quickly

set -e

echo "Railway Ticket Reservation API - Docker Setup"
echo "================================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if .env file exists, if not create from example
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "Creating .env file from .env.example..."
        cp .env.example .env
        echo ".env file created. You can edit it to customize your configuration."
    else
        echo "No .env.example file found. Using default environment variables."
    fi
else
    echo ".env file already exists."
fi

# Stop any existing containers
echo "Stopping any existing containers..."
docker-compose down 2>/dev/null || true

# Build and start the services
echo "Building and starting services..."
docker-compose up -d --build

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "Services are running!"
    
    # Display service status
    echo ""
    echo "Service Status:"
    docker-compose ps
    
    echo ""
    echo "Railway Ticket Reservation API is ready!"
    echo ""
    echo "API URL: http://localhost:$(grep PORT .env 2>/dev/null | cut -d'=' -f2 || echo '3000')"
    echo "Health Check: curl http://localhost:$(grep PORT .env 2>/dev/null | cut -d'=' -f2 || echo '3000')/health"
    echo ""
    echo "Useful commands:"
    echo "   View logs:           docker-compose logs -f"
    echo "   Stop services:       docker-compose down"
    echo "   Restart services:    docker-compose restart"
    echo "   Clean up:           docker-compose down -v"
    echo ""
    echo "Check the README.md for API documentation and usage examples."
else
    echo "Failed to start services. Check the logs:"
    docker-compose logs
    exit 1
fi 