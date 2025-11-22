# 🎵 Discord Music Bot (SoundCloud)

Bot Discord untuk memutar musik dari SoundCloud dengan fitur lengkap.

## ✨ Fitur

- ✅ Memutar musik dari SoundCloud (URL atau pencarian)
- ✅ Queue sistem untuk multiple lagu
- ✅ Skip lagu
- ✅ Stop dan keluar dari voice channel
- ✅ Menampilkan queue
- ✅ Menampilkan lagu yang sedang diputar
- ✅ Embed yang menarik untuk setiap respons

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

## 📝 Daftar Perintah

### ▶️ Playback Control
| Perintah | Alias | Deskripsi |
|----------|-------|-----------|
| `joshua play <url/query>` | `joshua p` | Memutar lagu dari SoundCloud URL atau melakukan pencarian |
| `joshua pause` | - | Jeda lagu yang sedang diputar |
| `joshua resume` | `joshua continue` | Lanjutkan lagu yang di-pause |
| `joshua skip` | `joshua s` | Melewati lagu yang sedang diputar |
| `joshua stop` | - | Berhenti memutar dan keluar dari voice channel |

### 🔁 Queue Management
| Perintah | Alias | Deskripsi |
|----------|-------|-----------|
| `joshua queue` | `joshua q` | Menampilkan daftar lagu di queue dengan status lengkap |
| `joshua clear` | `joshua clearqueue` | Hapus semua lagu dari queue |
| `joshua remove <nomor>` | `joshua rm` | Hapus lagu tertentu dari queue |
| `joshua move <dari> <ke>` | - | Pindahkan lagu dalam queue |
| `joshua skipto <nomor>` | `joshua jumpto` | Loncat ke lagu tertentu di queue |

### 🔀 Shuffle & Repeat
| Perintah | Alias | Deskripsi |
|----------|-------|-----------|
| `joshua shuffle` | `joshua mix` | Mengacak queue dengan algoritma pintar |
| `joshua unshuffle` | `joshua unmix` | Kembalikan queue ke urutan asli |
| `joshua repeat [mode]` | `joshua loop` | Toggle repeat mode (off/song/queue) |

### 🎚️ Audio Settings
| Perintah | Alias | Deskripsi |
|----------|-------|-----------|
| `joshua volume <0-100>` | `joshua vol`, `joshua v` | Mengatur volume global (persentase) |
| `joshua quality <low/medium/high>` | - | Mengatur kualitas audio streaming |
| `joshua nowplaying` | `joshua np` | Info lengkap lagu yang sedang diputar |
| `joshua help` | - | Menampilkan daftar perintah |

## 💡 Contoh Penggunaan

### Memutar & Kontrol Playback:
```
joshua play https://soundcloud.com/artist/song-name
joshua play alan walker faded
joshua pause          # Jeda
joshua resume         # Lanjutkan
joshua skip           # Lewati
```

### Queue Management:
```
joshua queue          # Lihat queue dengan status lengkap
joshua remove 3       # Hapus lagu nomor 3
joshua move 5 2       # Pindah lagu dari posisi 5 ke 2
joshua skipto 4       # Loncat ke lagu nomor 4
joshua clear          # Hapus semua queue
```

### Repeat & Loop:
```
joshua repeat         # Toggle: off → song → queue → off
joshua repeat song    # Repeat lagu saat ini
joshua repeat queue   # Repeat seluruh queue
joshua repeat off     # Matikan repeat
```

### Shuffle Pintar (seperti Spotify):
```
joshua shuffle        # Acak queue dengan algoritma pintar
joshua unshuffle      # Kembalikan ke urutan asli
```

**Fitur Shuffle Pintar:**
- 🎯 Mencegah artis yang sama muncul berurutan
- 🔄 Hindari lagu yang baru diputar
- 📊 Distribusi yang lebih merata dan natural
- 💫 Mirip algoritma Spotify & Apple Music

### Audio Settings:
```
joshua volume 50      # Set volume 50%
joshua quality high   # Kualitas terbaik (256 kbps)
joshua quality medium # Seimbang (128 kbps)
joshua quality low    # Hemat bandwidth (64 kbps)
joshua nowplaying     # Info lengkap dengan status
```

## ✨ Fitur Spotify-like

### 🎵 Playback Control
- ✅ Play/Pause/Resume
- ✅ Skip dengan preview lagu berikutnya
- ✅ Stop dan disconnect

### 🔁 Repeat Modes
- **Off** (➡️) - Normal playback
- **Song** (🔂) - Repeat lagu saat ini
- **Queue** (🔁) - Repeat seluruh queue

### 🔀 Smart Shuffle
- Algoritma pintar seperti Spotify
- Hindari pengulangan artis berurutan
- Track play history
- Distribusi merata

### 📋 Queue Management
- View queue dengan status lengkap
- Remove lagu spesifik
- Move lagu dalam queue
- Skip to lagu tertentu
- Clear entire queue

### 🎚️ Audio Control
- Volume control 0-100%
- Quality settings (low/medium/high)
- Visual volume bar
- Real-time status display

### 📊 Rich Info Display
- Now playing dengan thumbnail
- Status: Playing/Paused
- Repeat & Shuffle status
- Volume & Quality info
- Queue counter

## 🛠️ Teknologi yang Digunakan

- **discord.js** - Library untuk Discord Bot
- **@discordjs/voice** - Library untuk voice connection
- **play-dl** - Library untuk streaming dari SoundCloud
- **dotenv** - Environment variables management
- **ffmpeg-static** - FFmpeg binary

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

**Note:** Bot ini menggunakan SoundCloud sebagai sumber musik. Pastikan Anda mengikuti aturan dan kebijakan SoundCloud dalam penggunaan konten mereka.
