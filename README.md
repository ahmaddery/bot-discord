# 🎵 Discord Music Bot

Bot Discord untuk memutar musik dari YouTube dengan kualitas audio yang sangat jernih.

## ✨ Fitur

- ▶️ Memutar musik dari YouTube (URL atau pencarian)
- 🎵 Kualitas audio tinggi (highestaudio)
- 📝 Sistem queue/antrian lagu
- ⏭️ Skip, pause, resume, stop
- 🎨 Embed pesan yang menarik
- 👥 Multi-server support

## 📋 Persyaratan

- Node.js v16.9.0 atau lebih tinggi
- FFmpeg (sudah termasuk dalam dependencies)
- Discord Bot Token

## 🚀 Instalasi

### 1. Clone atau download project ini

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Bot Discord

1. Buka [Discord Developer Portal](https://discord.com/developers/applications)
2. Klik "New Application" dan beri nama bot Anda
3. Pergi ke tab "Bot" dan klik "Add Bot"
4. Di bagian "Token", klik "Copy" untuk menyalin token bot
5. Aktifkan **MESSAGE CONTENT INTENT** di bagian "Privileged Gateway Intents"
6. Pergi ke tab "OAuth2" > "URL Generator"
7. Pilih scopes: `bot` dan `applications.commands`
8. Pilih Bot Permissions:
   - Send Messages
   - Connect
   - Speak
   - Use Voice Activity
9. Copy URL yang dihasilkan dan buka di browser untuk invite bot ke server

### 4. Konfigurasi Environment

1. Copy file `.env.example` menjadi `.env`:
```bash
copy .env.example .env
```

2. Edit file `.env` dan masukkan token bot Anda:
```
DISCORD_TOKEN=token_bot_anda_disini
CLIENT_ID=client_id_anda_disini
```

### 5. Jalankan Bot

```bash
npm start
```

Atau untuk development dengan auto-reload:
```bash
npm run dev
```

## 🎮 Cara Penggunaan

### Perintah Dasar

| Perintah | Alias | Deskripsi |
|----------|-------|-----------|
| `!play <judul/URL>` | `!p` | Memutar lagu dari YouTube |
| `!skip` | `!s` | Melewati lagu yang sedang diputar |
| `!stop` | `!leave` | Menghentikan musik dan keluar dari VC |
| `!pause` | - | Mem-pause lagu yang sedang diputar |
| `!resume` | - | Melanjutkan lagu yang di-pause |
| `!queue` | `!q` | Menampilkan daftar lagu dalam queue |
| `!nowplaying` | `!np` | Menampilkan lagu yang sedang diputar |
| `!help` | - | Menampilkan panduan perintah |

### Contoh Penggunaan

```
!play Dewa 19 Separuh Nafas
!play https://www.youtube.com/watch?v=example
!skip
!queue
!np
```

## 🔧 Troubleshooting

### Bot tidak merespon
- Pastikan MESSAGE CONTENT INTENT sudah diaktifkan di Discord Developer Portal
- Cek token bot sudah benar di file `.env`

### Tidak ada suara
- Pastikan bot memiliki permission "Connect" dan "Speak"
- Pastikan Anda berada di voice channel yang sama dengan bot
- Cek volume di Discord

### Error saat install
```bash
# Jika ada error dengan sodium atau opus, coba:
npm install --force

# Atau install manual:
npm install sodium-native --force
npm install @discordjs/opus --force
```

### FFmpeg tidak ditemukan
FFmpeg sudah termasuk dalam `ffmpeg-static`. Jika masih error, install FFmpeg secara manual:
- Windows: Download dari [ffmpeg.org](https://ffmpeg.org/download.html)
- Tambahkan ke PATH

## 📦 Dependencies

- `discord.js` - Library Discord
- `@discordjs/voice` - Voice connection handler
- `ytdl-core` - YouTube downloader (kualitas audio tinggi)
- `play-dl` - YouTube search dan streaming
- `ffmpeg-static` - FFmpeg untuk audio processing
- `@discordjs/opus` - Audio encoding
- `sodium-native` - Encryption untuk voice

## 🎵 Kualitas Audio

Bot ini dikonfigurasi untuk memberikan kualitas audio terbaik:
- Filter: `audioonly`
- Quality: `highestaudio`
- High Water Mark: 33554432 bytes (buffer besar)
- Chunk size: Dynamic

## 📝 Lisensi

ISC

## 💡 Tips

- Gunakan URL YouTube langsung untuk hasil terbaik
- Queue bisa menampung banyak lagu
- Bot akan otomatis keluar jika queue kosong
- Pastikan koneksi internet stabil untuk streaming jernih

## 🤝 Kontribusi

Silakan berkontribusi dengan membuat pull request atau melaporkan bug via issues.

---

Dibuat dengan ❤️ menggunakan Node.js dan Discord.js
