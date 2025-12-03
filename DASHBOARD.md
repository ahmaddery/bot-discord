# Joshua Music Bot Dashboard 🎵

Dashboard web untuk Joshua Music Bot dengan tampilan seperti Spotify, dibangun menggunakan **Tailwind CSS**, **Express**, **EJS**, dan **WebSocket** untuk real-time updates.

## ✨ Features

### 🎨 Spotify-Inspired UI
- **Dark Theme**: Warna hitam (#191414, #121212) dengan aksen hijau Spotify (#1DB954)
- **Sidebar Navigation**: Navigasi yang fixed dengan home, commands, dan stats
- **Top Bar**: Header dengan navigation controls dan Connect Discord button
- **Now Playing Bar**: Bottom player dengan controls, progress bar, dan volume control
- **Gradient Cards**: Hero sections dengan gradient overlay
- **Hover Effects**: Smooth transitions dan animations

### 📊 Dashboard Pages

#### 1. **Home Page** (`/`)
- Hero section dengan bot avatar dan stats
- Stats cards (Servers, Users, Active Players)
- Server grid dengan play indicators
- Feature showcase dengan gradient cards

#### 2. **Server Detail** (`/server/:guildId`)
- Server header dengan icon/avatar
- Settings display (Volume, Quality, AI Autoplay)
- Live queue dengan now playing indicator
- Song list dengan thumbnails dan metadata

#### 3. **Commands Page** (`/commands`)
- Categorized command list
- Command syntax dengan aliases
- Badge indicators (Essential, Control, Info, etc.)
- Quick tips section

### 🔄 Real-Time Features

#### WebSocket Integration
```javascript
// Client automatically connects to WebSocket
// Receives real-time updates for:
- Queue changes
- Now playing updates
- Server status changes
```

#### Discord Presence
Bot's Discord status updates saat lagu dimainkan:
```
🎵 Listening to: Song Title
```

## 🚀 Getting Started

### Prerequisites
- Node.js v22.14.0 atau lebih tinggi
- Discord Bot Token
- Google Gemini API Key

### Installation

1. **Clone repository**
```bash
cd bot-discord
npm install
```

2. **Configure environment**
```env
DISCORD_TOKEN=your_discord_token
CLIENT_ID=your_client_id
GEMINI_API_KEY=your_gemini_key
DASHBOARD_PORT=3000
```

3. **Run bot dan dashboard**
```bash
# Terminal 1 - Bot
npm start

# Terminal 2 - Dashboard
npm run dashboard
# atau
node dashboard.js
```

4. **Akses dashboard**
```
http://localhost:3000
```

## 🎨 Design System

### Color Palette (Tailwind Config)
```javascript
spotify: {
    green: '#1DB954',     // Primary accent
    black: '#191414',     // Dark background
    dark: '#121212',      // Darker background
    gray: '#282828',      // Card background
    lightgray: '#b3b3b3'  // Text secondary
}
```

### Typography
- **Font**: Circular (Spotify font) dengan fallback ke system fonts
- **Headings**: Font-black (900) dengan sizes dari 2xl hingga 7xl
- **Body**: Font-semibold atau font-normal
- **Code**: Monospace dengan bg-spotify-gray

### Components

#### Sidebar
- Fixed width (w-64)
- Black background dengan border-right
- Active state dengan bg-spotify-gray
- Logo dengan transform scale on hover

#### Player Bar
- Bottom fixed position
- Play/pause controls dengan SVG icons
- Progress bar dengan hover state
- Volume slider

#### Cards
```html
<!-- Stat Card -->
<div class="bg-spotify-gray hover:bg-spotify-gray/80 transition rounded-lg p-6">
  <!-- Content -->
  <div class="h-1 bg-spotify-green group-hover:scale-x-100"></div>
</div>

<!-- Server Card -->
<div class="bg-spotify-gray hover:bg-spotify-gray/60 p-4 rounded-lg group">
  <img class="aspect-square rounded-md">
  <h3 class="font-semibold truncate"></h3>
</div>
```

## 📁 Project Structure

```
bot-discord/
├── views/
│   ├── index.ejs           # Home page
│   ├── server.ejs          # Server detail
│   ├── commands.ejs        # Commands list
│   ├── 404.ejs             # Error page
│   └── partials/
│       ├── sidebar.ejs     # Left navigation
│       ├── topbar.ejs      # Top header
│       ├── player.ejs      # Bottom player
│       ├── navbar.ejs      # Old navbar (deprecated)
│       └── footer.ejs      # Old footer (deprecated)
├── public/
│   ├── css/
│   │   └── style.css       # Old custom CSS (replaced by Tailwind)
│   └── js/
│       └── dashboard.js    # WebSocket client & controls
├── dashboard.js            # Express server
├── index.js                # Discord bot
├── package.json
└── .env
```

## 🔧 Technical Stack

### Frontend
- **Tailwind CSS 3.x** (CDN) - Utility-first CSS framework
- **EJS** - Templating engine
- **Vanilla JavaScript** - WebSocket client

### Backend
- **Express 4.18.2** - Web server
- **WebSocket (ws 8.14.2)** - Real-time communication
- **Discord.js 14.14.1** - Bot framework

### Features Integration
- **play-dl** - SoundCloud streaming
- **@google/generative-ai** - Gemini AI autoplay
- **@discordjs/voice** - Voice connections

## 🎮 Dashboard Features

### Current Implementation
✅ Spotify-like dark theme  
✅ Responsive grid layouts  
✅ WebSocket server setup  
✅ Discord presence updates  
✅ Server list dengan play indicators  
✅ Queue display dengan thumbnails  
✅ Settings cards (Volume, Quality, AI)  

### Planned Features
🔄 Real-time queue updates via WebSocket  
🔄 Play/pause controls dari dashboard  
🔄 Volume control dari dashboard  
🔄 Search functionality  
🔄 Authentication (Discord OAuth2)  
🔄 Mobile responsive improvements  

## 📝 Commands Available

### Playback (6 commands)
- `joshua play <song>` / `p` - Play dari SoundCloud
- `joshua pause` - Pause playback
- `joshua resume` - Resume playback
- `joshua skip` / `s` - Skip song
- `joshua stop` - Stop dan clear queue
- `joshua nowplaying` / `np` - Show current song

### Queue (4 commands)
- `joshua queue` / `q` - Show queue
- `joshua clear` - Clear queue
- `joshua shuffle` - Smart shuffle
- `joshua repeat [off/song/queue]` - Repeat mode

### Settings (2 commands)
- `joshua volume <0-100>` - Adjust volume
- `joshua autoplay [on/off]` / `ai` - Toggle AI autoplay

### Info (1 command)
- `joshua help` - Show help menu

## 🌐 API Endpoints

```javascript
GET /                           // Home page
GET /server/:guildId            // Server detail
GET /commands                   // Command list
GET /stats                      // Statistics (future)
GET /api/guilds                 // Get all guilds
GET /api/server/:guildId/queue  // Get server queue
```

## 🔌 WebSocket Events

### Client → Server
```javascript
ws.send(JSON.stringify({
    type: 'requestUpdate'
}));
```

### Server → Client
```javascript
// Queue Update
{
    type: 'queueUpdate',
    guildId: 'string',
    queue: {
        songs: [...],
        isPlaying: boolean,
        isPaused: boolean,
        repeatMode: string,
        isShuffled: boolean
    }
}

// Now Playing
{
    type: 'nowPlaying',
    song: {
        title: string,
        artist: string,
        thumbnail: string,
        duration: number,
        isPlaying: boolean
    }
}
```

## 🎯 Usage Tips

1. **Tailwind Classes**: Semua styling menggunakan utility classes, tidak ada custom CSS
2. **Color System**: Gunakan `bg-spotify-green`, `text-spotify-lightgray`, dll
3. **Responsive**: Grid dengan `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
4. **Hover States**: Tambahkan `hover:` prefix untuk interactions
5. **Transitions**: `transition` class untuk smooth animations

## 🐛 Troubleshooting

### Dashboard tidak loading
```bash
# Check apakah port 3000 sudah digunakan
netstat -ano | findstr :3000

# Restart dashboard
node dashboard.js
```

### WebSocket tidak connect
- Pastikan dashboard server running
- Check browser console untuk errors
- Verify WebSocket upgrade di dashboard.js

### Tailwind classes tidak apply
- CDN Tailwind harus loaded (check network tab)
- Gunakan class names yang valid
- Refresh browser dengan Ctrl+F5

## 📄 License

MIT License - Free to use and modify

## 👥 Credits

- **Discord.js** - Discord bot framework
- **Tailwind CSS** - UI framework
- **Spotify** - Design inspiration
- **Google Gemini** - AI autoplay

---

**Dashboard URL**: http://localhost:3000  
**Bot Prefix**: `joshua`  
**Support**: Create an issue on GitHub
