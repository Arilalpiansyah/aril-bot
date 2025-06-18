const { WAConnection, MessageType, Mimetype } = require('@adiwajshing/baileys')
const fs = require('fs')
const axios = require('axios')
const ffmpeg = require('fluent-ffmpeg')
const ytdl = require('ytdl-core')
const NodeCache = require('node-cache')
const cache = new NodeCache({ stdTTL: 600 })

// ================= KONFIGURASI UTAMA =================
const API_CONFIG = {
  TIKTOK: 'https://api.tiklydown.eu.org/api/download?url=',
  YOUTUBE_SEARCH: 'https://www.googleapis.com/youtube/v3/search',
  PINTEREST: 'https://pinterest-api-wrapper.vercel.app/?search=',
  YOUTUBE_API_KEY: 'AIzaSyBzQK8p1j7qXZQYQZQYQZQYQZQYQZQYQZQY'
}

const conn = new WAConnection()
const SESSION_FILE = './session.json'
const OWNER_NUMBER = '6283141025627@c.us' // Nomor owner Anda

// ================= SISTEM LIMIT =================
const userLimits = new Map();
const DAILY_LIMIT_REGULAR = 50; // Limit harian untuk user biasa
const PREMIUM_USERS = new Set(); // Set untuk menyimpan user premium

// Fungsi reset limit harian (setiap hari jam 00:00)
function resetDailyLimits() {
  const now = new Date();
  const nextDay = new Date(now);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(0, 0, 0, 0);
  
  const timeout = nextDay.getTime() - now.getTime();
  
  setTimeout(() => {
    userLimits.clear();
    console.log('🔄 Limit harian telah direset');
    resetDailyLimits(); // Jadwalkan reset berikutnya
  }, timeout);
}

// Mulai reset harian
resetDailyLimits();

// Cek limit pengguna
function checkLimit(sender) {
  if (sender === OWNER_NUMBER) return true; // Owner unlimited
  
  if (PREMIUM_USERS.has(sender)) return true; // Premium unlimited
  
  if (!userLimits.has(sender)) {
    userLimits.set(sender, DAILY_LIMIT_REGULAR);
  }
  
  const remaining = userLimits.get(sender);
  return remaining > 0;
}

// Kurangi limit pengguna
function decreaseLimit(sender) {
  if (sender === OWNER_NUMBER) return; // Owner tidak dikurangi
  if (PREMIUM_USERS.has(sender)) return; // Premium tidak dikurangi
  
  if (!userLimits.has(sender)) {
    userLimits.set(sender, DAILY_LIMIT_REGULAR - 1);
  } else {
    userLimits.set(sender, userLimits.get(sender) - 1);
  }
}

// ================= FUNGSI UTILITAS =================
async function downloadMedia(url, path) {
  const response = await axios.get(url, { responseType: 'arraybuffer' })
  fs.writeFileSync(path, response.data)
  return path
}

// Format tanggal Indonesia
function formatIndonesianDate(date) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  const day = days[date.getDay()];
  const tanggal = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const jam = date.getHours().toString().padStart(2, '0');
  const menit = date.getMinutes().toString().padStart(2, '0');
  const detik = date.getSeconds().toString().padStart(2, '0');
  
  return {
    dateString: `${day}, ${tanggal} ${month} ${year}`,
    timeString: `${jam}:${menit}:${detik}`
  };
}

// ================= SETUP SESSION =================
if(fs.existsSync(SESSION_FILE)) {
  conn.loadAuthInfo(JSON.parse(fs.readFileSync(SESSION_FILE)))
}

conn.on('credentials-updated', () => {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(conn.base64EncodedAuthInfo()))
})

// ================= SETUP PAIRING =================
conn.connectOptions = {
  qrMaxRetries: 0, // Nonaktifkan QR
  phoneResponseTime: 60000
}

conn.on('connection-validated', (validation) => {
  console.log(`\n\n🔥 KODE PAIRING: ${validation}\n`)
  console.log('1. Buka WhatsApp di HP')
  console.log('2. Settings → Linked Devices → Link a Device')
  console.log('3. Masukkan kode di atas\n')
})

// Simpan data user
const userData = new Map();

// ================= IMPLEMENTASI FITUR =================
conn.on('chat-update', async update => {
  if(!update.messages) return
  const message = update.messages.all()[0]
  if(!message.message) return
  
  const content = JSON.stringify(message.message)
  const from = message.key.remoteJid
  const type = Object.keys(message.message)[0]
  const isGroup = from.endsWith('@g.us')
  const sender = isGroup ? message.key.participant : from
  const body = type === 'conversation' ? message.message.conversation : 
              (type === 'extendedTextMessage') ? message.message.extendedTextMessage.text : ''

  // Inisialisasi data user
  if(!userData.has(sender)) {
    userData.set(sender, {
      name: 'Rilzz',
      money: 10000,
      level: 'FREE'
    })
  }
  const userInfo = userData.get(sender);
  
  // Cek status premium
  const isPremium = PREMIUM_USERS.has(sender);
  const userStatus = isPremium ? 'PREMIUM' : userInfo.level;

  // [A] FITUR .MENU (TIDAK PAKE LIMIT)
  if(body === '.menu') {
    const now = new Date();
    const { dateString, timeString } = formatIndonesianDate(now);
    const userJid = sender.split('@')[0];
    const ownerJid = OWNER_NUMBER.split('@')[0];
    
    // Hitung sisa limit
    const remainingLimit = checkLimit(sender) ? 
      (sender === OWNER_NUMBER ? 'Unlimited' : 
       isPremium ? 'Unlimited' : userLimits.get(sender) || DAILY_LIMIT_REGULAR) : 0;
    
    const menuMessage = `
*BOT RILZZ*

╭─「 *USER INFO* 」
│ • *Nama* : ${userInfo.name}
│ • *Id* : @${userJid}
│ • *User* : ${userStatus}
│ • *Limit* : ${remainingLimit}
│ • *Uang* : ${userInfo.money.toLocaleString('id-ID')}
╰───────────

╭─「 *BOT INFO* 」
│ • *Nama Bot* : Aril Bot
│ • *Powered* : @WhatsApp
│ • *Owner* : @${ownerJid}
│ • *Mode* : Public
│ • *Prefix* : .
╰───────────

╭─「 *ABOUT* 」
│ • *Tanggal* : ${dateString}
│ • *Hari* : ${dateString.split(', ')[0]}
│ • *Jam* : ${timeString} WIB
╰───────────

╭─「 *TOP MENU* 」
│ • ai
│ • brat
│ • tiktok
│ • cekmati
│ • susunkata
│ • downloader
│ • stiker
│ • grup
│ • tools
│ • edukasi
╰───────────

*Ketik .help [command] untuk info lebih detail*
Contoh: .help stiker
    `.trim();

    // Kirim pesan menu
    conn.sendMessage(from, 
      menuMessage, 
      MessageType.extendedText,
      { 
        contextInfo: {
          mentionedJid: [sender, OWNER_NUMBER],
          forwardingScore: 999,
          isForwarded: true
        }
      }
    );
    return;
  }

  // [B] PERINTAH KHUSUS OWNER
  if (sender === OWNER_NUMBER) {
    // Tambahkan user premium
    if (body.startsWith('!premium ')) {
      const mentioned = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (mentioned.length > 0) {
        PREMIUM_USERS.add(mentioned[0]);
        conn.sendMessage(from, 
          `🌟 @${mentioned[0].split('@')[0]} sekarang user PREMIUM!`, 
          MessageType.text,
          { contextInfo: { mentionedJid: mentioned } }
        );
      }
      return;
    }
    
    // Hapus user premium
    if (body.startsWith('!unpremium ')) {
      const mentioned = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (mentioned.length > 0) {
        PREMIUM_USERS.delete(mentioned[0]);
        conn.sendMessage(from, 
          `⚠️ @${mentioned[0].split('@')[0]} dihapus dari user PREMIUM!`, 
          MessageType.text,
          { contextInfo: { mentionedJid: mentioned } }
        );
      }
      return;
    }
  }

  // [C] CEK LIMIT UNTUK PERINTAH LAIN
  if (!checkLimit(sender)) {
    conn.sendMessage(from, 
      `❌ Limit harian Anda telah habis! 
Silakan tunggu hingga besok atau hubungi owner untuk upgrade premium.`,
      MessageType.text
    );
    return;
  }

  // [1] FITUR TAG ALL
  if(body === '!tagall' && isGroup) {
    decreaseLimit(sender); // Kurangi limit
    
    const groupInfo = await conn.groupMetadata(from)
    const participants = groupInfo.participants.map(p => p.jid)
    const mentions = participants.map(jid => `@${jid.split('@')[0]}`)
    
    conn.sendMessage(from, 
      `📢 Pemberitahuan Grup!\n${mentions.join('\n')}`, 
      MessageType.text,
      { contextInfo: { mentionedJid: participants } }
    )
  }

  // [2] KONVERSI MEDIA KE STICKER
  if((type === 'videoMessage' || type === 'imageMessage') && body.includes('!sticker')) {
    decreaseLimit(sender); // Kurangi limit
    
    const mediaBuffer = await conn.downloadMediaMessage(message)
    const outputPath = `./temp/sticker_${Date.now()}.webp`
    
    ffmpeg()
      .input(mediaBuffer)
      .inputOptions(type === 'videoMessage' ? ['-t 5'] : [])
      .outputOptions('-fs 1MB')
      .on('end', () => {
        conn.sendMessage(from, fs.readFileSync(outputPath), MessageType.sticker)
        fs.unlinkSync(outputPath)
      })
      .on('error', (err) => console.log('FFmpeg error:', err))
      .save(outputPath)
  }

  // [3] DOWNLOAD TIKTOK
  if(body.startsWith('!tt ')) {
    decreaseLimit(sender); // Kurangi limit
    
    const url = body.split(' ')[1]
    try {
      const response = await axios.get(`${API_CONFIG.TIKTOK}${encodeURIComponent(url)}`)
      const videoUrl = response.data.video?.noWatermark || response.data.video?.wm
      
      if(!videoUrl) throw new Error('Link TikTok tidak valid')
      
      const videoPath = `./temp/tiktok_${Date.now()}.mp4`
      await downloadMedia(videoUrl, videoPath)
      
      conn.sendMessage(from, fs.readFileSync(videoPath), MessageType.video)
      setTimeout(() => fs.unlinkSync(videoPath), 5000)
    } catch (e) {
      conn.sendMessage(from, `❌ Gagal download video TikTok: ${e.message}`, MessageType.text)
    }
  }

  // [4] DOWNLOAD YOUTUBE
  if(body.startsWith('!yt ')) {
    decreaseLimit(sender); // Kurangi limit
    
    const url = body.split(' ')[1]
    try {
      const info = await ytdl.getInfo(url)
      const format = ytdl.chooseFormat(info.formats, { quality: 'highest' })
      const videoPath = `./temp/youtube_${Date.now()}.mp4`
      
      ytdl(url, { format: format })
        .pipe(fs.createWriteStream(videoPath))
        .on('finish', () => {
          conn.sendMessage(from, fs.readFileSync(videoPath), MessageType.video)
          setTimeout(() => fs.unlinkSync(videoPath), 5000)
        })
    } catch (e) {
      conn.sendMessage(from, `❌ Gagal download video YouTube: ${e.message}`, MessageType.text)
    }
  }

  // [5] SEARCH YOUTUBE (Menggunakan API Key)
  if(body.startsWith('!ytsearch ')) {
    decreaseLimit(sender); // Kurangi limit
    
    const query = body.split(' ').slice(1).join(' ')
    try {
      const response = await axios.get(API_CONFIG.YOUTUBE_SEARCH, {
        params: {
          part: 'snippet',
          q: query,
          maxResults: 5,
          key: API_CONFIG.YOUTUBE_API_KEY,
          type: 'video'
        }
      })
      
      let reply = '🔍 Hasil Pencarian YouTube:\n\n'
      response.data.items.forEach((item, i) => {
        const videoId = item.id.videoId;
        const title = item.snippet.title;
        reply += `${i+1}. ${title}\nhttps://youtu.be/${videoId}\n\n`
      })
      
      conn.sendMessage(from, reply, MessageType.text)
    } catch (e) {
      console.log(e)
      conn.sendMessage(from, '❌ Gagal mencari video YouTube', MessageType.text)
    }
  }

  // [6] SEARCH PINTEREST
  if(body.startsWith('!pinterest ')) {
    decreaseLimit(sender); // Kurangi limit
    
    const query = body.split(' ').slice(1).join(' ')
    try {
      const response = await axios.get(`${API_CONFIG.PINTEREST}${encodeURIComponent(query)}`)
      const images = response.data.slice(0, 3)
      
      for(const img of images) {
        const imagePath = `./temp/pinterest_${Date.now()}.jpg`
        await downloadMedia(img, imagePath)
        conn.sendMessage(from, fs.readFileSync(imagePath), MessageType.image)
        setTimeout(() => fs.unlinkSync(imagePath), 5000)
      }
    } catch (e) {
      conn.sendMessage(from, '❌ Gagal mencari gambar Pinterest', MessageType.text)
    }
  }

  // [7] KICK ANGGOTA GRUP
  if(body.startsWith('!kick ') && isGroup) {
    decreaseLimit(sender); // Kurangi limit
    
    const mentioned = message.message.extendedTextMessage?.contextInfo?.mentionedJid || []
    
    if(mentioned.length > 0 && (sender === OWNER_NUMBER || isGroup)) {
      await conn.groupRemove(from, mentioned)
      conn.sendMessage(from, 
        `🚫 ${mentioned.map(jid => `@${jid.split('@')[0]}`).join(' ')} telah di-kick!`, 
        MessageType.text,
        { contextInfo: { mentionedJid: mentioned } }
      )
    }
  }

  // [8] AUTO KICK LINK (TIDAK PAKE LIMIT)
  if(isGroup && sender !== OWNER_NUMBER) {
    // Auto kick link
    if(body.includes('http://') || body.includes('https://')) {
      await conn.groupRemove(from, [sender])
      conn.sendMessage(from, 
        `⚠️ @${sender.split('@')[0]} di-kick karena membagikan link!`, 
        MessageType.text,
        { contextInfo: { mentionedJid: [sender] } }
      )
      return
    }
  }

  // [9] SIMPAN MEDIA HD
  if(['imageMessage', 'videoMessage'].includes(type)) {
    decreaseLimit(sender); // Kurangi limit
    
    const buffer = await conn.downloadMediaMessage(message)
    const extension = type === 'imageMessage' ? 'jpg' : 'mp4'
    const filename = `./media/media_${Date.now()}.${extension}`
    
    // Buat folder media jika belum ada
    if (!fs.existsSync('./media')) {
      fs.mkdirSync('./media')
    }
    
    fs.writeFileSync(filename, buffer)
    conn.sendMessage(from, `✅ Media tersimpan sebagai: ${filename}`, MessageType.text)
  }

  // [10] CEK LIMIT
  if(body === '!limit') {
    const remaining = sender === OWNER_NUMBER ? 'Unlimited' : 
                     PREMIUM_USERS.has(sender) ? 'Unlimited' : 
                     userLimits.get(sender) || DAILY_LIMIT_REGULAR;
    
    const status = PREMIUM_USERS.has(sender) ? 'PREMIUM' : 'REGULAR';
    
    conn.sendMessage(from, 
      `📊 Limit Anda: ${remaining}\nStatus: ${status}`, 
      MessageType.text
    );
  }
})

// ================= JALANKAN BOT =================
conn.connect()
  .then(() => console.log('🤖 Bot Aril berhasil terhubung!'))
  .catch(err => console.log('❌ Koneksi error:', err))

// Auto reconnect
conn.on('close', ({ reason }) => {
  if(reason !== 'NAVIGATION') {
    console.log('⏳ Mencoba reconnect...')
    setTimeout(() => conn.connect(), 5000)
  }
})