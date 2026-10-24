// Jadwal kuliah 3 TI F. Hari: 1 = Senin ... 5 = Jumat (sama dengan dayjs().day())
const { now } = require('./waktu');

const JADWAL = {
  1: [
    { mulai: '07:00', selesai: '11:00', matkul: 'Jaringan Multimedia', dosen: 'ICT-MIN', ruang: 'SL215 (New)' },
    { mulai: '11:00', selesai: '13:00', matkul: 'KPPL', dosen: 'ULI', ruang: '129 / MO 134' },
  ],
  2: [
    { mulai: '07:00', selesai: '09:00', matkul: 'Bahasa Indonesia', dosen: 'RND', ruang: '124 / MO 129' },
    { mulai: '09:00', selesai: '11:00', matkul: 'Probabilitas dan Statistika', dosen: 'NA', ruang: '126 / MO 131' },
  ],
  3: [
    { mulai: '11:00', selesai: '13:00', matkul: 'Metodologi Penelitian', dosen: 'MAF', ruang: '211 / MO 213' },
    { mulai: '16:30', selesai: '21:30', matkul: 'Big Data', dosen: 'ESA-PRA', ruang: 'SL 112', catatan: 'istirahat 18.00–19.00' },
  ],
  4: [
    { mulai: '07:00', selesai: '11:00', matkul: 'Pembelajaran Mesin', dosen: 'JNS-RKW', ruang: 'SL 309' },
    { mulai: '13:00', selesai: '17:00', matkul: 'Pengolahan Citra Digital Sawit', dosen: 'ASD-OKY', ruang: 'SL 314' },
  ],
  5: [
    { mulai: '07:00', selesai: '11:00', matkul: 'Pemrograman Mobile', dosen: 'FMI-IYP', ruang: 'SL 116' },
    { mulai: '13:30', selesai: '17:30', matkul: 'Sistem Informasi Geografis Sawit', dosen: 'ERH-IYP', ruang: 'SL 311' },
  ],
};

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// "jadwal senin" -> 1, "jadwal besok" -> hari besok, "jadwal minggu ini" -> 'minggu'
function hariDariTeks(t) {
  if (t.includes('minggu ini') || t.includes('seminggu') || t.includes('semua')) return 'minggu';
  if (t.includes('besok')) return now().add(1, 'day').day();
  for (let i = 1; i <= 6; i++) if (t.includes(NAMA_HARI[i].toLowerCase())) return i;
  if (t.includes('minggu')) return 0;
  return now().day();
}

function formatHari(hari) {
  const list = JADWAL[hari] || [];
  const judul = `🗓️ *${NAMA_HARI[hari]}*`;
  if (list.length === 0) return `${judul}\n   Tidak ada kuliah 🎉`;
  return [
    judul,
    ...list.map((k) => {
      const extra = k.catatan ? ` (${k.catatan})` : '';
      return `• ${k.mulai.replace(':', '.')}–${k.selesai.replace(':', '.')} *${k.matkul}*${extra}\n   👤 ${k.dosen}  📍 ${k.ruang}`;
    }),
  ].join('\n');
}

function buildJadwal(hari) {
  if (hari === 'minggu') {
    return `📚 *Jadwal Kuliah 3 TI F*\n\n${[1, 2, 3, 4, 5].map(formatHari).join('\n\n')}`;
  }
  const label = hari === now().day() ? ' (hari ini)' : hari === now().add(1, 'day').day() ? ' (besok)' : '';
  return `📚 *Jadwal Kuliah*${label}\n\n${formatHari(hari)}`;
}

// Kuliah yang mulai tepat `menit` menit dari sekarang (untuk pengingat)
function kuliahAkanMulai(menit) {
  const t = now().add(menit, 'minute');
  const jam = t.format('HH:mm');
  return (JADWAL[t.day()] || []).filter((k) => k.mulai === jam);
}

module.exports = { hariDariTeks, buildJadwal, kuliahAkanMulai };
