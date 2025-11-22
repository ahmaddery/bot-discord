require('dotenv').config();

// Bot Client ID dari Discord Developer Portal
const CLIENT_ID = process.env.CLIENT_ID || 'YOUR_CLIENT_ID_HERE';

// Permissions yang dibutuhkan (dalam bentuk bit field)
// 3145728 = View Channels + Send Messages + Connect + Speak
const PERMISSIONS = '3147776'; // View Channels + Send Messages + Read Message History + Connect + Speak + Use Voice Activity

const inviteURL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${PERMISSIONS}&scope=bot%20applications.commands`;

console.log('\n=== INVITE BOT KE SERVER ===\n');
console.log('Link undangan bot:');
console.log(inviteURL);
console.log('\nPastikan bot memiliki permission:');
console.log('✓ View Channels');
console.log('✓ Send Messages');
console.log('✓ Read Message History');
console.log('✓ Connect (Voice)');
console.log('✓ Speak (Voice)');
console.log('✓ Use Voice Activity');
console.log('\n');
