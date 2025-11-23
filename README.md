# 🎵 coco Discord Music Bot

Bot Discord **SIMPLE** untuk memutar musik dari **SoundCloud** dan **Deezer**!

## ✨ Fitur Utama

### 🆕 Multi-Platform Search
- ✅ **Pencarian Simultan** di SoundCloud dan Deezer
- ✅ **Pilihan Platform** - Pilih mau dari mana
- ✅ **List 10 Lagu** - Dropdown menu interaktif
- ✅ **Info Lengkap** - Durasi, artist, thumbnail

### 🎵 Kontrol Simple
- ✅ Play, Pause, Resume, Skip
- ✅ Queue & Clear
- ✅ Shuffle & Repeat
- ✅ Volume control

**Gampang banget dipakai!** 🚀

## 📋 Prerequisites

Pastikan Anda sudah menginstall:
- [Node.js](https://nodejs.org/) (versi 16.9.0 atau lebih tinggi)
- [FFmpeg](https://ffmpeg.org/download.html) (diperlukan untuk streaming audio)

### Install FFmpeg di Windows:
1. Download FFmpeg dari [situs resmi](https://ffmpeg.org/download.html)
2. Extract file ke folder (misal: `C:\ffmpeg`)
3. Tambahkan `C:\ffmpeg\bin` ke Environment Variables PATH
4. Restart Command Prompt/PowerShell

Atau gunakan Chocolatey:
```powershell
choco install ffmpeg
```

## 🚀 Instalasi

1. Clone atau download repository ini

2. Install dependencies:
```bash
npm install
```

3. File `.env` sudah ada dengan token Discord Anda:
```env
DISCORD_TOKEN=your_token_here
CLIENT_ID=your_client_id_here
```

4. Pastikan bot Anda memiliki permission yang cukup di Discord:
   - `Send Messages`
   - `Connect`
   - `Speak`
   - `Read Message History`
   - `Use Voice Activity`

## 🎮 Cara Menjalankan

### Mode Normal:
```bash
npm start
```

### Mode Development (auto-restart):
```bash
npm run dev
```

## 📝 Perintah Bot

### Perintah Utama (Yang Sering Dipakai)

```bash
# Putar Lagu
coco play <judul lagu>     # Cari & pilih dari SoundCloud/Deezer
coco pause                 # Jeda
coco resume                # Lanjut
coco skip                  # Skip

# Queue
coco queue                 # Lihat daftar lagu
coco nowplaying            # Lagu yang sedang play
coco clear                 # Hapus semua queue

# Audio
coco volume 70             # Set volume (0-100)
coco shuffle               # Acak queue
coco repeat                # Loop on/off
coco stop                  # Stop & keluar

# Help
coco help                  # Lihat semua perintah
```

**Sesimple itu!** 👌

## 💡 Cara Pakai

### Super Simple! 🚀

```bash
# 1. Ketik perintah play
coco play sorry justin bieber

# 2. Pilih platform (SoundCloud atau Deezer)
# Bot tampilkan dropdown menu

# 3. Pilih lagu dari 10 hasil
# Klik lagu yang kamu mau

# 4. Done! Lagu otomatis play 🎵
```

### Workflow Cepat

```bash
# Add beberapa lagu
coco play <lagu1>
coco play <lagu2>
coco play <lagu3>

# Atur sesuai selera
coco shuffle         # Acak
coco repeat          # Loop on
coco volume 80       # Set volume

# Enjoy non-stop! 🎵
```

### URL Langsung
```bash
coco play https://soundcloud.com/artist/song
# Skip menu, langsung play!
```

## 🛠️ Setup & Install

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup .env File
```env
DISCORD_TOKEN=your_bot_token_here
```

### 3. Run Bot
```bash
npm start
```

**Done! Bot siap dipakai!** ✅

## 🎯 Fitur Unggulan

- 🔍 **Multi-Platform** - SoundCloud + Deezer
- 📋 **Interactive Menu** - Dropdown selection
- 🔀 **Smart Shuffle** - Algoritma pintar
- 🔁 **Repeat Mode** - Loop queue
- 🎚️ **Volume Control** - 0-100%
- 📱 **Simple Commands** - Easy to use!
- 🎵 **High Quality Audio** - Always use highest quality available (256 kbps atau lossless jika ada)

## 🛠️ Teknologi

- **discord.js** - Library untuk Discord Bot
- **@discordjs/voice** - Library untuk voice connection
- **play-dl** - Library untuk streaming dari SoundCloud
- **deezer-public-api** - 🆕 Search & metadata dari Deezer
- **node-fetch** - HTTP client untuk API calls
- **tweetnacl** - Audio encryption
- **@snazzah/davey** - DAVE protocol support
- **sodium-native** - High-performance encryption
- **dotenv** - Environment variables management
- **ffmpeg-static** - FFmpeg binary

## 🎯 Keuntungan Multi-Platform

### 🔊 SoundCloud
- ✅ Library lagu sangat besar
- ✅ Remix & cover songs
- ✅ Underground & indie artists
- ✅ Streaming stabil

### 🎵 Deezer  
- ✅ Official releases
- ✅ Metadata lengkap (artist, album)
- ✅ High-quality info
- ✅ Top charts & popular songs

**Best of Both Worlds!** Search di Deezer untuk metadata lengkap & official tracks, stream dari SoundCloud untuk stabilitas maksimal.

## ⚠️ Troubleshooting

### Bot tidak bisa join voice channel:
- Pastikan bot memiliki permission `Connect` dan `Speak`
- Pastikan Anda sudah masuk ke voice channel

### Error saat memutar musik:
- Pastikan FFmpeg sudah terinstall dengan benar
- Cek URL SoundCloud valid
- Pastikan lagu bisa diakses secara publik

### Bot tidak merespons:
- Cek token di file `.env` sudah benar
- Pastikan bot sudah online di Discord
- Cek bot memiliki permission `Read Messages` dan `Send Messages`

## 📄 License

ISC

## 👤 Author

Bot ini dibuat untuk keperluan edukasi dan hiburan.

---

**Note:** Bot ini menggunakan SoundCloud dan Deezer sebagai sumber musik. Pastikan Anda mengikuti aturan dan kebijakan kedua platform dalam penggunaan konten mereka.

## 🎉 What's New?

### v2.0 - Multi-Platform Update
- 🆕 **Deezer Integration** - Search lagu di Deezer
- 🆕 **Interactive UI** - Dropdown menu untuk pilih platform & lagu
- 🆕 **List View** - Tampilan 10 hasil teratas
- 🆕 **Rich Metadata** - Info artist, duration, thumbnail
- ✨ **Best Experience** - Kombinasi terbaik dari 2 platform

### Cara Kerja:
1. User: `coco play sorry justin bieber`
2. Bot search di SoundCloud (10 hasil) + Deezer (10 hasil)
3. Bot tampilkan menu: Pilih SoundCloud atau Deezer
4. User pilih platform
5. Bot tampilkan list 10 lagu dengan info lengkap
6. User pilih lagu dari dropdown
7. Bot play lagu yang dipilih!

**Seamless & Interactive!** 🎵✨

