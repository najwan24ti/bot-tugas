// Mengartikan perintah chat dan menyusun balasan
const { getAssignments } = require('./classroom');
const { now, getRange } = require('./waktu');
const { hariDariTeks, buildJadwal } = require('./jadwal');

const GARIS = '━━━━━━━━━━━━━━━━━━';

const MENU = [
  '🤖 *BOT TUGAS 3 TI F*',
  GARIS,
  '',
  '📝 *TUGAS CLASSROOM*',
  '› `tugas hari ini`',
  '› `tugas besok`',
  '› `tugas minggu ini`',
  '› `tugas minggu depan`',
  '› `tugas belum` _(semua yang belum dikumpul)_',
  '',
  '🗓️ *JADWAL KULIAH*',
  '› `jadwal` _(hari ini)_',
  '› `jadwal besok`',
  '› `jadwal senin` … `jadwal jumat`',
  '› `jadwal minggu ini`',
  '',
  '⏰ *PENGINGAT PRIBADI*',
  '› `ingatkan angkat jemuran 2 jam lagi`',
  '› `ingatkan kumpul laporan besok jam 8`',
  '› `ingatkan bayar kos setiap tgl 1`',
  '› `pengingat` _(lihat daftar)_',
  '› `hapus pengingat 1`',
  '',
  '💰 *KEUANGAN*',
  '› `jajan 15rb bakso` / `bensin 20rb`',
  '› `masuk 500rb kiriman ortu`',
  '› `rekap` / `rekap hari ini` / `rekap minggu ini`',
  '› `budget 1jt` _(batas per bulan)_',
  '› `batal` _(hapus catatan terakhir)_',
  '',
  '📁 *FILE*',
  '› Kirim file/foto + caption `simpan big data`',
  '› `file` / `file big data` _(lihat daftar)_',
  '› `ambil 2` _(kirim balik file no. 2)_',
  '',
  '🖥️ *HP SERVER*',
  '› `status` _(baterai, suhu, memori)_',
  '› `backup` _(cadangkan data sekarang)_',
  '› Kirim file backup + caption `restore`',
  '',
  '🔔 *NOTIFIKASI OTOMATIS*',
  '› 07.00 — deadline hari ini & besok',
  '› Tugas baru masuk di Classroom',
  '› 3 jam sebelum deadline',
  '› 30 menit sebelum kuliah',
  '› Charger dicabut / baterai lemah / HP panas',
  '› 23.00 — backup data',
  '',
  GARIS,
  '💡 Ketik `menu` untuk lihat ini lagi',
].join('\n');

const JUDUL = {
  hari: 'Tugas hari ini',
  besok: 'Tugas besok',
  minggu: 'Tugas minggu ini',
  minggudepan: 'Tugas minggu depan',
  belum: 'Tugas yang belum dikumpulkan',
};

// Kembalikan jenis perintah, atau null kalau pesan bukan untuk bot
function parseCommand(text) {
  const t = (text || '').toLowerCase().trim();
  if (['menu', 'help', 'bantuan', '/start'].includes(t)) return 'menu';
  if (t.includes('jadwal')) return `jadwal:${hariDariTeks(t)}`;
  if (!t.includes('tugas') && !t.includes('deadline')) return null;
  if (t.includes('minggu depan')) return 'minggudepan';
  if (t.includes('minggu')) return 'minggu';
  if (t.includes('besok')) return 'besok';
  if (t.includes('hari ini')) return 'hari';
  if (t.includes('belum') || t.includes('semua') || t.includes('deadline')) return 'belum';
  return 'menu';
}

function relatif(due) {
  const diff = due.startOf('day').diff(now().startOf('day'), 'day');
  if (due.isBefore(now())) return diff === 0 ? 'lewat tadi' : `lewat ${-diff} hari`;
  if (diff === 0) return 'hari ini';
  if (diff === 1) return 'besok';
  return `${diff} hari lagi`;
}

function formatItem(a, i) {
  const lines = [`${i + 1}. *${a.title}*`, `   📘 ${a.course}`];
  lines.push(
    a.due
      ? `   ⏰ ${a.due.format('dddd, D MMM YYYY HH:mm')} (${relatif(a.due)})`
      : '   ⏰ Tanpa deadline'
  );
  lines.push(a.done ? '   ✅ Sudah dikumpulkan' : '   ❌ Belum dikumpulkan');
  if (a.link) lines.push(`   🔗 ${a.link}`);
  return lines.join('\n');
}

function pilihTugas(all, kind) {
  if (kind === 'belum') {
    // Belum dikumpulkan & deadline belum lewat lebih dari 7 hari (yang tanpa deadline ikut)
    const batas = now().subtract(7, 'day');
    return all.filter((a) => !a.done && (!a.due || a.due.isAfter(batas)));
  }
  const [start, end] = getRange(kind);
  return all.filter((a) => a.due && !a.due.isBefore(start) && !a.due.isAfter(end));
}

function urutkan(list) {
  return [...list].sort((a, b) => {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.valueOf() - b.due.valueOf();
  });
}

async function buildReply(kind) {
  if (kind === 'menu') return MENU;
  if (kind.startsWith('jadwal:')) {
    const hari = kind.slice(7);
    return buildJadwal(hari === 'minggu' ? hari : Number(hari));
  }

  const all = await getAssignments();
  const list = urutkan(pilihTugas(all, kind));

  let header = `📚 *${JUDUL[kind]}*`;
  if (kind !== 'belum') {
    const [start, end] = getRange(kind);
    header += start.isSame(end, 'day')
      ? `\n🗓️ ${start.format('dddd, D MMMM YYYY')}`
      : `\n🗓️ ${start.format('D MMM')} – ${end.format('D MMM YYYY')}`;
  }

  if (list.length === 0) return `${header}\n\n🎉 Tidak ada tugas. Santai dulu!`;

  const belum = list.filter((a) => !a.done).length;
  const ringkas = `Total ${list.length} tugas, ${belum} belum dikumpulkan.`;
  return `${header}\n${ringkas}\n\n${list.map(formatItem).join('\n\n')}`;
}

// Pesan pengingat otomatis: tugas belum dikumpulkan yang deadline-nya hari ini/besok.
// Mengembalikan null kalau tidak ada yang perlu diingatkan.
async function buildReminder() {
  const all = await getAssignments({ fresh: true });
  const start = now();
  const end = getRange('besok')[1];
  const list = urutkan(all.filter((a) => !a.done && a.due && a.due.isAfter(start) && !a.due.isAfter(end)));
  if (list.length === 0) return null;
  return `⏰ *Pengingat deadline!*\nAda ${list.length} tugas yang belum dikumpulkan, deadline hari ini/besok:\n\n${list
    .map(formatItem)
    .join('\n\n')}`;
}

module.exports = { parseCommand, buildReply, buildReminder, formatItem, urutkan };
