/**
 * Starter script untuk menjalankan bot dan dashboard dalam satu process
 * Ini penting untuk share memory antara bot dan dashboard!
 * Gunakan: npm start
 */

console.log('🚀 Starting Discord Bot and Dashboard in single process...\n');

// Load dashboard first (sets up Express server + WebSocket)
console.log('✅ Loading dashboard...');
const dashboard = require('./dashboard.js');

// Set global reference so bot can register itself
global.dashboardModule = dashboard;

// Wait for dashboard to initialize, then load bot
setTimeout(() => {
    console.log('🤖 Loading Discord Bot...\n');
    require('./index.js');
}, 2000);

// Handle termination
process.on('SIGINT', () => {
    console.log('\n⛔ Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n⛔ Shutting down gracefully...');
    process.exit(0);
});
