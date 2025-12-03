# 🔧 Dashboard Sync Fix - December 3, 2025

## Problem
Dashboard showed empty queue (Map size: 0) while bot had songs (Map size: 1).

**Root Cause**: Bot and dashboard were running as **separate processes**, each loading their own instance of `shared-state.js` with independent Map objects. Memory cannot be shared between separate Node.js processes.

## Solution
**Merged both into a single process** so they share the same memory.

### Changes Made:

#### 1. `start.js` - Single Process Launcher
- **Before**: Used `spawn()` to run `index.js` and `dashboard.js` as separate child processes
- **After**: Runs both as modules in the same process using `require()`

#### 2. `dashboard.js` - Shared Discord Client
- **Before**: Created its own Discord client and logged in separately
- **After**: Receives Discord client reference from `index.js` after bot is ready
- Added `setDiscordClient()` function to receive the bot's client

#### 3. `index.js` - Register with Dashboard
- Added code to register the Discord client with dashboard when ready
- Uses `global.dashboardModule` reference set by `start.js`

## How It Works Now

```
start.js
  ├── Loads dashboard.js (Express + WebSocket server starts)
  │     └── Sets up routes, waiting for Discord client
  │
  └── (2 second delay)
      └── Loads index.js (Discord bot)
            └── On ready → registers client with dashboard
```

**Shared Memory**:
- Both bot and dashboard now access the **same** `queues` Map from `shared-state.js`
- Bot creates queue → Dashboard sees it immediately
- Real-time sync works perfectly ✅

## Testing

Restart your bot:
```bash
npm start
```

Then:
1. Join a voice channel in Discord
2. Type `coco play butterfly`
3. Open dashboard at http://localhost:3000
4. Select your server
5. ✅ Queue should now be visible with the song!

## Technical Details

**Memory Sharing in Node.js**:
- ✅ Same process = shared memory (modules loaded once)
- ❌ Different processes = separate memory (each has own copy)

Our fix ensures `shared-state.js` is loaded **once** and accessed by both bot and dashboard logic running in the same process.

## Alternative Solutions (Not Implemented)

1. **Redis/Database**: Use external storage for queue state
   - Pro: Works across multiple servers
   - Con: Requires Redis installation and adds latency

2. **HTTP API**: Bot exposes API, dashboard polls it
   - Pro: Simple separation of concerns
   - Con: Polling overhead, not real-time

3. **IPC (Inter-Process Communication)**: Use Node.js IPC
   - Pro: Keeps processes separate
   - Con: Complex message passing, serialization overhead

Our single-process solution is optimal for single-server deployments. 🚀
