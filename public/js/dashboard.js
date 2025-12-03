// WebSocket connection for real-time updates
let ws = null;
let reconnectInterval = null;
let currentGuildId = null;

// Get guild ID from URL if on server page
function getCurrentGuildId() {
    const path = window.location.pathname;
    const match = path.match(/\/server\/(\d+)/);
    return match ? match[1] : null;
}

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('✅ Connected to dashboard WebSocket');
        clearInterval(reconnectInterval);
        reconnectInterval = null;
        
        // Set current guild ID
        currentGuildId = getCurrentGuildId();
        
        // Request initial update with guild ID
        if (currentGuildId) {
            console.log('📡 Requesting initial update for guild:', currentGuildId);
            ws.send(JSON.stringify({ 
                type: 'requestUpdate',
                guildId: currentGuildId
            }));
        }
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 WebSocket message received:', data.type, data);
            
            if (data.type === 'queueUpdate') {
                console.log('🎵 Queue update for guild:', data.guildId, 'Current guild:', currentGuildId);
                updateQueue(data.guildId, data.queue);
                updateNowPlaying(data.queue);
            } else if (data.type === 'nowPlaying') {
                updateNowPlaying(data.song);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
    
    ws.onclose = () => {
        console.log('❌ Disconnected from WebSocket');
        
        // Attempt to reconnect
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                console.log('🔄 Attempting to reconnect...');
                connectWebSocket();
            }, 5000);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
// Update queue display
function updateQueue(guildId, queue) {
    console.log('🔄 updateQueue called:', { guildId, currentGuildId, queue });
    
    // Only update if we're on the same server page
    if (currentGuildId && currentGuildId !== guildId) {
        console.log('⏭️ Skipping update - different guild');
        return;
    }
    
    const queueContainer = document.getElementById('queue-list');
    if (!queueContainer) {
        console.log('❌ Queue container not found');
        return;
    }
    
    if (!queue || !queue.songs || queue.songs.length === 0) {
        console.log('📭 Queue is empty');
        queueContainer.innerHTML = '<div class="text-center text-spotify-lightgray py-8">No songs in queue</div>';
        return;
    }
    
    console.log('✅ Updating queue with', queue.songs.length, 'songs');
    
    queueContainer.innerHTML = queue.songs.map((song, index) => `
        <div class="flex items-center space-x-4 p-4 rounded-lg ${index === 0 ? 'bg-spotify-gray' : 'hover:bg-spotify-gray/50'} transition group">
            <span class="text-spotify-lightgray w-8 text-center font-semibold">
                ${index === 0 && queue.isPlaying ? 
                    (queue.isPaused ? 
                        '<svg class="w-5 h-5 mx-auto text-spotify-green" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>' :
                        '<svg class="w-5 h-5 mx-auto text-spotify-green animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>'
                    ) : 
                    index + 1
                }
            </span>
            <img src="${song.thumbnail || '/img/default-album.png'}" alt="${song.title}" class="w-14 h-14 rounded object-cover flex-shrink-0 shadow-lg">
            <div class="flex-1 min-w-0">
                <p class="font-semibold truncate ${index === 0 ? 'text-spotify-green' : ''}">${song.title}</p>
                <p class="text-sm text-spotify-lightgray truncate">👤 ${song.requester || 'Unknown'}</p>
            </div>
            <span class="text-sm text-spotify-lightgray">⏱️ ${song.duration}</span>
            ${index === 0 && queue.isPlaying ? '<span class="text-spotify-green">●</span>' : ''}
        </div>
    `).join('');
}

// Update now playing bar
function updateNowPlaying(queueOrSong) {
    const titleEl = document.getElementById('player-title');
    const artistEl = document.getElementById('player-artist');
    const thumbnailEl = document.getElementById('player-thumbnail');
    const placeholderEl = document.getElementById('player-placeholder');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    
    if (!titleEl) return;
    
    let song = null;
    let isPaused = false;
    
    // Handle queue object or song object
    if (queueOrSong) {
        if (queueOrSong.songs && queueOrSong.songs.length > 0) {
            song = queueOrSong.songs[0];
            isPaused = queueOrSong.isPaused;
        } else if (queueOrSong.title) {
            song = queueOrSong;
            isPaused = queueOrSong.isPaused || false;
        }
    }
    
    if (!song) {
        titleEl.textContent = 'No song playing';
        artistEl.textContent = 'Use dashboard to add songs';
        thumbnailEl.classList.add('hidden');
        placeholderEl.classList.remove('hidden');
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        return;
    }
    
    titleEl.textContent = song.title;
    artistEl.textContent = song.requester || 'Unknown Artist';
    
    if (song.thumbnail) {
        thumbnailEl.src = song.thumbnail;
        thumbnailEl.classList.remove('hidden');
        placeholderEl.classList.add('hidden');
    }
    
    if (isPaused) {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    } else {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    }
}

// Format duration (seconds to mm:ss)
function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// API call helpers
async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(endpoint, options);
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Control functions
async function playPause() {
    if (!currentGuildId) return;
    
    const queue = await apiRequest(`/api/server/${currentGuildId}/queue`);
    
    if (queue.isPaused) {
        await apiRequest(`/api/server/${currentGuildId}/resume`, 'POST');
    } else {
        await apiRequest(`/api/server/${currentGuildId}/pause`, 'POST');
    }
}

async function skipSong() {
    if (!currentGuildId) return;
    await apiRequest(`/api/server/${currentGuildId}/skip`, 'POST');
}

async function stopPlayback() {
    if (!currentGuildId) return;
    if (confirm('Stop playback and clear queue?')) {
        await apiRequest(`/api/server/${currentGuildId}/stop`, 'POST');
    }
}

async function changeVolume(volume) {
    if (!currentGuildId) return;
    await apiRequest(`/api/server/${currentGuildId}/volume`, 'POST', { volume });
}

async function requestSong() {
    if (!currentGuildId) return;
    
    const query = prompt('Enter song name or URL:');
    if (!query) return;
    
    try {
        const result = await apiRequest(`/api/server/${currentGuildId}/play`, 'POST', { query });
        if (result.success) {
            alert(`Added: ${result.song.title}`);
        } else {
            alert('Failed to add song: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Error adding song: ' + error.message);
    }
}

// Player controls
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard initialized');
    
    // Get current guild ID
    currentGuildId = getCurrentGuildId();
    console.log('📍 Current guild ID:', currentGuildId);
    
    // Connect WebSocket
    connectWebSocket();
    console.log('🔌 WebSocket connection initiated');
    
    // Play/Pause button
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', playPause);
    }
    
    // Skip buttons
    document.querySelectorAll('[data-action="skip"]').forEach(btn => {
        btn.addEventListener('click', skipSong);
    });
    
    // Add song button
    const addSongBtn = document.getElementById('add-song-btn');
    if (addSongBtn) {
        addSongBtn.addEventListener('click', requestSong);
    }
    
    // Volume control
    const volumeBar = document.getElementById('volume-bar');
    if (volumeBar && volumeBar.parentElement) {
        volumeBar.parentElement.addEventListener('click', async (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = Math.round(((e.clientX - rect.left) / rect.width) * 100);
            volumeBar.style.width = `${percent}%`;
            await changeVolume(percent);
        });
    }
    
    // Progress bar (future implementation)
    const progressBar = document.getElementById('progress-bar');
    if (progressBar && progressBar.parentElement) {
        progressBar.parentElement.addEventListener('click', (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            progressBar.style.width = `${percent}%`;
            // TODO: Send seek command to server
            console.log('Seek:', percent);
        });
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (ws) {
        ws.close();
    }
});
