require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const play = require('play-dl');
const prism = require('prism-media');

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

// Queue untuk menyimpan lagu
const queues = new Map();

// Settings untuk setiap server
const serverSettings = new Map();

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
        this.autoplay = false; // Autoplay lagu similar
    }
}

// Struktur settings untuk setiap server
class ServerSettings {
    constructor() {
        this.quality = 'high'; // default: high, options: low, medium, high
        this.volume = 100; // default: 100%, range: 0-100
    }
}

// Event ketika bot siap
client.once('clientReady', async () => {
    console.log(`✅ Bot ${client.user.tag} sudah online!`);
    client.user.setActivity('🎵 joshua help untuk perintah', { type: 'LISTENING' });
    
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
            
            if (queue.player) {
                queue.player.stop();
            }
            
            if (queue.connection) {
                queue.connection.destroy();
            }
            
            queues.delete(oldState.guild.id);
            
            // Kirim notifikasi ke text channel jika memungkinkan
            const textChannel = oldState.guild.channels.cache.find(
                channel => channel.type === 0 && channel.permissionsFor(client.user).has('SendMessages')
            );
            
            if (textChannel) {
                textChannel.send('👋 Bot di-disconnect dari voice channel. Gunakan `joshua join` untuk memanggil bot kembali!');
            }
        }
    }
});

// Event ketika menerima pesan
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.toLowerCase().startsWith('joshua ')) return;

    const args = message.content.slice(7).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Command: joshua join
    if (command === 'join' || command === 'summon') {
        if (!message.member.voice.channel) {
            return message.reply('❌ Kamu harus masuk ke voice channel terlebih dahulu!');
        }

        // Cek apakah bot sudah di voice channel
        const existingQueue = queues.get(message.guild.id);
        if (existingQueue && existingQueue.connection) {
            return message.reply('✅ Bot sudah ada di voice channel! Gunakan `joshua play` untuk memutar musik.');
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
                    { name: '🎵 Siap Memutar!', value: 'Gunakan `joshua play <lagu>` untuk mulai memutar musik', inline: false }
                )
                .setFooter({ text: 'joshua help untuk perintah lengkap' });

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
            return message.reply('❌ Gunakan: `joshua play <url SoundCloud atau query pencarian>`');
        }

        const query = args.join(' ');
        
        try {
            message.channel.send('🔍 Mencari lagu...');
            
            // Cek apakah input adalah URL SoundCloud
            let songInfo;
            if (query.includes('soundcloud.com')) {
                // Validasi URL SoundCloud
                const scValidate = await play.so_validate(query);
                if (scValidate === false) {
                    return message.reply('❌ URL SoundCloud tidak valid!');
                }
                songInfo = await play.soundcloud(query);
            } else {
                // Jika bukan URL, search di SoundCloud
                const searched = await play.search(query, { 
                    source: { soundcloud: 'tracks' }, 
                    limit: 1 
                });
                
                if (!searched || searched.length === 0) {
                    return message.reply('❌ Tidak menemukan lagu dengan query tersebut!');
                }
                songInfo = searched[0];
            }

            const song = {
                title: songInfo.name || songInfo.title,
                url: songInfo.url,
                duration: formatDuration(songInfo.durationInSec),
                thumbnail: songInfo.thumbnail?.url || songInfo.thumbnails?.[0]?.url || null,
                requester: message.author.tag,
            };

            let queue = queues.get(message.guild.id);
            
            if (!queue) {
                queue = new Queue();
                queues.set(message.guild.id, queue);

                queue.connection = joinVoiceChannel({
                    channelId: message.member.voice.channel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                queue.player = createAudioPlayer();
                queue.connection.subscribe(queue.player);

                // Event ketika lagu selesai
                queue.player.on(AudioPlayerStatus.Idle, () => {
                    if (queue.songs.length === 0) {
                        queue.isPlaying = false;
                        return;
                    }

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
                        if (queue.songs.length > 0) {
                            playSong(message.guild, queue.songs[0]);
                        } else if (queue.repeatMode === 'queue' && queue.playHistory.length > 0) {
                            // Restart queue untuk repeat mode
                            queue.songs = [...queue.playHistory];
                            queue.playHistory = [];
                            playSong(message.guild, queue.songs[0]);
                        } else {
                            queue.isPlaying = false;
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

            if (queue.songs.length === 1) {
                playSong(message.guild, song);
                
                const embed = new EmbedBuilder()
                    .setColor('#FF5500')
                    .setTitle('🎵 Sedang Memutar')
                    .setDescription(`[${song.title}](${song.url})`)
                    .addFields(
                        { name: '⏱️ Durasi', value: song.duration, inline: true },
                        { name: '👤 Diminta oleh', value: song.requester, inline: true }
                    )
                    .setThumbnail(song.thumbnail);
                
                message.channel.send({ embeds: [embed] });
            } else {
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('➕ Ditambahkan ke Queue')
                    .setDescription(`[${song.title}](${song.url})`)
                    .addFields(
                        { name: '⏱️ Durasi', value: song.duration, inline: true },
                        { name: '📝 Posisi', value: `#${queue.songs.length}`, inline: true }
                    )
                    .setThumbnail(song.thumbnail);
                
                message.channel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error(error);
            const errorMsg = error.message || 'Unknown error';
            if (errorMsg.includes('client_id') || errorMsg.includes('SoundCloud')) {
                return message.reply('❌ Terjadi error dengan SoundCloud! Coba lagi dalam beberapa saat atau gunakan URL SoundCloud langsung.');
            }
            message.reply('❌ Terjadi error saat memproses lagu! Pastikan URL SoundCloud valid atau coba query pencarian yang lebih spesifik.');
        }
    }

    // Command: joshua skip
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

    // Command: joshua pause
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
        message.channel.send('⏸️ Lagu di-pause. Gunakan `joshua resume` untuk melanjutkan.');
    }

    // Command: joshua resume
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
        message.channel.send('▶️ Lagu dilanjutkan!');
    }

    // Command: joshua repeat/loop
    if (command === 'repeat' || command === 'loop') {
        const queue = queues.get(message.guild.id);
        if (!queue || queue.songs.length === 0) {
            return message.reply('❌ Tidak ada lagu di queue!');
        }

        const modes = ['off', 'song', 'queue'];
        const currentIndex = modes.indexOf(queue.repeatMode);
        const nextMode = args[0]?.toLowerCase();

        if (nextMode && modes.includes(nextMode)) {
            queue.repeatMode = nextMode;
        } else {
            queue.repeatMode = modes[(currentIndex + 1) % modes.length];
        }

        const modeEmojis = {
            off: '➡️',
            song: '🔂',
            queue: '🔁'
        };

        const modeDescriptions = {
            off: 'Loop dimatikan',
            song: 'Repeat lagu saat ini',
            queue: 'Repeat seluruh queue'
        };

        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle(`${modeEmojis[queue.repeatMode]} Mode Repeat`)
            .setDescription(modeDescriptions[queue.repeatMode])
            .addFields(
                { name: '💡 Tip', value: 'Gunakan `joshua repeat <off/song/queue>` untuk set mode tertentu', inline: false }
            );

        message.channel.send({ embeds: [embed] });
    }

    // Command: joshua clear
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

    // Command: joshua remove
    if (command === 'remove' || command === 'rm') {
        const queue = queues.get(message.guild.id);
        if (!queue || queue.songs.length <= 1) {
            return message.reply('❌ Tidak ada lagu di queue untuk dihapus!');
        }

        const position = parseInt(args[0]);
        if (!position || position < 2 || position > queue.songs.length) {
            return message.reply(`❌ Nomor tidak valid! Gunakan: \`joshua remove <2-${queue.songs.length}>\``);
        }

        const removed = queue.songs.splice(position - 1, 1)[0];
        message.channel.send(`🗑️ Dihapus: **${removed.title}**`);
    }

    // Command: joshua skipto
    if (command === 'skipto' || command === 'jumpto') {
        const queue = queues.get(message.guild.id);
        if (!queue || !queue.isPlaying) {
            return message.reply('❌ Tidak ada lagu yang sedang diputar!');
        }

        const position = parseInt(args[0]);
        if (!position || position < 1 || position > queue.songs.length) {
            return message.reply(`❌ Nomor tidak valid! Gunakan: \`joshua skipto <1-${queue.songs.length}>\``);
        }

        if (position === 1) {
            return message.reply('❌ Lagu ini sedang diputar!');
        }

        queue.songs.splice(1, position - 2);
        queue.player.stop();

        message.channel.send(`⏭️ Loncat ke: **${queue.songs[1].title}**`);
    }

    // Command: joshua move
    if (command === 'move') {
        const queue = queues.get(message.guild.id);
        if (!queue || queue.songs.length <= 1) {
            return message.reply('❌ Tidak ada lagu di queue!');
        }

        const from = parseInt(args[0]);
        const to = parseInt(args[1]);

        if (!from || !to || from < 2 || to < 2 || from > queue.songs.length || to > queue.songs.length) {
            return message.reply(`❌ Format: \`joshua move <dari> <ke>\` (2-${queue.songs.length})`);
        }

        const song = queue.songs.splice(from - 1, 1)[0];
        queue.songs.splice(to - 1, 0, song);

        message.channel.send(`✅ Dipindah: **${song.title}** dari posisi ${from} ke ${to}`);
    }

    // Command: joshua stop
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

    // Command: joshua queue
    if (command === 'queue' || command === 'q') {
        const queue = queues.get(message.guild.id);
        if (!queue || queue.songs.length === 0) {
            return message.reply('❌ Queue kosong!');
        }

        const settings = serverSettings.get(message.guild.id) || new ServerSettings();
        const shuffleIcon = queue.isShuffled ? '🔀' : '▶️';
        const repeatIcon = queue.repeatMode === 'song' ? '🔂' : queue.repeatMode === 'queue' ? '🔁' : '➡️';
        const pauseIcon = queue.isPaused ? '⏸️' : '▶️';
        
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('📋 Queue Lagu')
            .setDescription(
                queue.songs
                    .slice(0, 10)
                    .map((song, index) => {
                        const prefix = index === 0 ? `${pauseIcon} ` : '';
                        return `${prefix}**${index + 1}.** [${song.title}](${song.url}) - \`${song.duration}\``;
                    })
                    .join('\n')
            )
            .addFields(
                { name: '🎵 Status', value: `${shuffleIcon} Shuffle | ${repeatIcon} Repeat: ${queue.repeatMode}`, inline: true },
                { name: '🔊 Volume', value: `${settings.volume}%`, inline: true },
                { name: '🎶 Kualitas', value: settings.quality, inline: true }
            )
            .setFooter({ text: `Total: ${queue.songs.length} lagu` });

        message.channel.send({ embeds: [embed] });
    }

    // Command: joshua nowplaying atau joshua np
    if (command === 'nowplaying' || command === 'np') {
        const queue = queues.get(message.guild.id);
        if (!queue || !queue.isPlaying || queue.songs.length === 0) {
            return message.reply('❌ Tidak ada lagu yang sedang diputar!');
        }

        const song = queue.songs[0];
        const settings = serverSettings.get(message.guild.id) || new ServerSettings();
        const statusIcon = queue.isPaused ? '⏸️ Paused' : '▶️ Playing';
        const repeatIcon = queue.repeatMode === 'song' ? '🔂' : queue.repeatMode === 'queue' ? '🔁' : '➡️';
        
        const embed = new EmbedBuilder()
            .setColor(queue.isPaused ? '#FFA500' : '#1DB954')
            .setTitle(`🎵 ${statusIcon}`)
            .setDescription(`[${song.title}](${song.url})`)
            .addFields(
                { name: '⏱️ Durasi', value: song.duration, inline: true },
                { name: '👤 Diminta oleh', value: song.requester, inline: true },
                { name: '🔊 Volume', value: `${settings.volume}%`, inline: true },
                { name: '🔁 Repeat', value: `${repeatIcon} ${queue.repeatMode}`, inline: true },
                { name: '🔀 Shuffle', value: queue.isShuffled ? 'ON' : 'OFF', inline: true },
                { name: '💿 Kualitas', value: settings.quality.toUpperCase(), inline: true }
            )
            .setThumbnail(song.thumbnail)
            .setFooter({ text: `${queue.songs.length - 1} lagu di queue` });

        message.channel.send({ embeds: [embed] });
    }

    // Command: joshua help
    if (command === 'help') {
        const prefix = 'joshua';
        
        // Help dengan kategori
        if (!args.length) {
            const embed = new EmbedBuilder()
                .setColor('#1DB954')
                .setTitle('🎵 Joshua Music Bot - Help Menu')
                .setDescription('Bot musik SoundCloud dengan fitur lengkap seperti Spotify & Apple Music\n\n**Kategori Perintah:**')
                .addFields(
                    { 
                        name: '▶️ Playback', 
                        value: '`joshua help playback`\nKontrol pemutaran musik', 
                        inline: true 
                    },
                    { 
                        name: '📋 Queue', 
                        value: '`joshua help queue`\nManajemen antrian lagu', 
                        inline: true 
                    },
                    { 
                        name: '🔁 Loop & Mix', 
                        value: '`joshua help loop`\nRepeat dan shuffle', 
                        inline: true 
                    },
                    { 
                        name: '🎚️ Audio', 
                        value: '`joshua help audio`\nVolume & kualitas', 
                        inline: true 
                    },
                    { 
                        name: 'ℹ️ Info', 
                        value: '`joshua help info`\nInformasi lagu', 
                        inline: true 
                    },
                    { 
                        name: '📝 Tips', 
                        value: '`joshua help tips`\nTips & trik', 
                        inline: true 
                    }
                )
                .addFields({
                    name: '\n💡 Quick Start',
                    value: '```\njoshua play <lagu>     # Putar lagu\njoshua pause           # Jeda\njoshua resume          # Lanjut\njoshua skip            # Lewati\njoshua queue           # Lihat antrian\njoshua help playback   # Lihat detail kategori```',
                    inline: false
                })
                .setFooter({ text: '💚 Powered by SoundCloud | Prefix: joshua' })
                .setTimestamp();

            return message.channel.send({ embeds: [embed] });
        }

        // Help categories
        const category = args[0].toLowerCase();

        if (category === 'playback' || category === 'play') {
            const embed = new EmbedBuilder()
                .setColor('#1DB954')
                .setTitle('▶️ Playback Control')
                .setDescription('Kontrol pemutaran musik dengan lengkap')
                .addFields(
                    {
                        name: '`joshua join`',
                        value: '**Alias:** `summon`\nPanggil bot ke voice channel kamu\n**Contoh:**\n```\njoshua join\njoshua summon```\n**Auto-disconnect:** 5 menit jika tidak ada aktivitas',
                        inline: false
                    },
                    {
                        name: '`joshua play <url/query>`',
                        value: '**Alias:** `p`\nPutar lagu dari URL SoundCloud atau pencarian\n**Contoh:**\n```\njoshua play https://soundcloud.com/...\njoshua play alan walker faded\njoshua p lofi hip hop```',
                        inline: false
                    },
                    {
                        name: '`joshua pause`',
                        value: 'Jeda lagu yang sedang diputar\n**Status:** Lagu tetap di posisi yang sama',
                        inline: false
                    },
                    {
                        name: '`joshua resume`',
                        value: '**Alias:** `continue`\nLanjutkan lagu yang di-pause\n**Contoh:** `joshua resume`',
                        inline: false
                    },
                    {
                        name: '`joshua skip`',
                        value: '**Alias:** `s`\nLewati lagu saat ini dan putar lagu berikutnya\n**Info:** Menampilkan preview lagu berikutnya',
                        inline: false
                    },
                    {
                        name: '`joshua stop`',
                        value: 'Berhenti memutar, hapus queue, dan keluar dari voice channel\n**Warning:** Akan menghapus semua lagu!',
                        inline: false
                    }
                )
                .setFooter({ text: 'joshua help <kategori> untuk info lainnya' });

            return message.channel.send({ embeds: [embed] });
        }

        if (category === 'queue' || category === 'q') {
            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('📋 Queue Management')
                .setDescription('Kelola antrian lagu dengan mudah')
                .addFields(
                    {
                        name: '`joshua queue`',
                        value: '**Alias:** `q`\nTampilkan daftar lagu di antrian (max 10)\n**Info:** Menampilkan status shuffle, repeat, volume, dll',
                        inline: false
                    },
                    {
                        name: '`joshua clear`',
                        value: '**Alias:** `clearqueue`\nHapus semua lagu dari queue (kecuali yang sedang play)\n**Contoh:** `joshua clear`',
                        inline: false
                    },
                    {
                        name: '`joshua remove <nomor>`',
                        value: '**Alias:** `rm`\nHapus lagu tertentu dari queue\n**Contoh:**\n```\njoshua remove 3\njoshua rm 5```',
                        inline: false
                    },
                    {
                        name: '`joshua move <dari> <ke>`',
                        value: 'Pindahkan posisi lagu dalam queue\n**Contoh:**\n```\njoshua move 5 2    # Pindah lagu #5 ke posisi #2\njoshua move 3 1    # Pindah lagu #3 jadi next```',
                        inline: false
                    },
                    {
                        name: '`joshua skipto <nomor>`',
                        value: '**Alias:** `jumpto`\nLoncat langsung ke lagu tertentu\n**Contoh:**\n```\njoshua skipto 4    # Loncat ke lagu #4\njoshua jumpto 7```',
                        inline: false
                    }
                )
                .setFooter({ text: 'Nomor dimulai dari 1 (lagu yang sedang play)' });

            return message.channel.send({ embeds: [embed] });
        }

        if (category === 'loop' || category === 'repeat' || category === 'shuffle' || category === 'mix') {
            const embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle('🔁 Loop & Shuffle')
                .setDescription('Repeat dan shuffle seperti Spotify')
                .addFields(
                    {
                        name: '`joshua repeat [mode]`',
                        value: '**Alias:** `loop`\n**Mode:** `off`, `song`, `queue`\n\n**➡️ Off** - Normal playback\n**🔂 Song** - Ulang lagu saat ini terus\n**🔁 Queue** - Ulang seluruh antrian\n\n**Contoh:**\n```\njoshua repeat          # Toggle mode\njoshua repeat song     # Set repeat song\njoshua repeat queue    # Set repeat queue\njoshua repeat off      # Matikan```',
                        inline: false
                    },
                    {
                        name: '`joshua shuffle`',
                        value: '**Alias:** `mix`\nAcak queue dengan algoritma pintar seperti Spotify\n\n**Fitur Smart Shuffle:**\n• Hindari artis sama berurutan\n• Cegah lagu baru diputar muncul lagi\n• Distribusi merata & natural\n\n**Minimal:** 3 lagu di queue',
                        inline: false
                    },
                    {
                        name: '`joshua unshuffle`',
                        value: '**Alias:** `unmix`\nKembalikan queue ke urutan asli\n**Contoh:** `joshua unshuffle`',
                        inline: false
                    }
                )
                .setFooter({ text: 'Kombinasi shuffle + repeat untuk pengalaman terbaik!' });

            return message.channel.send({ embeds: [embed] });
        }

        if (category === 'audio' || category === 'volume' || category === 'quality') {
            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('🎚️ Audio Settings')
                .setDescription('Kontrol volume dan kualitas audio')
                .addFields(
                    {
                        name: '`joshua volume <0-100>`',
                        value: '**Alias:** `vol`, `v`\nAtur volume global (0-100%)\n\n**Contoh:**\n```\njoshua volume 50     # Set 50%\njoshua vol 100       # Set maksimum\njoshua v 25          # Set 25%\njoshua volume        # Cek volume saat ini```\n\n**Visual:** Menampilkan bar volume yang cantik',
                        inline: false
                    },
                    {
                        name: '`joshua quality <mode>`',
                        value: '**Mode:** `low`, `medium`, `high`\n\n**🔉 Low** - 64 kbps (Hemat bandwidth)\n**🔊 Medium** - 128 kbps (Seimbang)\n**🔊✨ High** - 256 kbps (Kualitas terbaik)\n\n**Contoh:**\n```\njoshua quality high\njoshua quality medium\njoshua quality        # Cek saat ini```\n\n**Default:** High',
                        inline: false
                    }
                )
                .setFooter({ text: 'Pengaturan berlaku untuk lagu berikutnya' });

            return message.channel.send({ embeds: [embed] });
        }

        if (category === 'info' || category === 'information') {
            const embed = new EmbedBuilder()
                .setColor('#F39C12')
                .setTitle('ℹ️ Informasi Lagu')
                .setDescription('Lihat info lengkap tentang lagu & queue')
                .addFields(
                    {
                        name: '`joshua nowplaying`',
                        value: '**Alias:** `np`\nTampilkan info lengkap lagu yang sedang diputar\n\n**Menampilkan:**\n• Judul & thumbnail\n• Durasi lagu\n• Who requested\n• Status (Playing/Paused)\n• Repeat mode\n• Shuffle status\n• Volume & kualitas\n• Jumlah lagu di queue\n\n**Contoh:**\n```\njoshua nowplaying\njoshua np```',
                        inline: false
                    },
                    {
                        name: '`joshua queue`',
                        value: '**Alias:** `q`\nLihat antrian dengan info lengkap\n\n**Menampilkan:**\n• 10 lagu teratas\n• Lagu yang sedang play (dengan icon)\n• Status shuffle & repeat\n• Volume & kualitas\n• Total lagu',
                        inline: false
                    }
                )
                .setFooter({ text: 'Gunakan perintah ini untuk monitoring status bot' });

            return message.channel.send({ embeds: [embed] });
        }

        if (category === 'tips' || category === 'trick' || category === 'tricks') {
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('💡 Tips & Trik')
                .setDescription('Maksimalkan penggunaan Joshua Music Bot!')
                .addFields(
                    {
                        name: '🎯 Workflow Optimal',
                        value: '```\n1. joshua play <lagu 1>\n2. joshua play <lagu 2>\n3. joshua play <lagu 3>\n4. joshua shuffle        # Acak\n5. joshua repeat queue   # Loop semua\n6. joshua volume 70      # Set volume enak```',
                        inline: false
                    },
                    {
                        name: '⚡ Shortcuts',
                        value: '• Gunakan alias untuk lebih cepat:\n  `joshua p` = play\n  `joshua s` = skip\n  `joshua q` = queue\n  `joshua np` = nowplaying\n  `joshua v` = volume',
                        inline: false
                    },
                    {
                        name: '🎵 Playlist Hack',
                        value: '• Add multiple lagu terlebih dahulu\n• Gunakan `joshua shuffle` untuk variasi\n• Set `joshua repeat queue` untuk loop\n• Adjust `joshua volume` sesuai suasana',
                        inline: false
                    },
                    {
                        name: '🔧 Queue Management',
                        value: '• `joshua remove` untuk hapus lagu jelek\n• `joshua move` untuk atur urutan favorit\n• `joshua skipto` untuk loncat ke lagu fav\n• `joshua clear` untuk reset queue',
                        inline: false
                    },
                    {
                        name: '🎧 Best Practice',
                        value: '• Set quality HIGH untuk audio terbaik\n• Gunakan shuffle untuk hindari monoton\n• Pause saat AFK, jangan stop\n• Check `joshua np` untuk tau status',
                        inline: false
                    },
                    {
                        name: '⚠️ Troubleshooting',
                        value: '• Lagu stuck? → `joshua skip`\n• Queue berantakan? → `joshua unshuffle`\n• Volume terlalu keras? → `joshua volume 50`\n• Mau fresh start? → `joshua stop`',
                        inline: false
                    }
                )
                .setFooter({ text: 'Selamat menikmati musik! 🎶' });

            return message.channel.send({ embeds: [embed] });
        }

        // Jika kategori tidak ditemukan
        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('❌ Kategori Tidak Ditemukan')
            .setDescription(`Kategori **${category}** tidak tersedia.\n\nKategori yang tersedia:\n\`\`\`\nplayback, queue, loop, audio, info, tips\`\`\`\n\nGunakan \`joshua help\` untuk menu utama.`)
            .setFooter({ text: 'Coba: joshua help playback' });

        message.channel.send({ embeds: [embed] });
    }

    // Command: joshua quality
    if (command === 'quality') {
        if (!args.length) {
            const settings = serverSettings.get(message.guild.id) || new ServerSettings();
            return message.reply(`🎚️ Kualitas audio saat ini: **${settings.quality}**\n\nGunakan: \`joshua quality <low/medium/high>\``);
        }

        const quality = args[0].toLowerCase();
        if (!['low', 'medium', 'high'].includes(quality)) {
            return message.reply('❌ Pilihan tidak valid! Gunakan: `low`, `medium`, atau `high`');
        }

        let settings = serverSettings.get(message.guild.id);
        if (!settings) {
            settings = new ServerSettings();
            serverSettings.set(message.guild.id, settings);
        }

        settings.quality = quality;

        const qualityEmojis = {
            low: '🔉',
            medium: '🔊',
            high: '🔊✨'
        };

        const qualityDescriptions = {
            low: '64 kbps - Hemat bandwidth',
            medium: '128 kbps - Seimbang',
            high: '256 kbps - Kualitas terbaik'
        };

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎚️ Kualitas Audio Diubah')
            .setDescription(`${qualityEmojis[quality]} Kualitas: **${quality.toUpperCase()}**`)
            .addFields(
                { name: 'Info', value: qualityDescriptions[quality], inline: false },
                { name: '💡 Catatan', value: 'Pengaturan akan berlaku untuk lagu berikutnya', inline: false }
            );

        message.channel.send({ embeds: [embed] });
    }

    // Command: joshua shuffle
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

        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🔀 Queue Di-shuffle!')
            .setDescription(`Berhasil mengacak **${remainingSongs.length}** lagu dengan algoritma pintar`)
            .addFields(
                { name: '🎯 Fitur Shuffle Pintar', value: '• Mencegah lagu artis sama berurutan\n• Distribusi merata\n• Hindari pengulangan cepat', inline: false },
                { name: '💡 Tip', value: 'Gunakan `joshua unshuffle` untuk kembali ke urutan asli', inline: false }
            );

        message.channel.send({ embeds: [embed] });
    }

    // Command: joshua unshuffle
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

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('↩️ Shuffle Dimatikan')
            .setDescription('Queue dikembalikan ke urutan asli')
            .addFields(
                { name: '📋 Info', value: `${queue.songs.length} lagu dalam urutan normal`, inline: false }
            );

        message.channel.send({ embeds: [embed] });
    }

    // Command: joshua volume
    if (command === 'volume' || command === 'vol' || command === 'v') {
        const queue = queues.get(message.guild.id);
        
        if (!args.length) {
            const settings = serverSettings.get(message.guild.id) || new ServerSettings();
            const volumeBar = createVolumeBar(settings.volume);
            return message.reply(`🔊 Volume saat ini: **${settings.volume}%**\n${volumeBar}\n\nGunakan: \`joshua volume <0-100>\``);
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
            message.channel.send('💡 Volume akan berlaku untuk lagu berikutnya. Gunakan `joshua skip` untuk menerapkan sekarang.');
        }

        const volumeEmoji = volume === 0 ? '🔇' : volume < 30 ? '🔉' : volume < 70 ? '🔊' : '🔊✨';
        const volumeBar = createVolumeBar(volume);

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`${volumeEmoji} Volume Diatur`)
            .setDescription(`Volume: **${volume}%**\n${volumeBar}`)
            .addFields(
                { name: '💡 Info', value: 'Pengaturan volume akan berlaku untuk lagu berikutnya', inline: false }
            );

        message.channel.send({ embeds: [embed] });
    }
});

// Fungsi untuk memutar lagu
async function playSong(guild, song) {
    const queue = queues.get(guild.id);
    if (!queue) return;

    try {
        // Dapatkan settings kualitas dan volume
        const settings = serverSettings.get(guild.id) || new ServerSettings();
        
        // Set kualitas berdasarkan settings
        const qualityOptions = {
            low: 0,      // ~64 kbps
            medium: 1,   // ~128 kbps
            high: 2      // ~256 kbps
        };

        const stream = await play.stream(song.url, {
            quality: qualityOptions[settings.quality] || 2
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

    } catch (error) {
        console.error(error);
        queue.songs.shift();
        if (queue.songs.length > 0) {
            playSong(guild, queue.songs[0]);
        }
    }
}

// Fungsi untuk membuat volume bar visual
function createVolumeBar(volume) {
    const barLength = 20;
    const filledLength = Math.round((volume / 100) * barLength);
    const emptyLength = barLength - filledLength;
    
    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    
    return `\`${filledBar}${emptyBar}\` ${volume}%`;
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
