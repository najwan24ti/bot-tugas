// Bot Tugas: saluran WhatsApp & Telegram + semua tugas otomatis (pengingat, cek Classroom, backup, dll.)
require('dotenv').config();
const cron = require('node-cron');
const { buildReminder } = require('./pesan');
const { cekClassroom, cekKuliah } = require('./pantau');
const pengingat = require('./pengingat');
const server = require('./server');
const backup = require('./backup');
const file = require('./file');
const wa = require('./wa');
const tg = require('./telegram');
const { TZ } = require('./waktu');

const REMINDER_CRON = (process.env.REMINDER_CRON ?? '0 7 * * *').trim();
const CEK_MENIT = Math.max(5, Number(process.env.CEK_CLASSROOM_MENIT) || 15);
const MENIT_SEBELUM_KULIAH = Number(process.env.MENIT_SEBELUM_KULIAH) || 30;
const BACKUP_CRON = (process.env.BACKUP_CRON ?? '0 23 * * *').trim();

const WA_AKTIF = (process.env.WA_AKTIF || 'true').toLowerCase() !== 'false';
const TG_AKTIF = Boolean((process.env.TELEGRAM_TOKEN || '').trim());
// Notifikasi otomatis dikirim ke mana: telegram | wa | semua (default: Telegram kalau sudah diatur)
let NOTIF_KE = (process.env.NOTIF_KE || (tg.aktif() ? 'telegram' : 'wa')).toLowerCase();
if (NOTIF_KE === 'telegram' && !tg.aktif() && WA_AKTIF) NOTIF_KE = 'wa'; // Telegram belum diatur: jangan sampai notifikasi hilang

async function notif(hasil) {
  const tujuan = [];
  if (WA_AKTIF && (NOTIF_KE === 'wa' || NOTIF_KE === 'semua')) tujuan.push(['WA', wa]);
  if (tg.aktif() && (NOTIF_KE === 'telegram' || NOTIF_KE === 'semua')) tujuan.push(['Telegram', tg]);
  if (tujuan.length === 0) throw new Error('Tidak ada saluran notifikasi yang aktif');
  const gagal = [];
  for (const [nama, saluran] of tujuan) {
    try {
      await saluran.kirimHasil(hasil);
    } catch (err) {
      gagal.push(`${nama}: ${err.message}`);
    }
  }
  if (gagal.length === tujuan.length) throw new Error(gagal.join('; '));
}

// Jalankan tugas terjadwal; error dicatat saja supaya bot tetap hidup
function tugasTerjadwal(nama, cronExpr, fn) {
  cron.schedule(
    cronExpr,
    async () => {
      try {
        const hasil = await fn();
        for (const h of [].concat(hasil || [])) await notif(h);
        server.catatJob(nama, true);
      } catch (err) {
        server.catatJob(nama, false, err.message);
        console.error(`Gagal ${nama}:`, err.message);
      }
    },
    { timezone: TZ }
  );
}

function buatBackupTerjadwal() {
  const b = backup.buat();
  return { teks: `💾 *Backup otomatis*\n📦 ${b.ringkas}`, dokumen: { buffer: b.buffer, fileName: b.fileName, mimetype: 'application/json' } };
}

function jadwalkan() {
  if (REMINDER_CRON) tugasTerjadwal('Pengingat deadline pagi', REMINDER_CRON, buildReminder);
  tugasTerjadwal('Cek Classroom', `*/${CEK_MENIT} * * * *`, cekClassroom);
  tugasTerjadwal('Pengingat kuliah', '* * * * *', () => cekKuliah(MENIT_SEBELUM_KULIAH));
  tugasTerjadwal('Pengingat pribadi', '* * * * *', pengingat.jatuhTempo);
  tugasTerjadwal('Monitor HP', '*/5 * * * *', server.cekAlert);
  if (BACKUP_CRON) tugasTerjadwal('Backup data', BACKUP_CRON, buatBackupTerjadwal);

  console.log(`⏰ Deadline pagi: ${REMINDER_CRON || 'mati'} · Cek Classroom tiap ${CEK_MENIT} mnt · Kuliah H-${MENIT_SEBELUM_KULIAH} mnt`);
  console.log(`💾 Backup: ${BACKUP_CRON || 'mati'} · 📁 File: ${file.FILES_DIR}`);
  console.log(`🔔 Notifikasi dikirim ke: ${NOTIF_KE}`);
  server.cekAlert().catch(() => {});
  // Cek pertama setelah saluran sempat tersambung
  setTimeout(() => {
    cekClassroom()
      .then((list) => Promise.all(list.map(notif)))
      .catch((err) => console.error('Gagal cek Classroom:', err.message));
  }, 30000);
}

async function main() {
  if (!WA_AKTIF && !TG_AKTIF) {
    console.error('❌ Tidak ada saluran aktif. Isi TELEGRAM_TOKEN di .env, atau set WA_AKTIF=true.');
    process.exit(1);
  }
  jadwalkan();
  if (WA_AKTIF) wa.start().catch((err) => console.error('❌ [WA] Gagal start:', err));
  else console.log('[WA] Dimatikan (WA_AKTIF=false)');
  if (TG_AKTIF) tg.start().catch((err) => console.error('❌ [TG] Gagal start:', err.message));
}

main();
