#!/bin/bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

case "$1" in
dev)
    echo "Starting dev server at http://localhost:8080"
    npx vite --config infra/vite.config.ts
    ;;

build)
    echo "Building static site..."
    npx vite build --config infra/vite.config.ts
    echo "Done. Output in dist/"
    ;;

deploy)
    echo "Deployment is handled by GitHub Actions (GitHub Pages)."
    echo "Push to main to trigger deployment, or manually run:"
    echo "  gh workflow run 'Deploy Site'"
    ;;

*)
    echo "Usage: $0 {dev|build|deploy}"
    exit 1
    ;;
esac
