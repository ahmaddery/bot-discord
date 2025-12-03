// Shared state antara bot dan dashboard
const queues = new Map();
const serverSettings = new Map();
const connections = new Map(); // Voice connections
const players = new Map(); // Audio players

module.exports = {
    queues,
    serverSettings,
    connections,
    players
};
