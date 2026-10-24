// Simpan & baca data bot (file JSON di folder data/)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

function filePath(nama) {
  // state.json (catatan tugas Classroom) tetap di folder utama seperti versi sebelumnya
  return nama === 'state.json' ? path.join(ROOT, nama) : path.join(DATA_DIR, nama);
}

function load(nama, bawaan) {
  try {
    return JSON.parse(fs.readFileSync(filePath(nama), 'utf8'));
  } catch {
    return bawaan;
  }
}

function save(nama, isi) {
  const p = filePath(nama);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  // Tulis ke file sementara dulu supaya data tidak rusak kalau HP mati di tengah proses
  fs.writeFileSync(`${p}.tmp`, JSON.stringify(isi, null, 2));
  fs.renameSync(`${p}.tmp`, p);
}

function rupiah(n) {
  return `Rp${Math.round(n).toLocaleString('id-ID')}`;
}

module.exports = { ROOT, DATA_DIR, filePath, load, save, rupiah };
