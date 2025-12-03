/**
 * Broadcast helper untuk sync bot dan dashboard
 * Menghindari circular dependency
 */

const sharedState = require('./shared-state');

// WebSocket server (akan di-set oleh dashboard.js)
let wss = null;
let isReady = false;
let pendingBroadcasts = [];

function setWebSocketServer(websocketServer) {
    wss = websocketServer;
    
    // Tunggu sebentar untuk memastikan server benar-benar ready
    setTimeout(() => {
        isReady = true;
        console.log('✅ WebSocket server registered for broadcasting');
        
        // Broadcast pending updates dengan delay untuk memastikan data ready
        if (pendingBroadcasts.length > 0) {
            console.log(`📤 Broadcasting ${pendingBroadcasts.length} pending updates...`);
            
            // Delay 100ms untuk memastikan data sudah ready
            setTimeout(() => {
                pendingBroadcasts.forEach(guildId => {
                    broadcastQueueUpdate(guildId);
                });
                pendingBroadcasts = [];
            }, 100);
        }
    }, 500);
}

function broadcastQueueUpdate(guildId) {
    if (!guildId) {
        console.log('⚠️ Guild ID is undefined, skipping broadcast');
        return;
    }
    
    if (!isReady || !wss) {
        // WebSocket belum ready, simpan untuk nanti
        if (!pendingBroadcasts.includes(guildId)) {
            pendingBroadcasts.push(guildId);
            console.log('📥 Queued broadcast for guild:', guildId, '(WebSocket not ready yet)');
        }
        return;
    }
    
    const queues = sharedState.queues;
    const serverSettings = sharedState.serverSettings;
    
    console.log('📦 Broadcast accessing queues. Map size:', queues.size);
    const queue = queues.get(guildId);
    const settings = serverSettings.get(guildId) || { volume: 50, quality: 'high', aiAutoplay: true };
    
    console.log('📤 Broadcasting queue update for guild:', guildId);
    console.log('📊 Queue raw:', queue);
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
