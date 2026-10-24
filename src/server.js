// Monitor kesehatan HP server: baterai, suhu, memori, penyimpanan, status tugas terjadwal
const os = require('os');
const fs = require('fs');
const { execFile } = require('child_process');
const { ROOT } = require('./data');
const { now, dayjs, TZ } = require('./waktu');

const BATERAI_LEMAH = 20;
const SUHU_PANAS = 45;
const PENYIMPANAN_MINIM_GB = 1;

const jobs = {}; // nama -> { waktu, ok, error }
let terakhir = null; // kondisi saat cek alert sebelumnya

function catatJob(nama, ok, error) {
  jobs[nama] = { waktu: now(), ok, error };
}

// Butuh aplikasi Termux:API + `pkg install termux-api`. Di laptop hasilnya null.
function baterai() {
  return new Promise((resolve) => {
    execFile('termux-battery-status', { timeout: 10000 }, (err, out) => {
      if (err) return resolve(null);
      try {
        resolve(JSON.parse(out));
      } catch {
        resolve(null);
      }
    });
  });
}

async function penyimpanan() {
  try {
    const s = await fs.promises.statfs(ROOT);
    return { bebas: s.bavail * s.bsize, total: s.blocks * s.bsize };
  } catch {
    return null;
  }
}

const gb = (b) => `${(b / 1024 ** 3).toFixed(1)} GB`;

function durasi(detik) {
  const h = Math.floor(detik / 86400);
  const j = Math.floor((detik % 86400) / 3600);
  const m = Math.floor((detik % 3600) / 60);
  return [h && `${h} hari`, j && `${j} jam`, `${m} menit`].filter(Boolean).join(' ');
}

const LABEL_CAS = { PLUGGED_AC: 'charger', PLUGGED_USB: 'USB', PLUGGED_WIRELESS: 'wireless' };

async function status() {
  const [bat, disk] = await Promise.all([baterai(), penyimpanan()]);
  const baris = ['🖥️ *STATUS HP SERVER*', `🕐 ${now().format('dddd, D MMM YYYY HH.mm')}`, ''];

  if (bat) {
    const cas = bat.plugged && bat.plugged !== 'UNPLUGGED';
    const ikon = cas ? '🔌' : bat.percentage <= BATERAI_LEMAH ? '🪫' : '🔋';
    baris.push(`${ikon} Baterai: *${bat.percentage}%* ${cas ? `(dicas via ${LABEL_CAS[bat.plugged] || 'charger'})` : '(tidak dicas)'}`);
    baris.push(`🌡️ Suhu baterai: *${Number(bat.temperature).toFixed(1)}°C*${bat.temperature >= SUHU_PANAS ? ' ⚠️ panas' : ''}`);
    if (bat.health && bat.health !== 'GOOD') baris.push(`❤️ Kesehatan baterai: ${bat.health}`);
  } else {
    baris.push('🔋 Baterai: _tidak tersedia_ (perlu Termux:API)');
  }

  const total = os.totalmem();
  const pakai = total - os.freemem();
  baris.push(`🧠 RAM: ${gb(pakai)} / ${gb(total)} terpakai`);
  if (disk) baris.push(`💾 Penyimpanan: ${gb(disk.bebas)} kosong dari ${gb(disk.total)}`);
  baris.push(`⏱️ Bot menyala: ${durasi(process.uptime())}`);
  baris.push(`📱 HP menyala: ${durasi(os.uptime())}`);

  const daftarJob = Object.entries(jobs);
  if (daftarJob.length) {
    baris.push('', '⚙️ *Tugas otomatis terakhir*');
    for (const [nama, j] of daftarJob) {
      baris.push(`${j.ok ? '✅' : '❌'} ${nama} — ${j.waktu.format('HH.mm')}${j.ok ? '' : `\n   _${j.error}_`}`);
    }
  }
  return baris.join('\n');
}

// Dipanggil berkala: kirim peringatan hanya saat kondisi berubah, supaya tidak spam
async function cekAlert() {
  const [bat, disk] = await Promise.all([baterai(), penyimpanan()]);
  const k = {
    cas: bat ? bat.plugged !== 'UNPLUGGED' : null,
    lemah: bat ? bat.percentage <= BATERAI_LEMAH && bat.plugged === 'UNPLUGGED' : false,
    panas: bat ? bat.temperature >= SUHU_PANAS : false,
    penuh: disk ? disk.bebas < PENYIMPANAN_MINIM_GB * 1024 ** 3 : false,
  };
  const lalu = terakhir;
  terakhir = k;
  if (!lalu) return [];

  const pesan = [];
  const persen = bat ? `${bat.percentage}%` : '-';
  if (lalu.cas === true && k.cas === false) pesan.push(`🔌 *Charger HP server dicabut!*\nBaterai sekarang ${persen}. Sambungkan lagi supaya bot tidak mati.`);
  if (lalu.cas === false && k.cas === true) pesan.push(`🔌 Charger HP server tersambung lagi (${persen}).`);
  if (!lalu.lemah && k.lemah) pesan.push(`🪫 *Baterai HP server tinggal ${persen}!* Segera dicas.`);
  if (!lalu.panas && k.panas) pesan.push(`🔥 *HP server panas* (${Number(bat.temperature).toFixed(1)}°C). Pindahkan ke tempat yang lebih sejuk / lepas casing.`);
  if (!lalu.penuh && k.penuh) pesan.push(`💾 *Penyimpanan HP server hampir penuh* (sisa ${gb(disk.bebas)}).`);
  return pesan;
}

module.exports = { status, cekAlert, catatJob, baterai };
