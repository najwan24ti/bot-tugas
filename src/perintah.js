// Arahkan pesan teks ke fitur yang sesuai.
// Hasil: null (bukan perintah bot), string (balasan teks), atau { teks, dokumen } untuk kirim file.
const { parseCommand, buildReply } = require('./pesan');
const pengingat = require('./pengingat');
const keuangan = require('./keuangan');
const server = require('./server');
const backup = require('./backup');
const file = require('./file');

async function handle(text) {
  // Buang emoji/tanda di depan (dari tombol Telegram, mis. "💰 Rekap"), tapi pertahankan +/- untuk keuangan
  const t = text.trim().replace(/^[^\p{L}\p{N}+-]+/u, '');
  const low = t.toLowerCase();
  let m;

  // Pengingat pribadi (dicek pertama, karena isinya bisa mengandung kata "tugas"/"jadwal")
  if (/^(?:ingatkan|ingetin|ingatin|reminder|remind)\b/.test(low)) return pengingat.tambah(t);
  if (/^(?:pengingat|daftar pengingat|list pengingat|reminder list)$/.test(low)) return pengingat.daftar();
  if ((m = low.match(/^hapus pengingat (\d+)$/))) return pengingat.hapus(Number(m[1]));

  // Keuangan
  if (/^(?:rekap|laporan)(?:\s|$)/.test(low)) return keuangan.rekap(low);
  if (/^budget(?:\s|$)/.test(low)) return keuangan.setBudget(low);
  if (low === 'batal') return keuangan.batal();
  const catatan = keuangan.catat(t);
  if (catatan) return catatan;

  // Server & backup
  if (/^status(?: server| hp)?$/.test(low)) return server.status();
  if (low === 'backup') {
    const b = backup.buat();
    return { teks: `💾 *Backup data bot*\n📦 ${b.ringkas}\n\n_Untuk memulihkan: kirim balik file ini dengan caption_ \`restore\``, dokumen: { buffer: b.buffer, fileName: b.fileName, mimetype: 'application/json' } };
  }

  // File
  if (/^(?:file|files|berkas)(?:\s|$)/.test(low)) return file.daftar(t);
  if ((m = low.match(/^ambil (\d+)$/))) {
    const hasil = file.ambil(Number(m[1]));
    return typeof hasil === 'string' ? hasil : { teks: `📄 ${hasil.fileName}`, dokumen: hasil };
  }

  // Tugas Classroom & jadwal kuliah
  const kind = parseCommand(t);
  return kind ? buildReply(kind) : null;
}

// File masuk: caption "simpan <folder>" -> disimpan, caption "restore" + .json -> pulihkan backup.
// `unduh` adalah fungsi async yang mengembalikan Buffer, dipanggil hanya kalau file memang dipakai.
async function handleFile({ caption, fileName, unduh }) {
  const cap = (caption || '').trim();
  const simpan = cap.match(/^simpan\b\s*(.*)$/i);
  const restore = cap.toLowerCase() === 'restore' && fileName.toLowerCase().endsWith('.json');
  if (!simpan && !restore) return null;
  const buffer = await unduh();
  return restore ? backup.pulihkan(buffer) : file.simpan(buffer, fileName, simpan[1]);
}

module.exports = { handle, handleFile };
