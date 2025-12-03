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
        console.log('⚠️ WebSocket not ready, skipping broadcast');
        return;
    }
    
    const queues = sharedState.queues;
    const serverSettings = sharedState.serverSettings;
    
    const queue = queues.get(guildId);
    const settings = serverSettings.get(guildId) || { volume: 50, quality: 'high', aiAutoplay: true };
    
    console.log('📤 Broadcasting queue update for guild:', guildId);
    console.log('📊 Queue data:', queue ? `${queue.songs.length} songs, playing: ${queue.isPlaying}, paused: ${queue.isPaused}` : 'null');
    
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

    let clientCount = 0;
    wss.clients.forEach((ws) => {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(data);
            clientCount++;
        }
    });
    
    console.log(`✅ Broadcasted to ${clientCount} clients`);
}

module.exports = {
    setWebSocketServer,
    broadcastQueueUpdate
};
