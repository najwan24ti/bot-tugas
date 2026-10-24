// Simpan file kiriman WA ke HP server, lalu bisa dilihat & diambil lagi lewat chat
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./data');
const { dayjs, TZ } = require('./waktu');

// Di HP (Termux) disimpan ke memori internal supaya bisa dibuka dari File Manager
const FILES_DIR = process.env.FILES_DIR || (fs.existsSync('/sdcard/Download') ? '/sdcard/BotTugas' : path.join(DATA_DIR, 'files'));

const MIME = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4', zip: 'application/zip', txt: 'text/plain', json: 'application/json',
};

let listTerakhir = []; // dipakai perintah "ambil <nomor>"

function bersihkan(nama) {
  return nama.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function ukuran(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}

function simpan(buffer, namaFile, folder) {
  const dir = path.join(FILES_DIR, bersihkan(folder) || 'Umum');
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(namaFile);
  const dasar = bersihkan(path.basename(namaFile, ext)) || 'file';
  let tujuan = path.join(dir, `${dasar}${ext}`);
  for (let i = 1; fs.existsSync(tujuan); i++) tujuan = path.join(dir, `${dasar} (${i})${ext}`);
  fs.writeFileSync(tujuan, buffer);
  return `📁 *File disimpan*\n📄 ${path.basename(tujuan)}\n🗂️ Folder: ${path.basename(dir)}\n📦 ${ukuran(buffer.length)}`;
}

function semuaFile() {
  if (!fs.existsSync(FILES_DIR)) return [];
  const hasil = [];
  for (const folder of fs.readdirSync(FILES_DIR, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const dir = path.join(FILES_DIR, folder.name);
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!f.isFile()) continue;
      const p = path.join(dir, f.name);
      const st = fs.statSync(p);
      hasil.push({ path: p, nama: f.name, folder: folder.name, size: st.size, waktu: st.mtimeMs });
    }
  }
  return hasil.sort((a, b) => b.waktu - a.waktu);
}

// "file" -> ringkasan folder + 10 terbaru; "file big data" -> isi folder itu
function daftar(text) {
  const cari = text.trim().replace(/^(?:file|files|berkas)\s*/i, '').toLowerCase();
  const semua = semuaFile();
  if (semua.length === 0) return '📭 Belum ada file tersimpan.\n\nKirim file/foto ke chat ini dengan caption `simpan <nama folder>`, contoh: `simpan big data`';

  const formatList = (list) =>
    list.map((f, i) => `${i + 1}. ${f.nama}\n   🗂️ ${f.folder} · ${ukuran(f.size)} · ${dayjs(f.waktu).tz(TZ).format('D MMM HH.mm')}`).join('\n');

  if (cari) {
    listTerakhir = semua.filter((f) => f.folder.toLowerCase().includes(cari)).slice(0, 20);
    if (listTerakhir.length === 0) return `📭 Tidak ada folder yang cocok dengan "${cari}". Ketik \`file\` untuk lihat semua folder.`;
    return `🗂️ *FILE: ${listTerakhir[0].folder.toUpperCase()}*\n\n${formatList(listTerakhir)}\n\n_Kirim balik file dengan_ \`ambil <nomor>\``;
  }

  const perFolder = {};
  for (const f of semua) perFolder[f.folder] = (perFolder[f.folder] || 0) + 1;
  listTerakhir = semua.slice(0, 10);
  const folder = Object.entries(perFolder).map(([n, c]) => `› ${n} (${c} file)`).join('\n');
  return `📁 *FILE DI HP SERVER*\n\n🗂️ *Folder*\n${folder}\n\n🕐 *10 file terbaru*\n${formatList(listTerakhir)}\n\n_Lihat isi folder:_ \`file <nama folder>\`\n_Kirim balik file:_ \`ambil <nomor>\``;
}

// Mengembalikan { path, fileName, mimetype } atau pesan error (string)
function ambil(nomor) {
  const f = listTerakhir[nomor - 1];
  if (!f) return `⚠️ Nomor ${nomor} tidak ada di daftar. Ketik \`file\` dulu untuk lihat daftar.`;
  if (!fs.existsSync(f.path)) return '⚠️ File sudah tidak ada di HP server.';
  const ext = path.extname(f.nama).slice(1).toLowerCase();
  return { path: f.path, fileName: f.nama, mimetype: MIME[ext] || 'application/octet-stream' };
}

module.exports = { simpan, daftar, ambil, FILES_DIR };
