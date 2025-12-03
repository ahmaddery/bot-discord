# Web Dashboard Controls - Joshua Music Bot 🎮

Dashboard sudah dilengkapi dengan **kontrol penuh** untuk mengelola bot musik langsung dari browser! Anda bisa menambah lagu, play/pause, skip, dan mengatur volume tanpa perlu menggunakan Discord.

## 🎛️ Fitur Kontrol

### 1. **Add Song** (Request Lagu)
Tambahkan lagu ke queue langsung dari dashboard:

```javascript
// Klik button "Add Song" atau gunakan API
POST /api/server/:guildId/play
Body: { "query": "song name or URL" }
```

**Cara Pakai:**
1. Buka halaman server (`/server/:guildId`)
2. Klik button **"+ Add Song"**
3. Masukkan nama lagu atau URL SoundCloud
4. Lagu otomatis ditambahkan ke queue dan akan dimainkan

**Features:**
- ✅ Search otomatis di SoundCloud
- ✅ Thumbnail dan metadata lengkap
- ✅ Requester ditandai sebagai "Dashboard User"
- ✅ Auto-play jika queue kosong

### 2. **Play/Pause Control**
Kontrol playback dengan satu klik:

```javascript
POST /api/server/:guildId/pause   // Pause
POST /api/server/:guildId/resume  // Resume
```

**Cara Pakai:**
- Klik button **Play/Pause** di bottom player bar
- Icon berubah otomatis (▶️ ⟷ ⏸️)
- Real-time update via WebSocket

### 3. **Skip Song**
Lewati lagu yang sedang diputar:

```javascript
POST /api/server/:guildId/skip
```

**Cara Pakai:**
- Klik button **Next** (⏭️) di player controls
- Lagu langsung skip ke next dalam queue
- Queue otomatis update

### 4. **Stop Playback**
Hentikan musik dan clear queue:

```javascript
POST /api/server/:guildId/stop
```

**Cara Pakai:**
- API endpoint tersedia untuk custom implementation
- Menghapus semua lagu dari queue
- Disconnect dari voice channel

### 5. **Volume Control**
Atur volume dari dashboard:

```javascript
POST /api/server/:guildId/volume
Body: { "volume": 0-100 }
```

**Cara Pakai:**
- Klik pada **volume bar** di player
- Drag atau klik posisi untuk set volume
- Perubahan langsung apply ke playback

## 🔌 API Endpoints

### Control Endpoints

| Endpoint | Method | Body | Deskripsi |
|----------|--------|------|-----------|
| `/api/server/:guildId/play` | POST | `{ query }` | Add lagu ke queue |
| `/api/server/:guildId/pause` | POST | - | Pause playback |
| `/api/server/:guildId/resume` | POST | - | Resume playback |
| `/api/server/:guildId/skip` | POST | - | Skip ke next song |
| `/api/server/:guildId/stop` | POST | - | Stop & clear queue |
| `/api/server/:guildId/volume` | POST | `{ volume }` | Set volume (0-100) |

### Info Endpoints

| Endpoint | Method | Response |
|----------|--------|----------|
| `/api/guilds` | GET | List semua servers |
| `/api/server/:guildId/queue` | GET | Queue data & status |

## 📡 Real-Time Updates (WebSocket)

Dashboard menggunakan WebSocket untuk real-time synchronization:

### Server → Client Messages

```javascript
// Queue Update
{
    type: 'queueUpdate',
    guildId: '123456789',
    queue: {
        songs: [...],
        isPlaying: true,
        isPaused: false,
        repeatMode: 'off',
        isShuffled: false
    }
}

// Now Playing Update
{
    type: 'nowPlaying',
    song: {
        title: 'Song Title',
        requester: 'User',
        thumbnail: 'url',
        duration: '3:45'
    }
}
```

### Client → Server Messages

```javascript
// Request Update
{
    type: 'requestUpdate'
}
```

## 🔧 Technical Architecture

### Shared State System
Bot dan dashboard menggunakan **shared state** melalui `shared-state.js`:

```javascript
// shared-state.js
const queues = new Map();           // Song queues
const serverSettings = new Map();   // Server settings
const connections = new Map();      // Voice connections
const players = new Map();          // Audio players

module.exports = { queues, serverSettings, connections, players };
```

**Benefits:**
- ✅ Real-time sync antara bot dan dashboard
- ✅ Single source of truth untuk queue data
- ✅ No database needed untuk temporary data
- ✅ Memory efficient

### Integration Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │────────►│  Dashboard   │────────►│ Shared State│
│  (Client)   │◄────────│  (Express)   │◄────────│   (Memory)  │
└─────────────┘         └──────────────┘         └─────────────┘
                               │                         ▲
                               │                         │
                               ▼                         │
                        ┌──────────────┐                 │
                        │  Discord.js  │─────────────────┘
                        │     Bot      │
                        └──────────────┘
```

1. **User action** di browser (klik button)
2. **API call** ke dashboard server
3. **Update shared state** (queues, settings)
4. **Bot reads state** untuk playback
5. **WebSocket broadcast** update ke semua clients
6. **UI updates** real-time

## 🎯 Usage Examples

### Example 1: Add Song dari Dashboard

```javascript
// Client-side (dashboard.js)
async function requestSong() {
    const query = prompt('Enter song name:');
    const result = await fetch(`/api/server/${guildId}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });
    
    const data = await result.json();
    alert(`Added: ${data.song.title}`);
}
```

### Example 2: Play/Pause Toggle

```javascript
async function playPause() {
    const queue = await fetch(`/api/server/${guildId}/queue`).then(r => r.json());
    
    const endpoint = queue.isPaused ? 'resume' : 'pause';
    await fetch(`/api/server/${guildId}/${endpoint}`, { method: 'POST' });
}
```

### Example 3: Volume Slider

```javascript
volumeBar.parentElement.addEventListener('click', async (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    
    volumeBar.style.width = `${percent}%`;
    
    await fetch(`/api/server/${guildId}/volume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: percent })
    });
});
```

## 🚀 How to Use

### 1. Start Bot & Dashboard

```bash
# Terminal 1 - Bot
node index.js

# Terminal 2 - Dashboard
node dashboard.js
```

### 2. Open Dashboard

```
http://localhost:3000
```

### 3. Select Server

Klik server card untuk masuk ke halaman kontrol

### 4. Add Song

- Klik **"+ Add Song"**
- Masukkan: `song name` atau `soundcloud.com/...`
- Bot otomatis search dan play

### 5. Control Playback

- **Play/Pause**: Klik center button di player bar
- **Skip**: Klik next button (⏭️)
- **Volume**: Klik volume bar dan drag

## 📋 Requirements

### Bot harus connect ke voice channel dulu!

**Important:** Dashboard bisa add song, tapi bot **HARUS** sudah join voice channel via Discord command terlebih dahulu:

```
joshua play [any song]
```

Setelah bot join voice, dashboard bisa:
- ✅ Add more songs ke queue
- ✅ Control playback (pause/resume/skip)
- ✅ Adjust volume
- ✅ Monitor queue real-time

## 🔐 Security Notes

**⚠️ Dashboard ini BELUM memiliki authentication!**

Siapa saja yang akses `localhost:3000` bisa kontrol bot. Untuk production:

1. **Add Discord OAuth2** untuk login
2. **Check permissions** - hanya admin yang bisa kontrol
3. **Add rate limiting** untuk API endpoints
4. **Use HTTPS** untuk production deployment
5. **Add CORS** jika frontend terpisah

## 🐛 Troubleshooting

### Bot tidak play lagu dari dashboard

**Problem:** API return success tapi tidak play

**Solution:**
1. Pastikan bot sudah join voice channel via Discord
2. Check console untuk error messages
3. Verify shared-state.js di-import correctly
4. Restart both bot dan dashboard

### WebSocket tidak connect

**Problem:** Real-time updates tidak jalan

**Solution:**
1. Check browser console untuk WebSocket errors
2. Verify port 3000 tidak di-block firewall
3. Clear browser cache dan reload
4. Check dashboard.js logs untuk connection errors

### Volume control tidak work

**Problem:** Volume slider tidak mengubah volume

**Solution:**
1. Volume hanya apply ke **lagu baru** yang di-play
2. Untuk current song, perlu re-create audio resource
3. Gunakan Discord command `joshua volume` sebagai alternatif

## 📝 Notes

- 🎵 Song search menggunakan **SoundCloud** via play-dl
- 🤖 AI autoplay tetap work dari dashboard
- 📊 Queue updates **real-time** via WebSocket
- 💾 State di-share antara bot dan dashboard (in-memory)
- 🔄 Refresh page untuk sync jika ada disconnect

## 🎨 UI Components

### Add Song Button
```html
<button id="add-song-btn" class="px-4 py-2 bg-spotify-green hover:bg-green-600 text-black font-semibold rounded-full">
    + Add Song
</button>
```

### Player Controls
```html
<button id="play-pause-btn" title="Play/Pause">
    <svg id="play-icon">...</svg>
    <svg id="pause-icon" class="hidden">...</svg>
</button>

<button data-action="skip" title="Skip">
    <svg>...</svg>
</button>
```

### Volume Bar
```html
<div class="w-24 h-1 bg-spotify-dark rounded-full cursor-pointer">
    <div id="volume-bar" class="h-full bg-spotify-lightgray" style="width: 50%"></div>
</div>
```

---

**Dashboard URL:** http://localhost:3000  
**API Base:** http://localhost:3000/api  
**WebSocket:** ws://localhost:3000

Enjoy controlling your Discord music bot from the web! 🎵🚀
