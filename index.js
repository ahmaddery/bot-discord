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

// Event ketika menerima pesan
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.toLowerCase().startsWith('joshua ')) return;

    const args = message.content.slice(7).trim().split(/ +/);
    const command = args.shift().toLowerCase();

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
                    // Tambahkan lagu yang baru selesai ke history
                    if (queue.songs.length > 0) {
                        queue.playHistory.push(queue.songs[0]);
                        // Batasi history hanya 10 lagu terakhir
                        if (queue.playHistory.length > 10) {
                            queue.playHistory.shift();
                        }
                    }
                    
                    queue.songs.shift();
                    if (queue.songs.length > 0) {
                        playSong(message.guild, queue.songs[0]);
                    } else {
                        queue.isPlaying = false;
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

    // Command: !skip
    if (command === 'skip' || command === 's') {
        const queue = queues.get(message.guild.id);
        if (!queue || !queue.isPlaying) {
            return message.reply('❌ Tidak ada lagu yang sedang diputar!');
        }

        queue.player.stop();
        message.channel.send('⏭️ Melewati lagu...');
    }

    // Command: !stop
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

        const shuffleStatus = queue.isShuffled ? '🔀 Shuffle: ON' : '▶️ Shuffle: OFF';
        
        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('📋 Queue Lagu')
            .setDescription(
                queue.songs
                    .slice(0, 10)
                    .map((song, index) => `**${index + 1}.** [${song.title}](${song.url}) - \`${song.duration}\``)
                    .join('\n')
            )
            .setFooter({ text: `Total: ${queue.songs.length} lagu | ${shuffleStatus}` });

        message.channel.send({ embeds: [embed] });
    }

    // Command: !nowplaying atau !np
    if (command === 'nowplaying' || command === 'np') {
        const queue = queues.get(message.guild.id);
        if (!queue || !queue.isPlaying || queue.songs.length === 0) {
            return message.reply('❌ Tidak ada lagu yang sedang diputar!');
        }

        const song = queue.songs[0];
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
    }

    // Command: joshua help
    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎵 Daftar Perintah Bot Music')
            .setDescription('Bot musik SoundCloud untuk Discord')
            .addFields(
                { name: 'joshua play <url/query>', value: 'Memutar lagu dari SoundCloud URL atau pencarian', inline: false },
                { name: 'joshua skip', value: 'Melewati lagu yang sedang diputar', inline: false },
                { name: 'joshua stop', value: 'Berhenti memutar dan keluar dari voice channel', inline: false },
                { name: 'joshua queue', value: 'Menampilkan daftar lagu di queue', inline: false },
                { name: 'joshua nowplaying (joshua np)', value: 'Menampilkan lagu yang sedang diputar', inline: false },
                { name: 'joshua shuffle', value: 'Mengacak queue dengan algoritma pintar', inline: false },
                { name: 'joshua unshuffle', value: 'Kembalikan ke urutan asli', inline: false },
                { name: 'joshua quality <low/medium/high>', value: 'Mengatur kualitas audio streaming', inline: false },
                { name: 'joshua volume <0-100>', value: 'Mengatur volume global (persentase)', inline: false },
                { name: 'joshua help', value: 'Menampilkan perintah ini', inline: false }
            )
            .setFooter({ text: 'Prefix: joshua' });

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
