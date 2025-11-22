require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Setup DisTube
const distube = new DisTube(client, {
    emitNewSongOnly: true,
    leaveOnEmpty: true,
    leaveOnFinish: false,
    leaveOnStop: true,
    savePreviousSongs: true,
    searchSongs: 5,
    nsfw: false,
    emptyCooldown: 25,
    ytdlOptions: {
        highWaterMark: 1024 * 1024 * 64,
        quality: 'highestaudio',
        filter: 'audioonly',
        dlChunkSize: 0,
        liveBuffer: 60000,
    },
    plugins: [new YtDlpPlugin()]
});

client.once('ready', () => {
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
    
    try {
        await distube.play(voiceChannel, searchQuery, {
            textChannel: message.channel,
            member: message.member,
        });
    } catch (error) {
        console.error('Error saat memutar:', error);
        message.reply('❌ Terjadi kesalahan saat mencoba memutar lagu!');
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
            { name: '⏱️ Durasi', value: song.formattedDuration, inline: true },
            { name: '👤 Diminta oleh', value: song.user.tag, inline: true },
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
            { name: '⏱️ Durasi', value: song.formattedDuration, inline: true },
            { name: '👤 Diminta oleh', value: song.user.tag, inline: true }
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
            { name: '⏱️ Durasi', value: song.formattedDuration, inline: true },
            { name: '👤 Diminta oleh', value: song.user.tag, inline: true },
            { name: '📝 Posisi', value: `${queue.songs.length}`, inline: true }
        )
        .setThumbnail(song.thumbnail)
        .setTimestamp();

    queue.textChannel.send({ embeds: [embed] });
});

distube.on('error', (channel, error) => {
    console.error('DisTube Error:', error);
    if (channel) channel.send('❌ Terjadi kesalahan saat memutar musik!');
});

client.login(process.env.DISCORD_TOKEN);
