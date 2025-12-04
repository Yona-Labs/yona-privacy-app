#!/bin/bash

# Zkcash Backend Service Startup Script

echo "🚀 Starting Zkcash Backend Service..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    if [ -f .env.template ]; then
        cp .env.template .env
        echo "✅ Created .env file. Please edit it with your configuration."
        echo "   Required: PROGRAM_ID"
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if PROGRAM_ID is set
source .env
if [ -z "$PROGRAM_ID" ] || [ "$PROGRAM_ID" = "your_program_id_here" ]; then
    echo "❌ PROGRAM_ID is not configured in .env"
    echo "   Please set your Zkcash program ID in the .env file"
    exit 1
fi

echo "✅ Configuration loaded"
echo "   Solana RPC: ${SOLANA_RPC_URL:-http://127.0.0.1:8899}"
echo "   Program ID: $PROGRAM_ID"
echo "   Port: ${PORT:-3000}"

# Start the server
echo ""
echo "🎯 Starting server..."
npm run dev



