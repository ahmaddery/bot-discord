require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('youtube-sr').default;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Queue system sederhana
const queues = new Map();

client.once('ready', () => {
    console.log(`✅ Bot siap! Login sebagai ${client.user.tag}`);
    client.user.setActivity('🎵 Music | joshua help', { type: 'LISTENING' });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('joshua')) return;

    const args = message.content.slice(6).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    try {
        switch (command) {
            case 'play':
            case 'p':
                await playMusic(message, args);
                break;
            case 'skip':
            case 's':
                await skipSong(message);
                break;
            case 'stop':
            case 'leave':
                await stopMusic(message);
                break;
            case 'queue':
            case 'q':
                await showQueue(message);
                break;
            case 'help':
                await showHelp(message);
                break;
        }
    } catch (error) {
        console.error('Error:', error);
        message.reply('❌ Terjadi kesalahan!');
    }
});

async function playMusic(message, args) {
    const voiceChannel = message.member.voice.channel;
    
    if (!voiceChannel) {
        return message.reply('❌ Kamu harus berada di voice channel!');
    }

    if (!args.length) {
        return message.reply('❌ Berikan URL YouTube atau kata kunci!\nContoh: `joshua play Dewa 19`');
    }

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return message.reply('❌ Bot tidak punya izin Connect/Speak!');
    }

    try {
        const loadingMsg = await message.reply('🔍 Mencari lagu...');
        
        let videoUrl = args.join(' ');
        let videoInfo;

        // Jika bukan URL, search dengan youtube-sr
        if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
            const searchResults = await ytSearch.search(videoUrl, { limit: 1, type: 'video' });
            
            if (!searchResults || searchResults.length === 0) {
                await loadingMsg.delete().catch(() => {});
                return message.reply('❌ Tidak menemukan lagu!');
            }
            
            videoUrl = searchResults[0].url;
            videoInfo = {
                title: searchResults[0].title,
                url: searchResults[0].url,
                duration: searchResults[0].durationFormatted,
                thumbnail: searchResults[0].thumbnail?.url
            };
        } else {
            // Validate URL
            if (!ytdl.validateURL(videoUrl)) {
                await loadingMsg.delete().catch(() => {});
                return message.reply('❌ URL YouTube tidak valid!');
            }
            
            const info = await ytdl.getBasicInfo(videoUrl);
            videoInfo = {
                title: info.videoDetails.title,
                url: info.videoDetails.video_url,
                duration: formatDuration(parseInt(info.videoDetails.lengthSeconds)),
                thumbnail: info.videoDetails.thumbnails[0]?.url
            };
        }

        // Get atau create queue
        let queue = queues.get(message.guild.id);
        
        if (!queue) {
            // Create new queue
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            connection.subscribe(player);

            queue = {
                connection,
                player,
                songs: [],
                textChannel: message.channel,
                playing: false
            };

            queues.set(message.guild.id, queue);

            // Event handlers
            player.on(AudioPlayerStatus.Idle, () => {
                queue.songs.shift();
                if (queue.songs.length > 0) {
                    playSong(queue);
                } else {
                    queue.playing = false;
                }
            });

            player.on('error', error => {
                console.error('Audio player error:', error);
                queue.textChannel.send('❌ Error saat memutar lagu!');
                queue.songs.shift();
                if (queue.songs.length > 0) {
                    playSong(queue);
                }
            });

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                    ]);
                } catch {
                    connection.destroy();
                    queues.delete(message.guild.id);
                }
            });
        }

        // Add song to queue
        queue.songs.push({
            ...videoInfo,
            requester: message.author.tag
        });

        await loadingMsg.delete().catch(() => {});

        if (queue.songs.length === 1) {
            // Play immediately
            playSong(queue);
        } else {
            // Added to queue
            const embed = new EmbedBuilder()
                .setColor('#FFFF00')
                .setTitle('➕ Ditambahkan ke Queue')
                .setDescription(`**[${videoInfo.title}](${videoInfo.url})**`)
                .addFields(
                    { name: '⏱️ Durasi', value: videoInfo.duration, inline: true },
                    { name: '📝 Posisi', value: `#${queue.songs.length}`, inline: true }
                )
                .setThumbnail(videoInfo.thumbnail);
            
            message.channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error playing:', error);
        
        let errorMsg = '❌ Terjadi kesalahan!';
        if (error.message.includes('bot')) {
            errorMsg = '❌ YouTube memblokir bot! Cookies mungkin expired.';
        }
        
        message.reply(errorMsg);
    }
}

function playSong(queue) {
    if (queue.songs.length === 0) {
        queue.playing = false;
        return;
    }

    const song = queue.songs[0];
    queue.playing = true;

    try {
        const stream = ytdl(song.url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25
        });

        const resource = createAudioResource(stream);
        queue.player.play(resource);

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('▶️ Mulai memutar')
            .setDescription(`**[${song.title}](${song.url})**`)
            .addFields(
                { name: '⏱️ Durasi', value: song.duration, inline: true },
                { name: '👤 Diminta oleh', value: song.requester, inline: true }
            )
            .setThumbnail(song.thumbnail);

        queue.textChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error creating stream:', error);
        queue.textChannel.send('❌ Gagal memutar lagu!');
        queue.songs.shift();
        if (queue.songs.length > 0) {
            playSong(queue);
        }
    }
}

async function skipSong(message) {
    const queue = queues.get(message.guild.id);
    
    if (!queue || !queue.playing) {
        return message.reply('❌ Tidak ada lagu yang sedang diputar!');
    }

    queue.player.stop();
    message.reply('⏭️ Lagu di-skip!');
}

async function stopMusic(message) {
    const queue = queues.get(message.guild.id);
    
    if (!queue) {
        return message.reply('❌ Bot tidak sedang memutar musik!');
    }

    queue.songs = [];
    queue.player.stop();
    queue.connection.destroy();
    queues.delete(message.guild.id);
    
    message.reply('⏹️ Music stopped dan bot keluar dari VC!');
}

async function showQueue(message) {
    const queue = queues.get(message.guild.id);
    
    if (!queue || queue.songs.length === 0) {
        return message.reply('❌ Queue kosong!');
    }

    const queueList = queue.songs.slice(0, 10).map((song, index) => {
        return `${index === 0 ? '▶️' : `${index}.`} [${song.title}](${song.url}) - ${song.duration}`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📝 Music Queue')
        .setDescription(queueList)
        .setFooter({ text: `Total: ${queue.songs.length} lagu` });

    message.channel.send({ embeds: [embed] });
}

async function showHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#00FFFF')
        .setTitle('🎵 Bot Music - Panduan')
        .setDescription('Perintah yang tersedia:')
        .addFields(
            { name: '▶️ joshua play <judul/URL>', value: 'Memutar lagu dari YouTube', inline: false },
            { name: '⏭️ joshua skip', value: 'Skip lagu saat ini', inline: false },
            { name: '⏹️ joshua stop', value: 'Stop musik dan keluar VC', inline: false },
            { name: '📝 joshua queue', value: 'Lihat daftar lagu', inline: false },
            { name: '❓ joshua help', value: 'Tampilkan panduan', inline: false }
        )
        .setFooter({ text: 'Simple Music Bot - No DisTube' });

    message.channel.send({ embeds: [embed] });
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

client.login(process.env.DISCORD_TOKEN);
