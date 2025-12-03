const express = require('express');
const path = require('path');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { WebSocketServer } = require('ws');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const sharedState = require('./shared-state');
const broadcast = require('./broadcast');
require('dotenv').config();

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

// Setup WebSocket
const wss = new WebSocketServer({ noServer: true });

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Discord client untuk dashboard
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Login bot
client.login(process.env.DISCORD_TOKEN);

client.once('clientReady', () => {
    console.log(`✅ Dashboard Bot: ${client.user.tag} connected!`);
});

// Gunakan shared state dari shared-state.js
const queues = sharedState.queues;
const serverSettings = sharedState.serverSettings;
const connections = sharedState.connections;
const players = sharedState.players;

// Update Discord presence when playing
function updateDiscordPresence(queue) {
    if (queue && queue.isPlaying && queue.songs.length > 0) {
        const currentSong = queue.songs[0];
        client.user.setPresence({
            activities: [{
                name: currentSong.title,
                type: ActivityType.Listening,
                url: currentSong.url
            }],
            status: 'online'
        });
    } else {
        client.user.setPresence({
            activities: [{
                name: 'joshua help',
                type: ActivityType.Listening
            }],
            status: 'idle'
        });
    }
}

// Routes
app.get('/', (req, res) => {
    const guilds = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true, size: 128 }),
        memberCount: guild.memberCount,
        hasQueue: queues.has(guild.id)
    }));

    res.render('index', { 
        botUser: client.user,
        guilds: guilds,
        totalGuilds: client.guilds.cache.size,
        totalMembers: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)
    });
});

app.get('/server/:guildId', (req, res) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
        return res.redirect('/');
    }

    const queue = queues.get(guildId);
    const settings = serverSettings.get(guildId) || { volume: 50, quality: 'high', aiAutoplay: true };

    res.render('server', {
        guild: {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ dynamic: true, size: 256 }),
            memberCount: guild.memberCount
        },
        queue: queue ? {
            songs: queue.songs.map((song, index) => ({
                ...song,
                position: index + 1,
                isCurrent: index === 0
            })),
            isPlaying: queue.isPlaying,
            isPaused: queue.isPaused,
            repeatMode: queue.repeatMode,
            isShuffled: queue.isShuffled
        } : null,
        settings: settings
    });
});

app.get('/commands', (req, res) => {
    const commands = [
        {
            category: 'Playback',
            commands: [
                { name: 'joshua play <lagu>', alias: 'joshua p', description: 'Putar lagu dari SoundCloud' },
                { name: 'joshua pause', description: 'Jeda lagu' },
                { name: 'joshua resume', description: 'Lanjutkan lagu' },
                { name: 'joshua skip', alias: 'joshua s', description: 'Lewati lagu' },
                { name: 'joshua stop', description: 'Stop & keluar dari voice' }
            ]
        },
        {
            category: 'Queue',
            commands: [
                { name: 'joshua queue', alias: 'joshua q', description: 'Lihat antrian lagu' },
                { name: 'joshua clear', description: 'Hapus semua lagu di queue' },
                { name: 'joshua shuffle', description: 'Acak urutan lagu' }
            ]
        },
        {
            category: 'Settings',
            commands: [
                { name: 'joshua volume <0-100>', description: 'Atur volume' },
                { name: 'joshua repeat', description: 'Toggle repeat mode' },
                { name: 'joshua autoplay', description: 'Toggle AI autoplay' }
            ]
        },
        {
            category: 'Info',
            commands: [
                { name: 'joshua nowplaying', alias: 'joshua np', description: 'Info lagu yang sedang putar' },
                { name: 'joshua help', description: 'Tampilkan bantuan' }
            ]
        }
    ];

    res.render('commands', { commands });
});

// API Endpoints
app.get('/api/guilds', (req, res) => {
    const guilds = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true }),
        memberCount: guild.memberCount,
        hasQueue: queues.has(guild.id)
    }));

    res.json(guilds);
});

app.get('/api/server/:guildId/queue', (req, res) => {
    const queue = queues.get(req.params.guildId);
    
    if (!queue) {
        return res.json({ error: 'No queue found' });
    }

    res.json({
        songs: queue.songs,
        isPlaying: queue.isPlaying,
        isPaused: queue.isPaused,
        repeatMode: queue.repeatMode,
        isShuffled: queue.isShuffled
    });
});

// Control endpoints
app.post('/api/server/:guildId/play', async (req, res) => {
    const { guildId } = req.params;
    const { query } = req.body;
    
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }

        // Cari lagu di SoundCloud
        const searched = await play.search(query, { limit: 1, source: { soundcloud: 'tracks' } });
        if (searched.length === 0) {
            return res.status(404).json({ error: 'Song not found' });
        }

        const song = {
            title: searched[0].name || searched[0].title,
            url: searched[0].url,
            duration: formatDuration(searched[0].durationInSec),
            thumbnail: searched[0].thumbnails?.[0]?.url || searched[0].thumbnail,
            requester: 'Dashboard User',
            type: 'soundcloud'
        };

        let queue = queues.get(guildId);
        
        // Jika belum ada queue, cari class Queue dari index.js atau buat simple
        if (!queue) {
            queue = {
                songs: [],
                isPlaying: false,
                isPaused: false,
                repeatMode: 'off',
                isShuffled: false,
                connection: null,
                player: null
            };
            queues.set(guildId, queue);
        }

        queue.songs.push(song);

        // Jika belum playing, mulai play
        if (!queue.isPlaying) {
            await playSong(guild, queue);
        }

        // Broadcast update
        broadcast.broadcastQueueUpdate(guildId);

        res.json({ success: true, song });
    } catch (error) {
        console.error('Error adding song:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/server/:guildId/pause', (req, res) => {
    const { guildId } = req.params;
    const queue = queues.get(guildId);
    
    if (!queue || !queue.player) {
        return res.status(404).json({ error: 'No active player' });
    }
    
    queue.player.pause();
    queue.isPaused = true;
    
    broadcast.broadcastQueueUpdate(guildId);
    res.json({ success: true, isPaused: true });
});

app.post('/api/server/:guildId/resume', (req, res) => {
    const { guildId } = req.params;
    const queue = queues.get(guildId);
    
    if (!queue || !queue.player) {
        return res.status(404).json({ error: 'No active player' });
    }
    
    queue.player.unpause();
    queue.isPaused = false;
    
    broadcast.broadcastQueueUpdate(guildId);
    res.json({ success: true, isPaused: false });
});

app.post('/api/server/:guildId/skip', (req, res) => {
    const { guildId } = req.params;
    const queue = queues.get(guildId);
    
    if (!queue || !queue.player) {
        return res.status(404).json({ error: 'No active player' });
    }
    
    // Stop current song to trigger next
    queue.player.stop();
    
    broadcast.broadcastQueueUpdate(guildId);
    res.json({ success: true });
});

app.post('/api/server/:guildId/stop', (req, res) => {
    const { guildId } = req.params;
    const queue = queues.get(guildId);
    
    if (!queue) {
        return res.status(404).json({ error: 'No queue found' });
    }
    
    queue.songs = [];
    queue.isPlaying = false;
    queue.isPaused = false;
    
    if (queue.player) {
        queue.player.stop();
    }
    
    if (queue.connection) {
        queue.connection.destroy();
    }
    
    queues.delete(guildId);
    
    broadcast.broadcastQueueUpdate(guildId);
    res.json({ success: true });
});

app.post('/api/server/:guildId/volume', (req, res) => {
    const { guildId } = req.params;
    const { volume } = req.body;
    
    if (volume < 0 || volume > 100) {
        return res.status(400).json({ error: 'Volume must be between 0 and 100' });
    }
    
    let settings = serverSettings.get(guildId);
    if (!settings) {
        settings = { volume: 100, quality: 'high', aiAutoplay: true };
        serverSettings.set(guildId, settings);
    }
    
    settings.volume = volume;
    
    broadcast.broadcastQueueUpdate(guildId);
    res.json({ success: true, volume });
});

// Helper functions
async function playSong(guild, queue) {
    if (queue.songs.length === 0) {
        queue.isPlaying = false;
        return;
    }

    const song = queue.songs[0];
    
    try {
        const stream = await play.stream(song.url);
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true
        });

        // Set volume
        const settings = serverSettings.get(guild.id) || { volume: 100 };
        resource.volume.setVolume(settings.volume / 100);

        if (!queue.player) {
            queue.player = createAudioPlayer();
            players.set(guild.id, queue.player);
        }

        queue.player.play(resource);
        queue.isPlaying = true;
        queue.isPaused = false;

        // Update Discord presence
        updateDiscordPresence(queue);
        broadcast.broadcastQueueUpdate(guild.id);

        // Handle player events
        queue.player.once(AudioPlayerStatus.Idle, () => {
            queue.songs.shift();
            
            if (queue.songs.length > 0) {
                playSong(guild, queue);
            } else {
                queue.isPlaying = false;
                broadcast.broadcastQueueUpdate(guild.id);
            }
        });

    } catch (error) {
        console.error('Error playing song:', error);
        queue.isPlaying = false;
    }
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Error handler
app.use((req, res) => {
    res.status(404).render('404');
});

// Start server
const HOST = process.env.DASHBOARD_HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
    console.log(`\n🌐 Dashboard running at http://${HOST}:${PORT}`);
    console.log(`📊 Local access: http://localhost:${PORT}`);
    console.log(`📡 Network access: http://20.17.97.248:${PORT}`);
    console.log(`✅ Ready to accept connections!\n`);
});

// Register WebSocket server untuk broadcasting
broadcast.setWebSocketServer(wss);

// WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// WebSocket connection
wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'requestUpdate') {
                broadcast.broadcastQueueUpdate(data.guildId);
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
});

// Export untuk integrasi dengan bot utama
module.exports = { queues, serverSettings, app, client, updateDiscordPresence };
