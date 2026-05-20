#!/bin/bash

# Start all development servers for lazyboy
# Usage: ./dev.sh

set -e

echo "Starting development servers..."
echo ""

# Kill all child processes on exit
trap 'echo ""; echo "Stopping all dev servers..."; kill 0' EXIT INT TERM

echo "Starting lazyboy dev server..."
npm run dev &
SITEGEIST_PID=$!

echo "Starting lazyboy site dev server..."
(cd site && ./run.sh dev) &
SITE_PID=$!

echo ""
echo "All dev services started"
echo "  lazyboy: watching"
echo "  site backend: http://localhost:3000"
echo "  site frontend: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background jobs
wait
