require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Load cookies untuk bypass YouTube bot detection
let cookiePath = '';
const cookieTxtPath = path.join(__dirname, 'cookies.txt');
const cookieJsonPath = path.join(__dirname, 'cookies.json');

if (fs.existsSync(cookieTxtPath)) {
    cookiePath = cookieTxtPath;
    console.log('✅ YouTube cookies found: cookies.txt');
} else if (fs.existsSync(cookieJsonPath)) {
    cookiePath = cookieJsonPath;
    console.log('✅ YouTube cookies found: cookies.json');
} else {
    console.warn('⚠️ No cookies file found. Bot mungkin diblokir YouTube.');
}

// Setup DisTube dengan YtDlpPlugin (lebih powerful dari YouTubePlugin)
const ytdlpOptions = {
    update: false
};

// Tambahkan cookies jika ada
if (cookiePath) {
    ytdlpOptions.cookies = cookiePath;
}

const distube = new DisTube(client, {
    plugins: [
        new YtDlpPlugin(ytdlpOptions),
        new SoundCloudPlugin()
    ],
    ffmpeg: {
        path: ffmpeg
    },
    emitNewSongOnly: false,
    savePreviousSongs: true
});

client.once('clientReady', () => {
    console.log(`✅ Bot siap! Login sebagai ${client.user.tag}`);
    client.user.setActivity('🎵 Music | joshua help', { type: 'LISTENING' });
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.toLowerCase().startsWith('joshua ')) return;

    const args = message.content.slice(7).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        switch (command) {
            case 'play':
            case 'p':
                await play_music(message, args);
                break;
            case 'skip':
            case 's':
                await skip_song(message);
                break;
            case 'stop':
            case 'leave':
                await stop_music(message);
                break;
            case 'pause':
                await pause_music(message);
                break;
            case 'resume':
                await resume_music(message);
                break;
            case 'queue':
            case 'q':
                await show_queue(message);
                break;
            case 'nowplaying':
            case 'np':
                await now_playing(message);
                break;
            case 'help':
                await show_help(message);
                break;
            default:
                break;
        }
    } catch (error) {
        console.error('Error:', error);
        message.reply('❌ Terjadi kesalahan saat menjalankan perintah.');
    }
});

async function play_music(message, args) {
    const voiceChannel = message.member.voice.channel;
    
    if (!voiceChannel) {
        return message.reply('❌ Kamu harus berada di voice channel terlebih dahulu!');
    }

    if (!args.length) {
        return message.reply('❌ Berikan URL YouTube atau kata kunci pencarian!\nContoh: `joshua play Dewa 19`');
    }

    const searchQuery = args.join(' ');
    
    // Cek permission bot
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return message.reply('❌ Bot tidak memiliki izin untuk join atau berbicara di voice channel!');
    }
    
    try {
        const loadingMsg = await message.reply('🔍 Mencari lagu...');
        
        // DisTube akan handle search otomatis
        await distube.play(voiceChannel, searchQuery, {
            textChannel: message.channel,
            member: message.member,
        });
        
        await loadingMsg.delete().catch(() => {});
    } catch (error) {
        console.error('Error saat memutar:', error);
        
        let errorMsg = '❌ Terjadi kesalahan saat mencoba memutar lagu!';
        
        if (error.message && error.message.includes('bot')) {
            errorMsg = '❌ YouTube memblokir bot. Coba lagi nanti atau gunakan VPN.';
        } else if (error.errorCode === 'VOICE_CONNECT_FAILED') {
            errorMsg = '❌ Tidak dapat terhubung ke voice channel. Pastikan bot punya izin Connect dan Speak.';
        } else if (error.errorCode === 'VOICE_ALREADY_CREATED') {
            errorMsg = '❌ Bot sedang digunakan di voice channel lain. Ketik `joshua stop` terlebih dahulu.';
        }
        
        message.reply(errorMsg);
    }
}

async function skip_song(message) {
    const queue = distube.getQueue(message.guild.id);
    
    if (!message.member.voice.channel) {
        return message.reply('❌ Kamu harus berada di voice channel!');
    }
    
    if (!queue) {
        return message.reply('❌ Tidak ada lagu yang sedang diputar!');
    }
    
    try {
        await distube.skip(message.guild.id);
        message.channel.send('⏭️ Melewati lagu!');
    } catch (error) {
        message.reply('❌ Terjadi kesalahan saat skip lagu!');
    }
}

async function stop_music(message) {
    const queue = distube.getQueue(message.guild.id);
    
    if (!message.member.voice.channel) {
        return message.reply('❌ Kamu harus berada di voice channel!');
    }
    
    if (!queue) {
        return message.reply('❌ Tidak ada lagu yang sedang diputar!');
    }
    
    await distube.stop(message.guild.id);
    message.channel.send('⏹️ Berhenti memutar musik dan keluar dari voice channel. Goodbye! 👋');
}

async function pause_music(message) {
    const queue = distube.getQueue(message.guild.id);
    
    if (!message.member.voice.channel) {
        return message.reply('❌ Kamu harus berada di voice channel!');
    }
    
    if (!queue) {
        return message.reply('❌ Tidak ada lagu yang sedang diputar!');
    }
    
    if (queue.paused) {
        return message.reply('⏸️ Lagu sudah dalam keadaan pause!');
    }
    
    await distube.pause(message.guild.id);
    message.channel.send('⏸️ Lagu di-pause!');
}

async function resume_music(message) {
    const queue = distube.getQueue(message.guild.id);
    
    if (!message.member.voice.channel) {
        return message.reply('❌ Kamu harus berada di voice channel!');
    }
    
    if (!queue) {
        return message.reply('❌ Tidak ada lagu yang sedang diputar!');
    }
    
    if (!queue.paused) {
        return message.reply('▶️ Lagu sudah dalam keadaan playing!');
    }
    
    await distube.resume(message.guild.id);
    message.channel.send('▶️ Melanjutkan lagu!');
}

async function show_queue(message) {
    const queue = distube.getQueue(message.guild.id);
    
    if (!queue || !queue.songs.length) {
        return message.reply('❌ Queue kosong!');
    }
    
    const queueList = queue.songs
        .slice(0, 10)
        .map((song, index) => {
            if (index === 0) {
                return `**▶️ Sedang diputar:**\n${index + 1}. [${song.name}](${song.url}) - \`${song.formattedDuration}\``;
            }
            return `${index + 1}. [${song.name}](${song.url}) - \`${song.formattedDuration}\``;
        })
        .join('\n\n');
    
    const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📝 Queue Musik')
        .setDescription(queueList)
        .setFooter({ text: `Total ${queue.songs.length} lagu dalam queue` })
        .setTimestamp();
    
    if (queue.songs.length > 10) {
        embed.setFooter({ text: `Menampilkan 10 dari ${queue.songs.length} lagu dalam queue` });
    }
    
    message.channel.send({ embeds: [embed] });
}

async function now_playing(message) {
    const queue = distube.getQueue(message.guild.id);
    
    if (!queue || !queue.songs.length) {
        return message.reply('❌ Tidak ada lagu yang sedang diputar!');
    }
    
    const song = queue.songs[0];
    
    const embed = new EmbedBuilder()
        .setColor('#FF00FF')
        .setTitle('🎵 Sedang Diputar')
        .setDescription(`**[${song.name}](${song.url})**`)
        .addFields(
            { name: '⏱️ Durasi', value: song.formattedDuration || 'Unknown', inline: true },
            { name: '👤 Diminta oleh', value: song.user?.tag || song.member?.user?.tag || 'Unknown', inline: true },
            { name: '📝 Queue', value: `${queue.songs.length} lagu`, inline: true }
        )
        .setThumbnail(song.thumbnail)
        .setTimestamp();
    
    message.channel.send({ embeds: [embed] });
}

async function show_help(message) {
    const embed = new EmbedBuilder()
        .setColor('#00FFFF')
        .setTitle('🎵 Bot Music - Panduan Perintah')
        .setDescription('Berikut adalah daftar perintah yang tersedia:')
        .addFields(
            { name: '▶️ joshua play <judul/URL>', value: 'Memutar lagu dari YouTube\nAlias: joshua p', inline: false },
            { name: '⏭️ joshua skip', value: 'Melewati lagu yang sedang diputar\nAlias: joshua s', inline: false },
            { name: '⏹️ joshua stop', value: 'Menghentikan musik dan keluar dari VC\nAlias: joshua leave', inline: false },
            { name: '⏸️ joshua pause', value: 'Mem-pause lagu yang sedang diputar', inline: false },
            { name: '▶️ joshua resume', value: 'Melanjutkan lagu yang di-pause', inline: false },
            { name: '📝 joshua queue', value: 'Menampilkan daftar lagu dalam queue\nAlias: joshua q', inline: false },
            { name: '🎵 joshua nowplaying', value: 'Menampilkan lagu yang sedang diputar\nAlias: joshua np', inline: false },
            { name: '❓ joshua help', value: 'Menampilkan panduan ini', inline: false }
        )
        .setFooter({ text: '💡 Tip: Gunakan prefix "joshua" sebelum setiap perintah' })
        .setTimestamp();
    
    message.channel.send({ embeds: [embed] });
}

// DisTube Events
distube.on('playSong', (queue, song) => {
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('▶️ Mulai memutar')
        .setDescription(`**[${song.name}](${song.url})**`)
        .addFields(
            { name: '⏱️ Durasi', value: song.formattedDuration || 'Unknown', inline: true },
            { name: '👤 Diminta oleh', value: song.user?.tag || song.member?.user?.tag || 'Unknown', inline: true }
        )
        .setThumbnail(song.thumbnail)
        .setTimestamp();

    queue.textChannel.send({ embeds: [embed] });
});

distube.on('addSong', (queue, song) => {
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('➕ Ditambahkan ke queue')
        .setDescription(`**[${song.name}](${song.url})**`)
        .addFields(
            { name: '⏱️ Durasi', value: song.formattedDuration || 'Unknown', inline: true },
            { name: '👤 Diminta oleh', value: song.user?.tag || song.member?.user?.tag || 'Unknown', inline: true },
            { name: '📝 Posisi', value: `${queue.songs.length}`, inline: true }
        )
        .setThumbnail(song.thumbnail)
        .setTimestamp();

    queue.textChannel.send({ embeds: [embed] });
});

distube.on('error', (queue, error) => {
    console.error('DisTube Error:', error);
    const errorMessage = error.message || error.errorCode || 'Terjadi kesalahan saat memutar musik!';
    if (queue && queue.textChannel) {
        queue.textChannel.send(`❌ Error: ${errorMessage}`).catch(console.error);
    }
});

distube.on('finishSong', (queue) => {
    console.log('Lagu selesai diputar');
});

distube.on('empty', (queue) => {
    console.log('Queue kosong, bot akan keluar dari voice channel');
});

client.login(process.env.DISCORD_TOKEN);
