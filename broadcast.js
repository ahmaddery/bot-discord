/**
 * Broadcast helper untuk sync bot dan dashboard
 * Menghindari circular dependency
 */

const sharedState = require('./shared-state');

// WebSocket server (akan di-set oleh dashboard.js)
let wss = null;

function setWebSocketServer(websocketServer) {
    wss = websocketServer;
    console.log('✅ WebSocket server registered for broadcasting');
}

function broadcastQueueUpdate(guildId) {
    if (!wss) {
        // WebSocket belum ready, skip broadcast
        return;
    }
    
    const queues = sharedState.queues;
    const serverSettings = sharedState.serverSettings;
    
    const queue = queues.get(guildId);
    const settings = serverSettings.get(guildId) || { volume: 50, quality: 'high', aiAutoplay: true };
    
    const data = JSON.stringify({
        type: 'queueUpdate',
        guildId: guildId,
        queue: queue ? {
            songs: queue.songs,
            isPlaying: queue.isPlaying,
            isPaused: queue.isPaused,
            repeatMode: queue.repeatMode,
            isShuffled: queue.isShuffled
        } : null,
        settings: settings
    });

    wss.clients.forEach((ws) => {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(data);
        }
    });
}

module.exports = {
    setWebSocketServer,
    broadcastQueueUpdate
};
