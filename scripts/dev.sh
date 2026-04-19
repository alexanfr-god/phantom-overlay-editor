#!/bin/bash
# Start all processes in parallel
echo "🚀 Starting Phantom Overlay Editor..."
echo ""
echo "  [SERVER]  ws://localhost:3333"
echo "  [DESKTOP] Electron app"
echo "  [EXT]     packages/extension/dist (load in chrome://extensions)"
echo ""

cd "$(dirname "$0")/.."
npm run dev
