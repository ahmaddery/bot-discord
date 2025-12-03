/**
 * Starter script untuk menjalankan bot dan dashboard bersamaan
 * Gunakan: npm start
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Discord Bot and Dashboard...\n');

// Start Dashboard first (needs to setup WebSocket server)
const dashboard = spawn('node', ['dashboard.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
});

// Wait 3 seconds for dashboard to initialize, then start bot
setTimeout(() => {
    console.log('🤖 Starting Discord Bot...\n');
    
    // Start Discord Bot
    const bot = spawn('node', ['index.js'], {
        cwd: __dirname,
        stdio: 'inherit',
        shell: true
    });
    
    // Handle bot process
    bot.on('error', (error) => {
        console.error('❌ Bot Error:', error);
    });

    bot.on('close', (code) => {
        console.log(`⚠️ Bot process exited with code ${code}`);
        if (code !== 0) {
            console.log('🔄 Restarting bot in 5 seconds...');
            setTimeout(() => {
                spawn('node', ['index.js'], {
                    cwd: __dirname,
                    stdio: 'inherit',
                    shell: true
                });
            }, 5000);
        }
    });
    
    // Handle termination
    process.on('SIGINT', () => {
        console.log('\n⛔ Stopping bot and dashboard...');
        bot.kill();
        dashboard.kill();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n⛔ Stopping bot and dashboard...');
        bot.kill();
        dashboard.kill();
        process.exit(0);
    });
}, 3000);

// Handle dashboard process
dashboard.on('error', (error) => {
    console.error('❌ Dashboard Error:', error);
});

dashboard.on('close', (code) => {
    console.log(`⚠️ Dashboard process exited with code ${code}`);
    process.exit(1);
});

console.log('✅ Dashboard starting...');
console.log('📊 Dashboard: http://localhost:3000');
console.log('⏳ Waiting for dashboard to initialize...\n');
