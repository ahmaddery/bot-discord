# Cara Export Cookies YouTube (Format yang Benar)

## Metode 1: Export sebagai JSON (RECOMMENDED)

1. Install extension **EditThisCookie** di Chrome:
   - https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg

2. Buka https://youtube.com dan login

3. Klik extension EditThisCookie → Export (icon panah bawah)

4. Paste hasil export ke file `cookies.json` (bukan cookies.txt)

5. Update `index.js` untuk baca dari `cookies.json`

## Metode 2: Tanpa Cookies (Gunakan Proxy/VPN)

Jika YouTube terus block:
- Gunakan VPN di server Ubuntu
- Atau gunakan proxy untuk request YouTube
- Atau host bot di region yang tidak diblock (US/Singapore)

## Metode 3: Format Netscape (Manual)

Format cookies.txt harus seperti ini:
```
.youtube.com	TRUE	/	TRUE	1234567890	CONSENT	YES+cb
.youtube.com	TRUE	/	FALSE	1234567890	VISITOR_INFO1_LIVE	abcd1234
```

**PENTING:** 
- Tiap baris harus dipisah dengan TAB (bukan spasi)
- Format: domain [TAB] flag [TAB] path [TAB] secure [TAB] expiry [TAB] name [TAB] value
