# 🚀 Server Deployment Guide - Dashboard Access

## 📍 Akses Dashboard di Server

Jika bot sudah di-deploy ke server dengan IP **`20.17.97.248`**, ikuti langkah berikut:

---

## ✅ Konfigurasi yang Diperlukan

### 1. **Update .env File di Server**

Tambahkan konfigurasi dashboard host:

```env
# Dashboard Configuration
DASHBOARD_PORT=3000
DASHBOARD_HOST=0.0.0.0
```

**`DASHBOARD_HOST=0.0.0.0`** memungkinkan dashboard diakses dari **semua IP** (bukan hanya localhost).

### 2. **Update dashboard.js**

Pastikan dashboard listen ke semua network interfaces:

```javascript
const PORT = process.env.DASHBOARD_PORT || 3000;
const HOST = process.env.DASHBOARD_HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`🌐 Dashboard running at http://${HOST}:${PORT}`);
    console.log(`📊 Access from: http://20.17.97.248:${PORT}`);
});
```

### 3. **Firewall Configuration**

Pastikan port 3000 **terbuka** di server firewall:

**Untuk Linux (Ubuntu/Debian):**
```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

**Untuk Windows Server:**
```powershell
New-NetFirewallRule -DisplayName "Dashboard Port 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

**Untuk Cloud Provider (Azure/AWS/GCP):**
- Buka **Network Security Group** / **Security Group**
- Add inbound rule: **Port 3000, TCP, Source: 0.0.0.0/0**

---

## 🌐 URL Akses

Setelah konfigurasi selesai, akses dashboard via:

### **Public URL:**
```
http://20.17.97.248:3000
```

### **Server Routes:**
- **Home:** `http://20.17.97.248:3000/`
- **Server Detail:** `http://20.17.97.248:3000/server/{SERVER_ID}`
- **API:** `http://20.17.97.248:3000/api/guilds`

---

## 🔧 Setup di Server

### **Step 1: Upload Files ke Server**

Upload semua file bot ke server:

```bash
# Via SCP/SFTP
scp -r bot-discord/ user@20.17.97.248:/home/user/

# Atau clone dari GitHub
git clone https://github.com/ahmaddery/bot-discord.git
cd bot-discord
```

### **Step 2: Install Dependencies**

```bash
npm install
```

### **Step 3: Configure .env**

Edit file `.env` di server:

```bash
nano .env
```

Tambahkan:
```env
DISCORD_TOKEN=your_token_here
CLIENT_ID=your_client_id
GEMINI_API_KEY=your_gemini_key
DASHBOARD_PORT=3000
DASHBOARD_HOST=0.0.0.0
```

### **Step 4: Start dengan PM2** (Recommended)

PM2 akan menjalankan bot **persistent** bahkan setelah restart:

```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start index.js --name discord-bot

# Start dashboard
pm2 start dashboard.js --name dashboard

# Save configuration
pm2 save

# Auto-start on reboot
pm2 startup
```

### **Step 5: Verify Services**

```bash
# Check status
pm2 status

# View logs
pm2 logs dashboard
pm2 logs discord-bot
```

---

## 🔒 Production Security

### **1. Reverse Proxy dengan Nginx** (Recommended)

Gunakan Nginx untuk **HTTPS** dan **custom domain**:

#### Install Nginx:
```bash
sudo apt install nginx
```

#### Configure Nginx:
```bash
sudo nano /etc/nginx/sites-available/dashboard
```

```nginx
server {
    listen 80;
    server_name 20.17.97.248;  # Atau gunakan domain: bot.yourdomain.com
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

#### Enable Site:
```bash
sudo ln -s /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Access tanpa port:**
```
http://20.17.97.248  (port 80, otomatis)
```

### **2. SSL/HTTPS dengan Let's Encrypt** (Optional)

Jika punya domain (misal: `bot.yourdomain.com`):

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL Certificate
sudo certbot --nginx -d bot.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

**Access dengan HTTPS:**
```
https://bot.yourdomain.com
```

### **3. Basic Authentication** (Tambahan Keamanan)

Edit `dashboard.js` untuk add password protection:

```javascript
const basicAuth = require('express-basic-auth');

app.use(basicAuth({
    users: { 'admin': 'password123' },  // Ganti dengan password kuat
    challenge: true,
    realm: 'Dashboard'
}));
```

Install dependency:
```bash
npm install express-basic-auth
```

---

## 📊 Monitoring

### **1. Check Dashboard Status**

```bash
# Via curl
curl http://20.17.97.248:3000

# Via PM2
pm2 status dashboard
pm2 logs dashboard --lines 50
```

### **2. Check Port Listening**

```bash
# Linux
sudo netstat -tulpn | grep :3000
sudo lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

### **3. Check Firewall**

```bash
# Linux
sudo ufw status

# Windows
Get-NetFirewallRule -DisplayName "Dashboard*"
```

---

## 🐛 Troubleshooting

### **Problem 1: Cannot Access Dashboard**

**Symptoms:** `http://20.17.97.248:3000` tidak bisa diakses

**Solutions:**
1. ✅ Check dashboard running: `pm2 status`
2. ✅ Check firewall: `sudo ufw status`
3. ✅ Check port binding: `netstat -tulpn | grep :3000`
4. ✅ Verify `DASHBOARD_HOST=0.0.0.0` di `.env`
5. ✅ Check cloud security group (Azure/AWS)

### **Problem 2: WebSocket Connection Failed**

**Symptoms:** Real-time updates tidak jalan

**Solutions:**
1. ✅ Check Nginx config untuk WebSocket support
2. ✅ Verify `Upgrade` headers di proxy config
3. ✅ Check browser console untuk WebSocket errors
4. ✅ Test direct connection: `ws://20.17.97.248:3000`

### **Problem 3: Dashboard Loads but Server List Empty**

**Symptoms:** Dashboard terbuka tapi tidak ada server

**Solutions:**
1. ✅ Check bot connection: `pm2 logs discord-bot`
2. ✅ Verify `DISCORD_TOKEN` correct di `.env`
3. ✅ Check bot permissions di Discord Developer Portal
4. ✅ Restart both services: `pm2 restart all`

---

## 📝 Quick Commands Reference

### **Start Services:**
```bash
pm2 start index.js --name discord-bot
pm2 start dashboard.js --name dashboard
pm2 save
```

### **Stop Services:**
```bash
pm2 stop discord-bot
pm2 stop dashboard
```

### **Restart Services:**
```bash
pm2 restart discord-bot
pm2 restart dashboard
# Atau restart semua
pm2 restart all
```

### **View Logs:**
```bash
pm2 logs dashboard --lines 100
pm2 logs discord-bot --lines 100
```

### **Monitor Real-time:**
```bash
pm2 monit
```

---

## 🌍 Environment Variables Summary

```env
# Discord Configuration
DISCORD_TOKEN=your_discord_token
CLIENT_ID=your_client_id

# Gemini AI
GEMINI_API_KEY=your_gemini_key

# Dashboard Configuration
DASHBOARD_PORT=3000
DASHBOARD_HOST=0.0.0.0

# Optional: Production Settings
NODE_ENV=production
```

---

## 🎯 Access URLs

### **Development (Local):**
```
http://localhost:3000
```

### **Production (Direct IP):**
```
http://20.17.97.248:3000
```

### **Production (Nginx):**
```
http://20.17.97.248
```

### **Production (SSL):**
```
https://bot.yourdomain.com
```

---

## 📦 Deployment Checklist

- [ ] Upload files ke server
- [ ] Install dependencies (`npm install`)
- [ ] Configure `.env` dengan token yang benar
- [ ] Set `DASHBOARD_HOST=0.0.0.0`
- [ ] Open firewall port 3000
- [ ] Configure cloud security group
- [ ] Install PM2
- [ ] Start bot dan dashboard dengan PM2
- [ ] Test access `http://20.17.97.248:3000`
- [ ] (Optional) Setup Nginx reverse proxy
- [ ] (Optional) Setup SSL dengan Let's Encrypt
- [ ] (Optional) Add basic authentication
- [ ] Save PM2 configuration
- [ ] Enable PM2 startup on reboot

---

**Dashboard Production URL:** http://20.17.97.248:3000  
**Bot Repository:** https://github.com/ahmaddery/bot-discord

Selamat! Dashboard sudah bisa diakses dari mana saja! 🚀
