// Backup data bot (keuangan, pengingat, catatan tugas) ke satu file JSON
const fs = require('fs');
const path = require('path');
const { DATA_DIR, load, save } = require('./data');
const { now, dayjs, TZ } = require('./waktu');

const FILES = ['keuangan.json', 'pengingat.json', 'state.json'];
const BACKUP_DIR = path.join(DATA_DIR, 'backup');
const SIMPAN_LOKAL = 7; // jumlah file backup lokal yang disimpan

function ringkasan(data) {
  const k = data['keuangan.json']?.items?.length || 0;
  const p = data['pengingat.json']?.items?.length || 0;
  return `${k} catatan keuangan, ${p} pengingat`;
}

// Mengembalikan { fileName, buffer, ringkas }. Salinan juga disimpan di data/backup (maks 7 terakhir).
function buat() {
  const data = {};
  for (const f of FILES) {
    const isi = load(f, null);
    if (isi !== null) data[f] = isi;
  }
  const bundle = { app: 'bot-tugas', versi: 1, dibuat: now().toISOString(), data };
  const fileName = `backup-bot-${now().format('YYYY-MM-DD_HHmm')}.json`;
  const buffer = Buffer.from(JSON.stringify(bundle, null, 2));

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(path.join(BACKUP_DIR, fileName), buffer);
  const lama = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('backup-bot-')).sort().reverse().slice(SIMPAN_LOKAL);
  for (const f of lama) fs.rmSync(path.join(BACKUP_DIR, f), { force: true });

  return { fileName, buffer, ringkas: ringkasan(data) };
}

// Pulihkan dari isi file backup. Data sekarang dibackup dulu sebelum ditimpa.
function pulihkan(buffer) {
  let bundle;
  try {
    bundle = JSON.parse(buffer.toString('utf8'));
  } catch {
    return '⚠️ File bukan backup yang valid (JSON rusak).';
  }
  if (bundle?.app !== 'bot-tugas' || !bundle.data) return '⚠️ File ini bukan backup Bot Tugas.';

  buat();
  for (const f of FILES) if (bundle.data[f]) save(f, bundle.data[f]);
  const dibuat = dayjs(bundle.dibuat).tz(TZ).format('D MMM YYYY HH.mm');
  return `♻️ *Data berhasil dipulihkan*\n📅 Dari backup: ${dibuat}\n📦 ${ringkasan(bundle.data)}`;
}

module.exports = { buat, pulihkan };
