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

| Perintah | Alias | Deskripsi |
|----------|-------|-----------|
| `joshua play <url/query>` | `joshua p` | Memutar lagu dari SoundCloud URL atau melakukan pencarian |
| `joshua skip` | `joshua s` | Melewati lagu yang sedang diputar |
| `joshua stop` | - | Berhenti memutar dan keluar dari voice channel |
| `joshua queue` | `joshua q` | Menampilkan daftar lagu di queue (max 10) |
| `joshua nowplaying` | `joshua np` | Menampilkan lagu yang sedang diputar |
| `joshua quality <low/medium/high>` | - | Mengatur kualitas audio streaming |
| `joshua volume <0-100>` | `joshua vol`, `joshua v` | Mengatur volume global (persentase) |
| `joshua help` | - | Menampilkan daftar perintah |

## 💡 Contoh Penggunaan

### Memutar lagu dengan URL SoundCloud:
```
joshua play https://soundcloud.com/artist/song-name
```

### Memutar lagu dengan pencarian:
```
joshua play alan walker faded
```

### Mengatur kualitas audio:
```
joshua quality high    # Kualitas terbaik (256 kbps)
joshua quality medium  # Seimbang (128 kbps)
joshua quality low     # Hemat bandwidth (64 kbps)
```

### Mengatur volume:
```
joshua volume 50   # Set volume ke 50%
joshua volume 100  # Set volume ke 100% (maksimum)
joshua volume 0    # Mute/diam
joshua volume      # Cek volume saat ini
```

### Skip lagu:
```
joshua skip
```

### Lihat queue:
```
joshua queue
```

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
