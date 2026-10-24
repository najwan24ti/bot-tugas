// Saluran Telegram (Bot API resmi, pakai fetch bawaan Node, tanpa library tambahan)
const fs = require('fs');
const { handle, handleFile } = require('./perintah');

const TOKEN = (process.env.TELEGRAM_TOKEN || '').trim();
const OWNER_ID = (process.env.TELEGRAM_OWNER_ID || '').trim();
const API = process.env.TELEGRAM_API || 'https://api.telegram.org';
const BATAS_UNDUH = 20 * 1024 * 1024; // Bot API hanya bisa mengunduh file maks 20 MB
const BATAS_TEKS = 4000;

// Tombol pintas di bawah kolom chat
const KEYBOARD = {
  keyboard: [
    [{ text: '📝 Tugas minggu ini' }, { text: '⏳ Tugas belum' }],
    [{ text: '🗓️ Jadwal hari ini' }, { text: '🗓️ Jadwal besok' }],
    [{ text: '💰 Rekap' }, { text: '⏰ Pengingat' }],
    [{ text: '📁 File' }, { text: '🖥️ Status' }, { text: '📋 Menu' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

// Perintah garis miring (/tugas, /jadwal, ...) -> teks perintah biasa
const SLASH = {
  start: 'menu', menu: 'menu', help: 'menu',
  tugas: 'tugas minggu ini', belum: 'tugas belum', jadwal: 'jadwal', besok: 'jadwal besok',
  rekap: 'rekap', pengingat: 'pengingat', file: 'file', status: 'status', backup: 'backup',
};
const DAFTAR_SLASH = [
  ['tugas', 'Tugas minggu ini'], ['belum', 'Tugas yang belum dikumpulkan'], ['jadwal', 'Jadwal kuliah hari ini'],
  ['besok', 'Jadwal kuliah besok'], ['rekap', 'Rekap keuangan bulan ini'], ['pengingat', 'Daftar pengingat'],
  ['file', 'File tersimpan'], ['status', 'Status HP server'], ['backup', 'Backup data sekarang'], ['menu', 'Semua perintah'],
];

async function call(method, body) {
  const res = await fetch(`${API}/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(70000),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
}

async function upload(method, form) {
  const res = await fetch(`${API}/bot${TOKEN}/${method}`, { method: 'POST', body: form, signal: AbortSignal.timeout(300000) });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
}

// Ubah format WhatsApp (*tebal* _miring_ `kode`) ke HTML Telegram.
// Tanda hanya dihitung di batas kata, jadi "laporan_kppl.pdf" tidak dianggap miring.
function keHtml(teks) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return teks
    .split(/(`[^`\n]+`)/)
    .map((bagian, i) => {
      if (i % 2 === 1) return `<code>${esc(bagian.slice(1, -1))}</code>`;
      return esc(bagian)
        .replace(/(^|[\s(])\*([^*\n]+?)\*(?=$|[\s).,!?:;])/gm, '$1<b>$2</b>')
        .replace(/(^|[\s(])_([^_\n]+?)_(?=$|[\s).,!?:;])/gm, '$1<i>$2</i>');
    })
    .join('');
}

// Kalau HTML-nya tetap gagal diparse, kirim ulang sebagai teks biasa
async function kirimTeks(chatId, teks) {
  const potongan = [];
  for (let sisa = teks; sisa.length; ) {
    let cut = sisa.length <= BATAS_TEKS ? sisa.length : sisa.lastIndexOf('\n\n', BATAS_TEKS);
    if (cut <= 0) cut = BATAS_TEKS;
    potongan.push(sisa.slice(0, cut));
    sisa = sisa.slice(cut).replace(/^\n+/, '');
  }
  for (const p of potongan) {
    const body = { chat_id: chatId, reply_markup: KEYBOARD, link_preview_options: { is_disabled: true } };
    try {
      await call('sendMessage', { ...body, text: keHtml(p), parse_mode: 'HTML' });
    } catch (err) {
      if (!/parse entities/i.test(err.message)) throw err;
      await call('sendMessage', { ...body, text: p });
    }
  }
}

async function kirimHasilKe(chatId, hasil) {
  if (!hasil) return;
  if (typeof hasil === 'string') return kirimTeks(chatId, hasil);
  const d = hasil.dokumen;
  const isi = d.buffer || fs.readFileSync(d.path);
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('document', new Blob([isi], { type: d.mimetype }), d.fileName);
  if (hasil.teks) {
    form.append('caption', keHtml(hasil.teks.slice(0, 900)));
    form.append('parse_mode', 'HTML');
  }
  try {
    await upload('sendDocument', form);
  } catch (err) {
    if (!/parse entities/i.test(err.message)) throw err;
    form.delete('parse_mode');
    form.set('caption', hasil.teks.slice(0, 1000));
    await upload('sendDocument', form);
  }
}

function aktif() {
  return Boolean(TOKEN && OWNER_ID);
}

// Kirim notifikasi ke pemilik (dipakai tugas terjadwal)
async function kirimHasil(hasil) {
  if (!aktif()) throw new Error('Telegram belum diatur');
  await kirimHasilKe(OWNER_ID, hasil);
}

async function unduh(fileId) {
  const f = await call('getFile', { file_id: fileId });
  const res = await fetch(`${API}/file/bot${TOKEN}/${f.file_path}`, { signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`Gagal unduh file (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function onMessage(msg) {
  if (msg.chat.type !== 'private') return;
  // Abaikan pesan lama yang menumpuk saat bot mati lebih dari 2 menit
  if (Date.now() / 1000 - msg.date > 120) return;
  const chatId = msg.chat.id;

  if (!OWNER_ID) {
    return call('sendMessage', {
      chat_id: chatId,
      text: `👋 ID Telegram kamu: ${msg.from.id}\n\nIsi di file .env:\nTELEGRAM_OWNER_ID=${msg.from.id}\n\nlalu jalankan ulang bot.`,
    });
  }
  if (String(msg.from.id) !== OWNER_ID) {
    console.log(`[TG] Pesan dari orang lain diabaikan (id ${msg.from.id})`);
    return call('sendMessage', { chat_id: chatId, text: '🔒 Ini bot pribadi.' });
  }

  try {
    let hasil;
    const dok = msg.document || (msg.photo && msg.photo[msg.photo.length - 1]) || msg.video || msg.audio;
    if (dok) {
      if (dok.file_size > BATAS_UNDUH && /^(simpan|restore)\b/i.test(msg.caption || '')) {
        hasil = '⚠️ File lebih dari 20 MB, Telegram tidak mengizinkan bot mengunduhnya.';
      } else {
        const fileName = dok.file_name || `foto-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.jpg`;
        hasil = await handleFile({ caption: msg.caption, fileName, unduh: () => unduh(dok.file_id) });
        if (!hasil) hasil = '💡 Mau disimpan? Kirim ulang dengan caption `simpan <nama folder>`, contoh: `simpan big data`';
      }
    } else if (msg.text) {
      const slash = msg.text.match(/^\/(\w+)(?:@\w+)?\s*(.*)$/);
      const teks = slash ? (SLASH[slash[1].toLowerCase()] ? `${SLASH[slash[1].toLowerCase()]} ${slash[2]}`.trim() : slash[2]) : msg.text;
      call('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
      hasil = (await handle(teks)) || '🤔 Perintah tidak dikenal. Ketik `menu` atau pakai tombol di bawah.';
    }
    if (hasil) {
      console.log(`[TG] "${(msg.text || msg.caption || 'file').slice(0, 40)}" → membalas`);
      await kirimHasilKe(chatId, hasil);
    }
  } catch (err) {
    console.error('[TG] Error:', err);
    await kirimTeks(chatId, `⚠️ Terjadi kesalahan: ${err.message}`).catch(() => {});
  }
}

async function start() {
  const me = await call('getMe');
  console.log(`✅ [TG] Telegram siap: @${me.username}`);
  if (!OWNER_ID) console.log('[TG] TELEGRAM_OWNER_ID belum diisi: kirim pesan apa saja ke bot untuk tahu ID-mu.');
  await call('setMyCommands', { commands: DAFTAR_SLASH.map(([command, description]) => ({ command, description })) }).catch(() => {});

  let offset = 0;
  // Long polling: tanya ke Telegram "ada pesan baru?" dan tunggu sampai 50 detik
  for (;;) {
    try {
      const updates = await call('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });
      for (const u of updates) {
        offset = u.update_id + 1;
        if (u.message) await onMessage(u.message);
      }
    } catch (err) {
      console.error('[TG] Polling error:', err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

module.exports = { start, kirimHasil, aktif };
