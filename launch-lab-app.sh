#!/bin/bash

# Istio Lab App Launcher
# This script launches the modern Electron-based lab application

echo "🚀 Launching Istio PM Mastery Lab App..."

# Check if we're in the right directory
if [ ! -d "istio-lab-app" ]; then
    echo "❌ Error: istio-lab-app directory not found!"
    echo "Please run this script from the istio_lab root directory."
    exit 1
fi

cd istio-lab-app

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the development server
echo "🔧 Starting development environment..."
npm run dev
