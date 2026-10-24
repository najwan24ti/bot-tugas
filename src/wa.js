// Saluran WhatsApp (Baileys, tanpa browser)
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const { handle, handleFile } = require('./perintah');

const OWNER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const AUTH_DIR = path.join(__dirname, '..', 'auth_wa');

// Semua pesan bot diawali karakter tak terlihat ini, supaya bot tidak membalas dirinya sendiri
const MARK = '​';

let sock = null;
let baileys = null;
const myIds = new Set();
const sentIds = new Set(); // pesan yang dikirim bot sendiri, supaya tidak diproses ulang

function nomor(jid) {
  return (jid || '').split('@')[0].split(':')[0];
}

function isiPesan(m) {
  return baileys.normalizeMessageContent(m.message) || {};
}

function teksPesan(m) {
  const msg = isiPesan(m);
  return msg.conversation || msg.extendedTextMessage?.text || '';
}

// File/foto yang dikirim: { caption, fileName }
function mediaPesan(m) {
  const msg = isiPesan(m);
  const jenis = ['documentMessage', 'imageMessage', 'videoMessage', 'audioMessage'].find((k) => msg[k]);
  if (!jenis) return null;
  const isi = msg[jenis];
  const ext = { imageMessage: 'jpg', videoMessage: 'mp4', audioMessage: 'ogg' }[jenis];
  const fileName = isi.fileName || `${jenis.replace('Message', '')}-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.${ext}`;
  return { caption: (isi.caption || '').trim(), fileName };
}

async function kirim(jid, content) {
  const res = await sock.sendMessage(jid, content);
  if (res?.key?.id) {
    sentIds.add(res.key.id);
    if (sentIds.size > 500) sentIds.delete(sentIds.values().next().value);
  }
}

// Hasil dari handle(): string atau { teks, dokumen: { buffer | path, fileName, mimetype } }
async function kirimHasilKe(jid, hasil) {
  if (!hasil) return;
  if (typeof hasil === 'string') return kirim(jid, { text: MARK + hasil });
  const d = hasil.dokumen;
  await kirim(jid, {
    document: d.buffer || { url: d.path },
    fileName: d.fileName,
    mimetype: d.mimetype,
    caption: MARK + (hasil.teks || ''),
  });
}

function siap() {
  return Boolean(sock?.user);
}

function ownerJid() {
  return OWNER ? `${OWNER}@s.whatsapp.net` : baileys.jidNormalizedUser(sock.user.id);
}

// Kirim notifikasi ke pemilik (dipakai tugas terjadwal)
async function kirimHasil(hasil) {
  if (!siap()) throw new Error('WhatsApp belum tersambung');
  await kirimHasilKe(ownerJid(), hasil);
}

// Hanya layani: chat ke diri sendiri, atau pesan dari OWNER_NUMBER
function targetChat(m) {
  const jid = m.key.remoteJid;
  if (!jid || baileys.isJidGroup(jid) || jid.endsWith('@broadcast')) return null;
  const alt = m.key.remoteJidAlt;
  if (m.key.fromMe) return myIds.has(jid) || myIds.has(alt) ? jid : null;
  if (!OWNER) return null;
  const pn = baileys.isLidUser(jid) ? alt : jid;
  return pn && nomor(pn) === OWNER ? jid : null;
}

async function onMessage(m) {
  if (!m.message || sentIds.has(m.key.id)) return;
  // Abaikan pesan lama (misalnya riwayat yang tersinkron saat bot baru nyambung)
  if (Date.now() / 1000 - Number(m.messageTimestamp || 0) > 120) return;

  const media = mediaPesan(m);
  const body = media ? null : teksPesan(m);
  if (media ? media.caption.startsWith(MARK) : !body || body.startsWith(MARK)) return;

  const jid = targetChat(m);
  if (!jid) return;

  try {
    const hasil = media
      ? await handleFile({
          ...media,
          unduh: () => baileys.downloadMediaMessage(m, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }),
        })
      : await handle(body);
    if (!hasil) return;
    console.log(`[WA] "${(body || media.fileName).slice(0, 40)}" → membalas`);
    await kirimHasilKe(jid, hasil);
  } catch (err) {
    console.error('[WA] Error:', err);
    await kirimHasilKe(jid, `⚠️ Terjadi kesalahan: ${err.message}`).catch(() => {});
  }
}

async function connect() {
  const { state, saveCreds } = await baileys.useMultiFileAuthState(AUTH_DIR);
  const { version } = await baileys.fetchLatestBaileysVersion().catch(() => ({}));

  sock = baileys.default({
    auth: state,
    version,
    logger: pino({ level: 'silent' }),
    browser: baileys.Browsers.windows('Bot Tugas'),
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('[WA] Scan QR ini di WhatsApp → Perangkat tertaut → Tautkan perangkat:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      myIds.clear();
      myIds.add(baileys.jidNormalizedUser(sock.user.id));
      if (sock.user.lid) myIds.add(baileys.jidNormalizedUser(sock.user.lid));
      console.log('✅ [WA] WhatsApp siap!');
      console.log(OWNER ? `[WA] Melayani nomor ${OWNER}` : '[WA] Melayani chat ke diri sendiri ("Message yourself")');
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === baileys.DisconnectReason.loggedOut) {
        console.log('❌ [WA] Logout. Menghapus sesi lama, QR baru akan muncul...');
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      } else {
        console.log(`[WA] Koneksi terputus (kode ${code}), menyambung ulang...`);
      }
      setTimeout(connect, 3000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const m of messages) await onMessage(m);
  });
}

async function start() {
  baileys = await import('@whiskeysockets/baileys');
  await connect();
}

module.exports = { start, kirimHasil, siap };
