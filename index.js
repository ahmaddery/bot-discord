require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const play = require('play-dl');

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

// Struktur queue untuk setiap server
class Queue {
    constructor() {
        this.songs = [];
        this.connection = null;
        this.player = null;
        this.isPlaying = false;
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

    // Command: !queue
    if (command === 'queue' || command === 'q') {
        const queue = queues.get(message.guild.id);
        if (!queue || queue.songs.length === 0) {
            return message.reply('❌ Queue kosong!');
        }

        const embed = new EmbedBuilder()
            .setColor('#0099FF')
            .setTitle('📋 Queue Lagu')
            .setDescription(
                queue.songs
                    .slice(0, 10)
                    .map((song, index) => `**${index + 1}.** [${song.title}](${song.url}) - \`${song.duration}\``)
                    .join('\n')
            )
            .setFooter({ text: `Total: ${queue.songs.length} lagu` });

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
                { name: 'joshua help', value: 'Menampilkan perintah ini', inline: false }
            )
            .setFooter({ text: 'Prefix: joshua' });

        message.channel.send({ embeds: [embed] });
    }
});

// Fungsi untuk memutar lagu
async function playSong(guild, song) {
    const queue = queues.get(guild.id);
    if (!queue) return;

    try {
        const stream = await play.stream(song.url);
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
        });

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
