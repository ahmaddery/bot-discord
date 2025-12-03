// Shared state antara bot dan dashboard
console.log('📦 shared-state.js loaded from:', __filename);

const queues = new Map();
const serverSettings = new Map();
const connections = new Map(); // Voice connections
const players = new Map(); // Audio players

// Proxy untuk debug
const queueProxy = new Proxy(queues, {
    set(target, key, value) {
        console.log(`📦 Queue SET for guild ${key}:`, value ? `${value.songs?.length || 0} songs` : 'null');
        return target.set(key, value);
    },
    get(target, key) {
        if (typeof target[key] === 'function') {
            return target[key].bind(target);
        }
        return target[key];
    }
});

module.exports = {
    queues: queueProxy,
    serverSettings,
    connections,
    players
};
