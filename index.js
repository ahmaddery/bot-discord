require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const play = require('play-dl');
const prism = require('prism-media');
const Deezer = require('deezer-public-api');
const fetch = require('node-fetch');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharedState = require('./shared-state');
const broadcast = require('./broadcast');

// Inisialisasi Deezer
const deezer = new Deezer();

// Inisialisasi Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Setup SoundCloud
async function setupPlayDL() {
    try {
        // Inisialisasi play-dl untuk SoundCloud
        await play.getFreeClientID().then((clientID) => {
            play.setToken({
                soundcloud: {
                    client_id: clientID
                }
            });
        });
        console.log('✅ SoundCloud client ID berhasil diinisialisasi');
    } catch (error) {
        console.error('⚠️ Warning: Tidak bisa mendapatkan SoundCloud client ID:', error.message);
        console.log('Bot akan tetap berjalan dengan fitur terbatas');
    }
}

// Inisialisasi bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

// Gunakan shared state dari shared-state.js
const queues = sharedState.queues;
const serverSettings = sharedState.serverSettings;
const connections = sharedState.connections;
const players = sharedState.players;

// Struktur queue untuk setiap server
class Queue {
    constructor() {
        this.songs = [];
        this.connection = null;
        this.player = null;
        this.isPlaying = false;
        this.originalQueue = []; // Simpan queue asli untuk shuffle
        this.isShuffled = false;
        this.playHistory = []; // Track lagu yang sudah diputar untuk shuffle pintar
        this.isPaused = false;
        this.repeatMode = 'off'; // off, song, queue
        this.autoplay = true; // Autoplay AI recommendations (default ON)
        this.autoplayTimer = null; // Timer untuk autoplay
        this.isAutoplayActive = false; // Flag untuk cek apakah sedang autoplay
        this.userAddedSongs = []; // Track lagu yang ditambah user untuk analisa pattern
        this.preferredPlatform = null; // Platform preference (soundcloud/deezer)
        this.textChannel = null; // Channel untuk kirim notifikasi
    }
}

// Struktur settings untuk setiap server
class ServerSettings {
    constructor() {
        this.quality = 'high'; // default: high, options: low, medium, high
        this.volume = 100; // default: 100%, range: 0-100
    }
}

// Fungsi helper untuk search Deezer
async function searchDeezer(query, limit = 10) {
    try {
        const results = await deezer.search(query, { limit });
        return results.data || [];
    } catch (error) {
        console.error('Error searching Deezer:', error);
        return [];
    }
}

// Fungsi helper untuk mendapatkan preview URL dari Deezer
function getDeezerPreviewUrl(track) {
    // Deezer menyediakan preview 30 detik
    return track.preview || null;
}

// Fungsi helper untuk truncate string
function truncateString(str, maxLength) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

// Fungsi AI untuk mendapatkan rekomendasi lagu menggunakan Gemini
async function getAIRecommendation(queue) {
    try {
        // Ambil lagu dari history dan user songs untuk konteks
        const recentSongs = [...queue.playHistory.slice(-5), ...queue.userAddedSongs.slice(-5)];
        
        if (recentSongs.length === 0) {
            // Jika tidak ada history, return lagu populer default
            return "Shape of You - Ed Sheeran";
        }

        // Buat prompt yang SANGAT SPESIFIK untuk Gemini (seperti Spotify algorithm)
        const songList = recentSongs.map(s => `"${s.title}"`).join(', ');
        
        let prompt;
        if (recentSongs.length === 1) {
            // Kalau cuma 1 lagu, AI harus analisa LEBIH DALAM dari lagu itu
            prompt = `You are a music recommendation AI like Spotify's algorithm.

User just played this ONE song: ${songList}

DEEP ANALYSIS - Based ONLY on this song, analyze:
1. GENRE: What is the exact music genre? (indie rock, pop, electronic, hip-hop, R&B, alternative, etc.)
2. ARTIST STYLE: What is the artist's style? (indie, mainstream, underground, etc.)
3. MOOD: What's the mood/vibe? (upbeat, melancholic, chill, energetic, dreamy, etc.)
4. SIMILAR ARTISTS: Who are artists with similar sound?

Now recommend ONE song that:
- Is from the SAME or VERY SIMILAR genre
- Has SIMILAR mood and vibe
- Is from a well-known artist in that genre
- Is NOT a remix, DJ mix, compilation, or mashup
- Is a REAL SONG from one artist

STRICT RULES:
- NO party mixes, summer vibes compilations
- NO DJ sets, remixes, or bass boosted
- NO "best of" or "top hits" collections
- ONLY single songs from real artists

Format: Song Title - Artist Name
Example: Mr. Brightside - The Killers`;
        } else {
            // Kalau 2+ lagu, analisa pattern
            prompt = `You are a music recommendation AI like Spotify's algorithm. 

User's listening history: ${songList}

Analyze:
1. GENRE: What genre/style are these songs? (pop, rock, indie, electronic, hip-hop, R&B, etc.)
2. LANGUAGE: What language are the lyrics? (English, Indonesian, Korean, etc.)
3. MOOD: What's the mood? (upbeat, melancholic, chill, energetic, etc.)
4. ERA: What era? (2020s, 2010s, 2000s, 90s, 80s, etc.)

Based on this analysis, recommend ONE similar song that:
- Matches the SAME genre
- Matches the SAME language
- Has similar mood and tempo
- Is from a well-known artist
- Is NOT a remix, DJ mix, or compilation
- Is a REAL SONG with proper artist name

IMPORTANT RULES:
- NO DJ remixes or bass boosted versions
- NO compilation albums or mix tapes  
- NO generic trending/viral songs
- ONLY mainstream popular songs from real artists

Reply with ONLY:
Song Title - Artist Name

Example: Levitating - Dua Lipa`;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let recommendation = response.text().trim();
        
        // Validasi: Filter out bad recommendations (lebih ketat!)
        const badKeywords = [
            'dj', 'remix', 'mix', 'mashup', 'cover',
            'bass boosted', 'trending', 'compilation', 'best of',
            'moosewala', 'punjabi', 'arabic',
            'party', 'summer', 'vibes', 'hits collection',
            'vol.', 'part', 'episode'
        ];
        
        const hasBadKeyword = badKeywords.some(keyword => 
            recommendation.toLowerCase().includes(keyword)
        );
        
        if (hasBadKeyword) {
            console.log(`⚠️ Bad AI recommendation detected: "${recommendation}"`);
            console.log(`🔄 AI failed, forcing re-generation with stricter prompt...`);
            
            // Emergency: Paksa AI untuk recommend dengan prompt ULTRA strict
            const lastSong = recentSongs[recentSongs.length - 1];
            const emergencyPrompt = `CRITICAL: Recommend ONE real song by ONE real artist.

Based on: ${lastSong.title}

Rules:
- MUST be a single song, NOT a mix/compilation
- MUST be from ONE artist only
- MUST be in same genre
- Format: "Song Name - Artist Name"

Example: Wonderwall - Oasis

NO mixes, NO compilations, NO DJs. Just ONE song.`;
            
            try {
                const retryResult = await model.generateContent(emergencyPrompt);
                const retryResponse = await retryResult.response;
                recommendation = retryResponse.text().trim();
                console.log(`🎯 Retry recommendation: "${recommendation}"`);
            } catch (error) {
                console.log(`❌ Retry failed, using ultimate fallback`);
                // Ultimate fallback: Popular mainstream songs
                const fallbacks = [
                    "Blinding Lights - The Weeknd",
                    "Shape of You - Ed Sheeran", 
                    "Someone Like You - Adele",
                    "Levitating - Dua Lipa",
                    "Shivers - Ed Sheeran"
                ];
                recommendation = fallbacks[Math.floor(Math.random() * fallbacks.length)];
            }
        }
        
        console.log(`🤖 AI Recommendation: ${recommendation}`);
        return recommendation;

    } catch (error) {
        console.error('Error getting AI recommendation:', error);
        // Fallback: ambil dari artist yang sama dengan lagu terakhir
        const lastSong = queue.playHistory[queue.playHistory.length - 1];
        if (lastSong && lastSong.title.includes('-')) {
            const artist = lastSong.title.split('-')[1]?.trim();
            return artist ? `popular song by ${artist}` : 'popular music 2024';
        }
        return 'trending music 2024';
    }
}

// Fungsi untuk autoplay lagu berikutnya
async function autoplayNextSong(guild, queue) {
    if (!queue || !queue.autoplay) return;
    
    // Prevent multiple simultaneous autoplay calls
    if (queue.isAutoplayActive) {
        console.log('⚠️ Autoplay already running, skipping...');
        return;
    }
    
    try {
        queue.isAutoplayActive = true;
        console.log(`📊 Analyzing ${queue.userAddedSongs.length} user songs for recommendation...`);
        
        // Dapatkan rekomendasi dari AI
        const recommendation = await getAIRecommendation(queue);
        
        // Tentukan platform berdasarkan preference user
        const useDeezer = queue.preferredPlatform === 'deezer';
        
        let song = null;
        
        if (useDeezer) {
            // Coba search di Deezer dulu
            const deezerResults = await searchDeezer(recommendation, 1);
            if (deezerResults.length > 0) {
                const track = deezerResults[0];
                const artist = track.artist?.name || 'Unknown';
                
                // Search di SoundCloud untuk streaming
                const scQuery = `${track.title} ${artist}`;
                const scResults = await play.search(scQuery, { 
                    source: { soundcloud: 'tracks' }, 
                    limit: 1 
                });
                
                if (scResults && scResults.length > 0) {
                    const scTrack = scResults[0];
                    // Gunakan durasi dari Deezer, bukan SoundCloud (lebih akurat)
                    const duration = track.duration ? formatDuration(track.duration) : formatDuration(scTrack.durationInSec);
                    song = {
                        title: `${track.title} - ${artist}`,
                        url: scTrack.url,
                        duration: duration,
                        thumbnail: track.album?.cover_medium || scTrack.thumbnail?.url || null,
                        requester: '🤖 AI Autoplay',
                        platform: 'deezer',
                        isAutoplay: true
                    };
                }
            }
        }
        
        // Jika Deezer gagal atau prefer SoundCloud, coba SoundCloud
        if (!song) {
            const scResults = await play.search(recommendation, { 
                source: { soundcloud: 'tracks' }, 
                limit: 1 
            });
            
            if (scResults && scResults.length > 0) {
                const track = scResults[0];
                song = {
                    title: track.name || track.title,
                    url: track.url,
                    duration: formatDuration(track.durationInSec),
                    thumbnail: track.thumbnail?.url || track.thumbnails?.[0]?.url || null,
                    requester: '🤖 AI Autoplay',
                    platform: 'soundcloud',
                    isAutoplay: true
                };
            }
        }
        
        if (song) {
            queue.songs.push(song);
            
            // Broadcast ke dashboard
            broadcast.broadcastQueueUpdate(guild.id);
            
            // Kirim notifikasi
            if (queue.textChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('🤖 AI Autoplay')
                    .setDescription(`Merekomendasikan: **${song.title}**`)
                    .setThumbnail(song.thumbnail)
                    .setFooter({ text: 'Autoplay akan berlanjut sampai kamu add lagu baru' });
                
                queue.textChannel.send({ embeds: [embed] });
            }
            
            // Play jika tidak ada yang sedang diputar
            if (!queue.isPlaying || queue.songs.length === 1) {
                playSong(guild, song);
            }
        }
        
        queue.isAutoplayActive = false;
        
    } catch (error) {
        console.error('Error in autoplay:', error);
        queue.isAutoplayActive = false;
    }
}

// Fungsi helper untuk add lagu ke queue dan play
async function addToQueueAndPlay(message, song) {
    let queue = queues.get(message.guild.id);
    
    if (!queue) {
        queue = new Queue();
        queue.textChannel = message.channel; // Save text channel for notifications
        queues.set(message.guild.id, queue);

        queue.connection = joinVoiceChannel({
            channelId: message.member.voice.channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        queue.player = createAudioPlayer();
        queue.connection.subscribe(queue.player);
        
        // Broadcast initial queue creation
        broadcast.broadcastQueueUpdate(message.guild.id);

        // Event ketika lagu selesai
        queue.player.on(AudioPlayerStatus.Idle, async () => {
            // Clear autoplay timer jika ada
            if (queue.autoplayTimer) {
                clearTimeout(queue.autoplayTimer);
                queue.autoplayTimer = null;
            }

            if (queue.songs.length === 0) {
                queue.isPlaying = false;
                return;
            }

            // Cek apakah lagu yang selesai adalah lagu dari user atau autoplay
            const finishedSong = queue.songs[0];
            const wasAutoplay = finishedSong?.isAutoplay || false;

            // Handle repeat modes
            if (queue.repeatMode === 'song') {
                // Repeat lagu saat ini
                playSong(message.guild, queue.songs[0]);
            } else if (queue.repeatMode === 'queue' && queue.songs.length === 1) {
                // Jika repeat queue dan ini lagu terakhir, restart queue
                if (queue.originalQueue.length > 0 && queue.isShuffled) {
                    queue.songs = [...queue.originalQueue];
                } else if (queue.playHistory.length > 0) {
                    queue.songs = [...queue.playHistory, queue.songs[0]];
                    queue.playHistory = [];
                }
                playSong(message.guild, queue.songs[0]);
            } else {
                // Normal mode atau repeat queue dengan lagu masih ada
                if (queue.songs.length > 0) {
                    queue.playHistory.push(queue.songs[0]);
                    if (queue.playHistory.length > 10) {
                        queue.playHistory.shift();
                    }
                }
                
                queue.songs.shift();
                
                // Broadcast ke dashboard
                broadcast.broadcastQueueUpdate(message.guild.id);
                
                if (queue.songs.length > 0) {
                    playSong(message.guild, queue.songs[0]);
                } else if (queue.repeatMode === 'queue' && queue.playHistory.length > 0) {
                    // Restart queue untuk repeat mode
                    queue.songs = [...queue.playHistory];
                    queue.playHistory = [];
                    playSong(message.guild, queue.songs[0]);
                } else {
                    // Queue kosong - trigger autoplay
                    queue.isPlaying = false;
                    
                    if (queue.autoplay) {
                        // Jika lagu terakhir dari autoplay, langsung play lagu AI berikutnya
                        if (wasAutoplay) {
                            console.log('🤖 Autoplay continuous: loading next AI recommendation...');
                            
                            // Clear timer lama kalau ada
                            if (queue.autoplayTimer) {
                                clearTimeout(queue.autoplayTimer);
                                queue.autoplayTimer = null;
                            }
                            
                            // Langsung trigger autoplay tanpa delay
                            setTimeout(async () => {
                                // Double check queue masih kosong
                                if (queue.songs.length === 0 && queue.autoplay) {
                                    await autoplayNextSong(message.guild, queue);
                                }
                            }, 1000); // Delay 1 detik untuk stabilitas
                        } else {
                            // Jika lagu terakhir dari user, tunggu 60 detik
                            console.log('⏰ Starting 60s autoplay timer...');
                            
                            // Clear timer lama kalau ada
                            if (queue.autoplayTimer) {
                                clearTimeout(queue.autoplayTimer);
                                queue.autoplayTimer = null;
                            }
                            
                            queue.autoplayTimer = setTimeout(async () => {
                                if (queue.songs.length === 0 && queue.autoplay) {
                                    console.log('🤖 Autoplay triggered after 60s...');
                                    await autoplayNextSong(message.guild, queue);
                                }
                            }, 60000); // 60 detik
                        }
                    }
                }
            }
        });

        queue.player.on('error', error => {
            console.error('Error:', error);
            message.channel.send('❌ Terjadi error saat memutar lagu!');
            queue.songs.shift();
            if (queue.songs.length > 0) {
                playSong(message.guild, queue.songs[0]);
            }
        });
    }

    queue.songs.push(song);
    
    // Broadcast ke dashboard
    broadcast.broadcastQueueUpdate(message.guild.id);
    
    // Track user-added songs (bukan autoplay) untuk analisa pattern
    if (!song.isAutoplay) {
        queue.userAddedSongs.push(song);
        if (queue.userAddedSongs.length > 10) {
            queue.userAddedSongs.shift(); // Keep last 10 only
        }
        
        // Hitung platform preference berdasarkan usage
        // Butuh minimal 5 lagu untuk set preference yang stabil
        if (queue.userAddedSongs.length >= 5) {
            const platformCounts = {};
            queue.userAddedSongs.forEach(s => {
                platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
            });
            
            // Set preferred platform hanya jika salah satu platform >60% usage
            const platforms = Object.keys(platformCounts);
            if (platforms.length > 0) {
                const dominant = platforms.reduce((a, b) => 
                    platformCounts[a] > platformCounts[b] ? a : b
                );
                const percentage = (platformCounts[dominant] / queue.userAddedSongs.length) * 100;
                
                // Hanya set preference jika dominan >60%
                if (percentage >= 60) {
                    queue.preferredPlatform = dominant;
                    console.log(`📊 Platform preference: ${queue.preferredPlatform} (${platformCounts[queue.preferredPlatform]}/${queue.userAddedSongs.length} = ${percentage.toFixed(0)}%)`);
                } else {
                    // Mixed usage, default ke soundcloud
                    queue.preferredPlatform = 'soundcloud';
                    console.log(`📊 Mixed platform usage, defaulting to SoundCloud`);
                }
            }
        } else {
            // Belum cukup data, default ke soundcloud
            queue.preferredPlatform = queue.preferredPlatform || 'soundcloud';
            console.log(`📊 Not enough songs (${queue.userAddedSongs.length}/5) for preference, using: ${queue.preferredPlatform}`);
        }
        
        // Clear autoplay timer karena user add lagu baru
        if (queue.autoplayTimer) {
            clearTimeout(queue.autoplayTimer);
            queue.autoplayTimer = null;
            console.log('⏰ Autoplay timer cleared - user added new song');
        }
        
        // Reset autoplay active flag
        queue.isAutoplayActive = false;
    }
    
    // Set text channel untuk notifikasi autoplay
    if (message && message.channel) {
        queue.textChannel = message.channel;
    }

    const platformEmoji = song.platform === 'deezer' ? '🎵' : '🔊';
    const platformColor = song.platform === 'deezer' ? '#FF0092' : '#FF5500';

    if (queue.songs.length === 1) {
        playSong(message.guild, song);
        
        const embed = new EmbedBuilder()
            .setColor(platformColor)
            .setTitle(`${platformEmoji} Sedang Memutar`)
            .setDescription(`[${song.title}](${song.url})`)
            .addFields(
                { name: '⏱️ Durasi', value: song.duration, inline: true },
                { name: '👤 Diminta oleh', value: song.requester, inline: true },
                { name: '📱 Platform', value: song.platform === 'deezer' ? 'Deezer' : 'SoundCloud', inline: true }
            )
            .setThumbnail(song.thumbnail);
        
        message.channel.send({ embeds: [embed] });
        
        // Broadcast to dashboard
        broadcast.broadcastQueueUpdate(message.guild.id);
    } else {
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('➕ Ditambahkan ke Queue')
            .setDescription(`[${song.title}](${song.url})`)
            .addFields(
                { name: '⏱️ Durasi', value: song.duration, inline: true },
                { name: '📝 Posisi', value: `#${queue.songs.length}`, inline: true },
                { name: '📱 Platform', value: song.platform === 'deezer' ? 'Deezer' : 'SoundCloud', inline: true }
            )
            .setThumbnail(song.thumbnail);
        
        message.channel.send({ embeds: [embed] });
        
        // Broadcast to dashboard
        broadcast.broadcastQueueUpdate(message.guild.id);
    }
}

// Event ketika bot siap
client.once('clientReady', async () => {
    console.log(`✅ Bot ${client.user.tag} sudah online!`);
    client.user.setActivity('🎵 coco help untuk perintah', { type: 'LISTENING' });
    
    // Setup play-dl setelah bot siap
    await setupPlayDL();
});

// Event ketika bot di-kick atau disconnect dari voice channel
client.on('voiceStateUpdate', (oldState, newState) => {
    // Cek jika bot sendiri yang disconnect/dikick
    if (oldState.member.id === client.user.id && oldState.channelId && !newState.channelId) {
        const queue = queues.get(oldState.guild.id);
        
        if (queue) {
            // Cleanup queue dan stop player
            console.log(`Bot dikick dari voice channel di guild: ${oldState.guild.name}`);
            
            // Stop player jika ada
            if (queue.player) {
                try {
                    queue.player.stop();
                } catch (error) {
                    // Ignore error jika player sudah stopped
                }
            }
            
            // Destroy connection hanya jika belum destroyed
            if (queue.connection && queue.connection.state.status !== 'destroyed') {
                try {
                    queue.connection.destroy();
                } catch (error) {
                    // Ignore error jika connection sudah destroyed
                }
            }
            
            // Hapus queue dari map
            queues.delete(oldState.guild.id);
            
            // Kirim notifikasi ke text channel jika memungkinkan
            const textChannel = oldState.guild.channels.cache.find(
                channel => channel.type === 0 && channel.permissionsFor(client.user).has('SendMessages')
            );
            
            if (textChannel) {
                textChannel.send('👋 Bot di-disconnect dari voice channel. Gunakan `coco join` untuk memanggil bot kembali!');
            }
        }
    }
});

// Event ketika menerima pesan
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.toLowerCase().startsWith('coco ')) return;

    const args = message.content.slice(5).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Command: coco join
    if (command === 'join' || command === 'summon') {
        if (!message.member.voice.channel) {
            return message.reply('❌ Kamu harus masuk ke voice channel terlebih dahulu!');
        }

        // Cek apakah bot sudah di voice channel
        const existingQueue = queues.get(message.guild.id);
        if (existingQueue && existingQueue.connection) {
            return message.reply('✅ Bot sudah ada di voice channel! Gunakan `coco play` untuk memutar musik.');
        }

        try {
            // Join voice channel tanpa queue
            const connection = joinVoiceChannel({
                channelId: message.member.voice.channel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            const embed = new EmbedBuilder()
                .setColor('#1DB954')
                .setTitle('✅ Joined Voice Channel')
                .setDescription(`Bot bergabung ke **${message.member.voice.channel.name}**`)
                .addFields(
                    { name: '🎵 Siap Memutar!', value: 'Gunakan `coco play <lagu>` untuk mulai memutar musik', inline: false }
                )
                .setFooter({ text: 'coco help untuk perintah lengkap' });

            message.channel.send({ embeds: [embed] });

            // Auto-disconnect setelah 5 menit jika tidak ada aktivitas
            setTimeout(() => {
                const queue = queues.get(message.guild.id);
                if (!queue || !queue.isPlaying) {
                    if (connection.state.status !== 'destroyed') {
                        connection.destroy();
                        message.channel.send('👋 Bot keluar dari voice channel karena tidak ada aktivitas.');
                    }
                }
            }, 5 * 60 * 1000); // 5 menit

        } catch (error) {
            console.error(error);
            message.reply('❌ Terjadi error saat join voice channel!');
        }
    }

    // Command: !play <url atau query>
    if (command === 'play' || command === 'p') {
        if (!message.member.voice.channel) {
            return message.reply('❌ Kamu harus masuk ke voice channel terlebih dahulu!');
        }

        if (!args.length) {
            return message.reply('❌ Gunakan: `coco play <query pencarian>`\nContoh: `coco play sorry justin bieber`');
        }

        const query = args.join(' ');
        
        try {
            // Cek apakah input adalah URL SoundCloud langsung
            if (query.includes('soundcloud.com')) {
                // Direct SoundCloud URL - langsung play
                message.channel.send('🔍 Mengambil lagu dari SoundCloud...');
                
                const scValidate = await play.so_validate(query);
                if (scValidate === false) {
                    return message.reply('❌ URL SoundCloud tidak valid!');
                }
                const songInfo = await play.soundcloud(query);
                
                const song = {
                    title: songInfo.name || songInfo.title,
                    url: songInfo.url,
                    duration: formatDuration(songInfo.durationInSec),
                    thumbnail: songInfo.thumbnail?.url || songInfo.thumbnails?.[0]?.url || null,
                    requester: message.author.tag,
                    platform: 'soundcloud'
                };

                await addToQueueAndPlay(message, song);
                return;
            }

            // Jika bukan URL, tampilkan opsi platform dan list lagu
            const searchMsg = await message.channel.send('🔍 Mencari lagu di SoundCloud dan Deezer...');

            // Search di kedua platform secara paralel
            const [soundcloudResults, deezerResults] = await Promise.all([
                play.search(query, { source: { soundcloud: 'tracks' }, limit: 10 }).catch(() => []),
                searchDeezer(query, 10)
            ]);

            // Format results
            const scTracks = soundcloudResults.slice(0, 10);
            const dzTracks = deezerResults.slice(0, 10);

            if (scTracks.length === 0 && dzTracks.length === 0) {
                return searchMsg.edit('❌ Tidak menemukan lagu dengan query tersebut di kedua platform!');
            }

            // Buat embed untuk pemilihan platform
            const platformEmbed = new EmbedBuilder()
                .setColor('#1DB954')
                .setTitle('🎵 Pilih Platform')
                .setDescription(`Ditemukan hasil untuk: **${query}**\n\nPilih platform untuk melihat daftar lagu:`)
                .addFields(
                    { 
                        name: '🔊 SoundCloud', 
                        value: `${scTracks.length} lagu ditemukan`, 
                        inline: true 
                    },
                    { 
                        name: '🎵 Deezer', 
                        value: `${dzTracks.length} lagu ditemukan`, 
                        inline: true 
                    }
                )
                .setFooter({ text: 'Pilih platform dalam 60 detik' });

            // Buat select menu untuk platform
            const platformRow = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('platform_select')
                        .setPlaceholder('Pilih platform...')
                        .addOptions([
                            {
                                label: 'SoundCloud',
                                description: `${scTracks.length} hasil ditemukan`,
                                value: 'soundcloud',
                                emoji: '🔊'
                            },
                            {
                                label: 'Deezer',
                                description: `${dzTracks.length} hasil ditemukan`,
                                value: 'deezer',
                                emoji: '🎵'
                            }
                        ])
                );

            await searchMsg.edit({ content: '', embeds: [platformEmbed], components: [platformRow] });

            // Collector untuk pemilihan platform
            const platformCollector = searchMsg.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000,
                filter: (i) => i.user.id === message.author.id
            });

            platformCollector.on('collect', async (interaction) => {
                // Respond immediately to prevent timeout - HARUS DI BARIS PERTAMA!
                await interaction.deferUpdate().catch(err => {
                    console.error('Failed to defer platform interaction:', err);
                });

                try {
                    const selectedPlatform = interaction.values[0];

                    // Pilih tracks berdasarkan platform
                const tracks = selectedPlatform === 'soundcloud' ? scTracks : dzTracks;

                // Buat embed untuk list lagu
                const songListEmbed = new EmbedBuilder()
                    .setColor(selectedPlatform === 'soundcloud' ? '#FF5500' : '#FF0092')
                    .setTitle(`🎵 Hasil Pencarian - ${selectedPlatform === 'soundcloud' ? 'SoundCloud' : 'Deezer'}`)
                    .setDescription(`Pilih lagu untuk **${query}**:\n\n${tracks.map((track, index) => {
                        if (selectedPlatform === 'soundcloud') {
                            const duration = formatDuration(track.durationInSec);
                            return `**${index + 1}.** ${track.name || track.title}\n⏱️ ${duration}`;
                        } else {
                            const duration = formatDuration(track.duration);
                            const artist = track.artist?.name || 'Unknown';
                            return `**${index + 1}.** ${track.title} - ${artist}\n⏱️ ${duration}`;
                        }
                    }).join('\n\n')}`)
                    .setFooter({ text: 'Pilih lagu dalam 60 detik' });

                // Buat select menu untuk lagu
                const songRow = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('song_select')
                            .setPlaceholder('Pilih lagu...')
                            .addOptions(
                                tracks.map((track, index) => {
                                    if (selectedPlatform === 'soundcloud') {
                                        return {
                                            label: `${index + 1}. ${truncateString(track.name || track.title, 80)}`,
                                            description: `⏱️ ${formatDuration(track.durationInSec)}`,
                                            value: `${selectedPlatform}_${index}`
                                        };
                                    } else {
                                        const artist = track.artist?.name || 'Unknown';
                                        return {
                                            label: `${index + 1}. ${truncateString(track.title, 60)}`,
                                            description: `${truncateString(artist, 40)} - ${formatDuration(track.duration)}`,
                                            value: `${selectedPlatform}_${index}`
                                        };
                                    }
                                })
                            )
                    );

                await searchMsg.edit({ embeds: [songListEmbed], components: [songRow] });

                // Collector untuk pemilihan lagu
                const songCollector = searchMsg.createMessageComponentCollector({
                    componentType: ComponentType.StringSelect,
                    time: 60000,
                    filter: (i) => i.user.id === message.author.id
                });

                songCollector.on('collect', async (songInteraction) => {
                    // Respond immediately to prevent timeout - HARUS DI BARIS PERTAMA!
                    await songInteraction.deferUpdate().catch(err => {
                        console.error('Failed to defer song interaction:', err);
                    });

                    try {
                        const [platform, indexStr] = songInteraction.values[0].split('_');
                        const index = parseInt(indexStr);

                        let song;

                        if (platform === 'soundcloud') {
                            const track = scTracks[index];
                            song = {
                                title: track.name || track.title,
                                url: track.url,
                                duration: formatDuration(track.durationInSec),
                                thumbnail: track.thumbnail?.url || track.thumbnails?.[0]?.url || null,
                                requester: message.author.tag,
                                platform: 'soundcloud'
                            };
                        } else {
                            const track = dzTracks[index];
                            const artist = track.artist?.name || 'Unknown';
                            
                            // Untuk Deezer, kita perlu search di SoundCloud dengan judul + artis
                            const scQuery = `${track.title} ${artist}`;
                            const scResults = await play.search(scQuery, { 
                                source: { soundcloud: 'tracks' }, 
                                limit: 1 
                            });

                            if (!scResults || scResults.length === 0) {
                                await searchMsg.edit({ 
                                    content: '❌ Tidak menemukan lagu ini di SoundCloud untuk diputar. Coba lagu lain!', 
                                    embeds: [], 
                                    components: [] 
                                });
                                return;
                            }

                            const scTrack = scResults[0];
                            song = {
                                title: `${track.title} - ${artist}`,
                                url: scTrack.url,
                                duration: formatDuration(scTrack.durationInSec),
                                thumbnail: track.album?.cover_medium || scTrack.thumbnail?.url || null,
                                requester: message.author.tag,
                                platform: 'deezer'
                            };
                        }

                        await searchMsg.edit({ 
                            content: '✅ Lagu dipilih! Menambahkan ke queue...', 
                            embeds: [], 
                            components: [] 
                        });

                        await addToQueueAndPlay(message, song);

                    } catch (error) {
                        console.error('Error processing song:', error);
                        await searchMsg.edit({ 
                            content: '❌ Terjadi error saat memproses lagu!', 
                            embeds: [], 
                            components: [] 
                        });
                    }

                    songCollector.stop();
                });

                songCollector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        searchMsg.edit({ 
                            content: '⏱️ Waktu habis! Gunakan `coco play` lagi untuk mencari.', 
                            embeds: [], 
                            components: [] 
                        }).catch(() => {});
                    }
                });
                
                } catch (error) {
                    console.error('Platform selection error:', error);
                    await searchMsg.edit({ 
                        content: '❌ Terjadi error saat memproses platform!', 
                        embeds: [], 
                        components: [] 
                    }).catch(() => {});
                }

                platformCollector.stop();
            });

            platformCollector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    searchMsg.edit({ 
                        content: '⏱️ Waktu habis! Gunakan `coco play` lagi untuk mencari.', 
                        embeds: [], 
                        components: [] 
                    }).catch(() => {});
                }
            });

        } catch (error) {
            console.error(error);
            const errorMsg = error.message || 'Unknown error';
            message.reply('❌ Terjadi error saat mencari lagu! Coba lagi.');
        }
    }

    // Command: coco skip
    if (command === 'skip' || command === 's') {
        const queue = queues.get(message.guild.id);
        if (!queue || !queue.isPlaying) {
            return message.reply('❌ Tidak ada lagu yang sedang diputar!');
        }

        const wasRepeatingSong = queue.repeatMode === 'song';
        if (wasRepeatingSong) {
            queue.repeatMode = 'off';
        }

        queue.player.stop();
        
        const nextSong = queue.songs[1];
        const skipMsg = nextSong ? `⏭️ Melewati lagu... Next: **${nextSong.title}**` : '⏭️ Melewati lagu...';
        message.channel.send(skipMsg);
    }

    // Command: coco pause
    if (command === 'pause') {
        const queue = queues.get(message.guild.id);
        if (!queue || !queue.isPlaying) {
            return message.reply('❌ Tidak ada lagu yang sedang diputar!');
        }

        if (queue.isPaused) {
            return message.reply('⏸️ Lagu sudah di-pause!');
        }

        queue.player.pause();
        queue.isPaused = true;
        
        // Broadcast ke dashboard
        broadcast.broadcastQueueUpdate(message.guild.id);
        
        message.channel.send('⏸️ Lagu di-pause. Gunakan `coco resume` untuk melanjutkan.');
    }

    // Command: coco resume
    if (command === 'resume' || command === 'continue') {
        const queue = queues.get(message.guild.id);
        if (!queue || !queue.isPlaying) {
            return message.reply('❌ Tidak ada lagu yang sedang diputar!');
        }

        if (!queue.isPaused) {
            return message.reply('▶️ Lagu sudah sedang diputar!');
        }

        queue.player.unpause();
        queue.isPaused = false;
        
        // Broadcast ke dashboard
        broadcast.broadcastQueueUpdate(message.guild.id);
        
        message.channel.send('▶️ Lagu dilanjutkan!');
    }

    // Command: coco repeat/loop
    if (command === 'repeat' || command === 'loop') {
        const queue = queues.get(message.guild.id);
        if (!queue || queue.songs.length === 0) {
            return message.reply('❌ Tidak ada lagu di queue!');
        }

        // Simple toggle: off → queue → off
        queue.repeatMode = queue.repeatMode === 'off' ? 'queue' : 'off';

        const emoji = queue.repeatMode === 'off' ? '➡️' : '🔁';
        const status = queue.repeatMode === 'off' ? 'Dimatikan' : 'Repeat Queue ON';

        message.channel.send(`${emoji} **Repeat ${status}**`);
    }

    // Command: coco clear
    if (command === 'clear' || command === 'clearqueue') {
        const queue = queues.get(message.guild.id);
        if (!queue || queue.songs.length <= 1) {
            return message.reply('❌ Tidak ada lagu di queue untuk dihapus!');
        }

        const clearedCount = queue.songs.length - 1;
        queue.songs = [queue.songs[0]];
        queue.originalQueue = [];
        queue.isShuffled = false;

        message.channel.send(`🗑️ Berhasil menghapus **${clearedCount}** lagu dari queue!`);
    }

    // Commands dihapus: remove, move, skipto - jarang dipakai, terlalu kompleks

    // Command: coco stop
    if (command === 'stop') {
        const queue = queues.get(message.guild.id);
        if (!queue) {
            return message.reply('❌ Tidak ada lagu yang sedang diputar!');
        }

        queue.songs = [];
        queue.player.stop();
        queue.connection.destroy();
        queues.delete(message.guild.id);
        message.channel.send('⏹️ Berhenti memutar musik dan keluar dari voice channel!');
    }

    // Command: coco queue
    if (command === 'queue' || command === 'q') {
        const queue = queues.get(message.guild.id);
        if (!queue || queue.songs.length === 0) {
            return message.reply('❌ Queue kosong!');
        }

        const repeatIcon = queue.repeatMode === 'queue' ? '🔁' : '➡️';
        const shuffleIcon = queue.isShuffled ? '🔀' : '';
        const statusIcon = queue.isPaused ? '⏸️' : '▶️';
        
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle(`${statusIcon} Queue - ${queue.songs.length} Lagu`)
            .setDescription(
                queue.songs
                    .slice(0, 10)
                    .map((song, index) => {
                        const playing = index === 0 ? '🎵 ' : '';
                        return `${playing}**${index + 1}.** ${song.title} \`${song.duration}\``;
                    })
                    .join('\n')
            )
            .setFooter({ text: `${repeatIcon} ${shuffleIcon} | ${queue.songs.length > 10 ? `+${queue.songs.length - 10} lagu lagi` : ''}`.trim() });

        message.channel.send({ embeds: [embed] });
    }

    // Command: coco nowplaying atau coco np
    if (command === 'nowplaying' || command === 'np') {
        const queue = queues.get(message.guild.id);
        if (!queue || !queue.isPlaying || queue.songs.length === 0) {
            return message.reply('❌ Tidak ada lagu yang sedang diputar!');
        }

        const song = queue.songs[0];
        const statusIcon = queue.isPaused ? '⏸️' : '🎵';
        const repeatIcon = queue.repeatMode === 'queue' ? ' 🔁' : '';
        const shuffleIcon = queue.isShuffled ? ' 🔀' : '';
        
        const embed = new EmbedBuilder()
            .setColor(queue.isPaused ? '#FFA500' : '#1DB954')
            .setTitle(`${statusIcon} Sedang Diputar`)
            .setDescription(`**${song.title}**\n⏱️ ${song.duration} • 👤 ${song.requester}`)
            .setThumbnail(song.thumbnail)
            .setFooter({ text: `${queue.songs.length - 1} lagu berikutnya${repeatIcon}${shuffleIcon}` });

        message.channel.send({ embeds: [embed] });
    }

    // Command: coco help
    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle('🎵 coco Music Bot - Perintah')
            .setDescription('Bot musik SoundCloud & Deezer yang simple dan mudah!')
            .addFields(
                {
                    name: '🎵 Pemutaran Musik',
                    value: '```\ncoco play <lagu>     → Cari & putar lagu\ncoco pause           → Jeda\ncoco resume          → Lanjutkan\ncoco skip            → Lewati lagu\ncoco stop            → Stop & keluar```',
                    inline: false
                },
                {
                    name: '📋 Queue & Info',
                    value: '```\ncoco queue           → Lihat daftar lagu\ncoco nowplaying      → Info lagu saat ini\ncoco clear           → Hapus semua queue```',
                    inline: false
                },
                {
                    name: '🔊 Audio',
                    value: '```\ncoco volume <0-100>  → Atur volume\ncoco shuffle         → Acak queue\ncoco repeat          → Loop lagu/queue```',
                    inline: false
                }
            )
            .addFields({
                name: '💡 Cara Pakai',
                value: 'Ketik: `coco play sorry justin bieber`\nPilih platform (SoundCloud/Deezer) → Pilih lagu → Done!',
                inline: false
            })
            .setFooter({ text: 'Powered by SoundCloud & Deezer' });

        return message.channel.send({ embeds: [embed] });
    }

    // Command quality dihapus - auto set ke HIGH, user tidak perlu repot

    // Command: coco shuffle
    if (command === 'shuffle' || command === 'mix') {
        const queue = queues.get(message.guild.id);
        if (!queue || queue.songs.length <= 2) {
            return message.reply('❌ Minimal harus ada 3 lagu di queue untuk shuffle!');
        }

        // Simpan queue asli jika belum pernah di-shuffle
        if (!queue.isShuffled) {
            queue.originalQueue = [...queue.songs];
        }

        // Pisahkan lagu yang sedang diputar (index 0) dan sisa queue
        const currentSong = queue.songs[0];
        const remainingSongs = queue.songs.slice(1);

        // Shuffle pintar menggunakan algoritma Fisher-Yates dengan penyesuaian
        const shuffled = smartShuffle(remainingSongs, queue.playHistory);

        // Gabungkan lagu yang sedang diputar dengan queue yang sudah di-shuffle
        queue.songs = [currentSong, ...shuffled];
        queue.isShuffled = true;

        message.channel.send(`🔀 **Queue diacak!** ${remainingSongs.length} lagu`);
    }

    // Command: coco unshuffle
    if (command === 'unshuffle' || command === 'unmix') {
        const queue = queues.get(message.guild.id);
        if (!queue || !queue.isShuffled) {
            return message.reply('❌ Queue tidak dalam mode shuffle!');
        }

        // Kembalikan ke queue asli, tapi keep lagu yang sedang diputar
        const currentSong = queue.songs[0];
        const currentIndex = queue.originalQueue.findIndex(s => s.url === currentSong.url);
        
        if (currentIndex !== -1) {
            // Kembalikan dari posisi lagu saat ini
            queue.songs = queue.originalQueue.slice(currentIndex);
        } else {
            // Jika tidak ditemukan, kembalikan seluruh queue asli
            queue.songs = [...queue.originalQueue];
        }

        queue.isShuffled = false;
        message.channel.send('↩️ **Urutan asli dikembalikan**');
    }

    // Command: coco volume
    if (command === 'volume' || command === 'vol' || command === 'v') {
        const queue = queues.get(message.guild.id);
        
        if (!args.length) {
            const settings = serverSettings.get(message.guild.id) || new ServerSettings();
            return message.reply(`🔊 Volume saat ini: **${settings.volume}%**\n\nGunakan: \`coco volume <0-100>\``);
        }

        const volume = parseInt(args[0]);
        
        if (isNaN(volume) || volume < 0 || volume > 100) {
            return message.reply('❌ Volume harus berupa angka antara 0-100!');
        }

        let settings = serverSettings.get(message.guild.id);
        if (!settings) {
            settings = new ServerSettings();
            serverSettings.set(message.guild.id, settings);
        }

        settings.volume = volume;

        // Jika ada lagu yang sedang diputar, update volume secara real-time
        if (queue && queue.player && queue.isPlaying) {
            // Note: Volume akan berlaku untuk lagu berikutnya karena audio resource sudah dibuat
            message.channel.send('💡 Volume akan berlaku untuk lagu berikutnya. Gunakan `coco skip` untuk menerapkan sekarang.');
        }

        const volumeEmoji = volume === 0 ? '🔇' : volume < 30 ? '🔉' : volume < 70 ? '🔊' : '🔊✨';
        message.channel.send(`${volumeEmoji} Volume: **${volume}%**`);
    }
});

// Fungsi untuk memutar lagu
async function playSong(guild, song) {
    const queue = queues.get(guild.id);
    if (!queue) return;

    try {
        // Dapatkan settings - ALWAYS use HIGH quality (best quality available)
        const settings = serverSettings.get(guild.id) || new ServerSettings();
        
        // Set kualitas MAKSIMAL - play-dl quality 2 = highest available
        // SoundCloud: ~256 kbps (highest available)
        // Jika ada lossless, play-dl otomatis pilih yang terbaik
        const stream = await play.stream(song.url, {
            quality: 2  // Always use highest quality (2 = best available, including lossless if exists)
        });
        
        // Hitung volume dalam skala logaritmik untuk hasil yang lebih natural
        // Volume 0-100% dikonversi ke 0.0-1.0 dengan kurva logaritmik
        const volumeLevel = settings.volume === 0 ? 0 : Math.pow(settings.volume / 100, 1.5);
        
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true
        });

        // Set volume pada resource
        if (resource.volume) {
            resource.volume.setVolume(volumeLevel);
        }

        queue.player.play(resource);
        queue.isPlaying = true;
        
        // Broadcast ke dashboard
        broadcast.broadcastQueueUpdate(guild.id);

    } catch (error) {
        console.error(error);
        queue.songs.shift();
        if (queue.songs.length > 0) {
            playSong(guild, queue.songs[0]);
        }
    }
}

// Algoritma shuffle pintar seperti Spotify
function smartShuffle(songs, playHistory = []) {
    if (songs.length <= 1) return songs;

    // Clone array untuk tidak memodifikasi original
    const shuffled = [];
    const remaining = [...songs];
    
    // Fisher-Yates shuffle dengan penyesuaian pintar
    while (remaining.length > 0) {
        let selectedIndex = -1;
        let attempts = 0;
        const maxAttempts = 50;

        // Coba cari lagu yang cocok dengan kriteria
        while (attempts < maxAttempts && selectedIndex === -1) {
            const randomIndex = Math.floor(Math.random() * remaining.length);
            const candidate = remaining[randomIndex];
            
            // Kriteria 1: Jangan pilih lagu yang baru saja diputar (dari history)
            const isInRecentHistory = playHistory.slice(-3).some(h => h.url === candidate.url);
            
            // Kriteria 2: Jika ada lagu sebelumnya di shuffled, coba hindari artis yang sama berurutan
            let isDifferentFromLast = true;
            if (shuffled.length > 0) {
                const lastSong = shuffled[shuffled.length - 1];
                // Extract artist dari title (biasanya format "Artist - Song")
                const lastArtist = lastSong.title.split('-')[0].trim().toLowerCase();
                const candidateArtist = candidate.title.split('-')[0].trim().toLowerCase();
                
                // Jika masih banyak pilihan, hindari artis yang sama
                if (remaining.length > 3) {
                    isDifferentFromLast = lastArtist !== candidateArtist;
                }
            }

            // Terima kandidat jika memenuhi kriteria atau sudah terlalu banyak attempts
            if ((!isInRecentHistory && isDifferentFromLast) || attempts > maxAttempts - 10) {
                selectedIndex = randomIndex;
            }

            attempts++;
        }

        // Jika tidak menemukan kandidat ideal, ambil random
        if (selectedIndex === -1) {
            selectedIndex = Math.floor(Math.random() * remaining.length);
        }

        // Pindahkan lagu terpilih ke shuffled array
        shuffled.push(remaining[selectedIndex]);
        remaining.splice(selectedIndex, 1);
    }

    return shuffled;
}

// Format durasi
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Login bot
client.login(process.env.DISCORD_TOKEN);


