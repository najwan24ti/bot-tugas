// Pengingat pribadi: "ingatkan bayar kos tgl 1", "ingatkan angkat jemuran 2 jam lagi", dst.
const { load, save } = require('./data');
const { now, dayjs, TZ } = require('./waktu');

const FILE = 'pengingat.json';
const HARI = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const JAM_BAWAAN = 7;
const RE_HARI = HARI.join('|');

function muat() {
  return load(FILE, { nextId: 1, items: [] });
}

// Kejadian berikutnya untuk pengingat berulang, setelah waktu `dari`
function berikutnya(ulang, jam, menit, dari) {
  let t = dari.hour(jam).minute(menit).second(0).millisecond(0);
  if (ulang.tipe === 'harian') {
    if (!t.isAfter(dari)) t = t.add(1, 'day');
  } else if (ulang.tipe === 'mingguan') {
    t = t.add((ulang.hari - t.day() + 7) % 7, 'day');
    if (!t.isAfter(dari)) t = t.add(7, 'day');
  } else if (ulang.tipe === 'bulanan') {
    const pasang = (x) => x.date(Math.min(ulang.tgl, x.daysInMonth()));
    t = pasang(t);
    if (!t.isAfter(dari)) t = pasang(t.startOf('month').add(1, 'month').hour(jam).minute(menit));
  }
  return t;
}

// Pisahkan teks pengingat dan waktunya. Mengembalikan { teks, waktu, ulang, jam, menit } atau { error }
function parse(input) {
  let s = ` ${input.toLowerCase().replace(/\s+/g, ' ').trim()} `;
  const ambil = (re) => {
    const m = s.match(re);
    if (m) s = ` ${s.replace(m[0], ' ').replace(/\s+/g, ' ').trim()} `;
    return m;
  };
  const sekarang = now();
  let m;

  // Berulang
  let ulang = null;
  if (ambil(/ (?:setiap|tiap) hari /)) ulang = { tipe: 'harian' };
  else if ((m = ambil(new RegExp(` (?:setiap|tiap) (?:hari )?(${RE_HARI}) `)))) ulang = { tipe: 'mingguan', hari: HARI.indexOf(m[1]) };
  else if ((m = ambil(/ (?:setiap|tiap) (?:bulan )?(?:tgl|tanggal) (\d{1,2}) /))) ulang = { tipe: 'bulanan', tgl: Number(m[1]) };

  // Tanggal diambil sebelum jam, supaya "tgl 1 jam 9" tidak terbaca "1 jam" (relatif)
  let tglMatch = null;
  if (!ulang) tglMatch = ambil(/ (?:tgl|tanggal) (\d{1,2})(?:[/-](\d{1,2}))? /);

  // Jam: "jam 7", "pukul 19.30", "jam 7 malam", "19:30". Bukan "1 jam 30 menit" (relatif)
  let jam = null;
  let menit = 0;
  m = ambil(/(?<! \d{1,3}) (?:jam|pukul|pkl) (\d{1,2})(?:[.:](\d{2}))? ?(pagi|siang|sore|malam)? /) ||
    ambil(/ (\d{1,2})[.:](\d{2}) ?(pagi|siang|sore|malam)? /);
  if (m) {
    jam = Number(m[1]);
    menit = Number(m[2] || 0);
    if ((m[3] === 'sore' || m[3] === 'malam') && jam < 12) jam += 12;
    if (m[3] === 'siang' && jam < 11) jam += 12;
    if (jam > 23 || menit > 59) return { error: 'Jamnya tidak valid.' };
  }

  // Relatif: "2 jam lagi", "dalam 30 menit", "1 jam 30 menit lagi"
  let relatif = null;
  for (let i = 0; i < 2; i++) {
    m = ambil(/ (?:dalam )?(\d+) ?(menit|mnt|jam|hari|minggu)(?: lagi)? /);
    if (!m) break;
    const satuan = { menit: 'minute', mnt: 'minute', jam: 'hour', hari: 'day', minggu: 'week' }[m[2]];
    relatif = (relatif || sekarang).add(Number(m[1]), satuan);
  }

  // Tanggal / hari
  let tanggal = null;
  let geser = null; // cara memajukan kalau waktunya sudah lewat
  if ((m = tglMatch)) {
    const tgl = Number(m[1]);
    tanggal = m[2] ? sekarang.month(Number(m[2]) - 1).date(tgl) : sekarang.date(tgl);
    geser = m[2] ? 'year' : 'month';
  } else if (ambil(/ besok /)) tanggal = sekarang.add(1, 'day');
  else if (ambil(/ lusa /)) tanggal = sekarang.add(2, 'day');
  else if (ambil(/ (?:hari ini|nanti) /)) tanggal = sekarang;
  else if ((m = ambil(new RegExp(` (?:hari )?(${RE_HARI}) `)))) {
    tanggal = sekarang.add((HARI.indexOf(m[1]) - sekarang.day() + 7) % 7, 'day');
    geser = 'week';
  }

  let waktu;
  if (ulang) {
    waktu = berikutnya(ulang, jam ?? JAM_BAWAAN, menit, sekarang);
  } else if (relatif) {
    waktu = relatif;
  } else if (tanggal) {
    waktu = tanggal.hour(jam ?? JAM_BAWAAN).minute(menit).second(0);
    if (!waktu.isAfter(sekarang)) {
      if (!geser) return { error: 'Waktunya sudah lewat.' };
      waktu = waktu.add(1, geser);
    }
  } else if (jam !== null) {
    waktu = sekarang.hour(jam).minute(menit).second(0);
    if (!waktu.isAfter(sekarang)) waktu = waktu.add(1, 'day');
  } else {
    return { error: 'Waktunya belum disebut.' };
  }

  // Sisa kalimat = isi pengingat (pakai huruf asli dari input)
  let teks = s.trim().replace(/^(?:untuk|utk|buat|aku|saya|gw|gue|ku)\s+/, '').replace(/\s+(?:pada|di)$/, '');
  const asli = input.match(new RegExp(teks.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  teks = (asli ? asli[0] : teks) || 'Pengingat';
  return { teks, waktu: waktu.second(0).millisecond(0), ulang, jam: jam ?? waktu.hour(), menit: jam !== null ? menit : waktu.minute() };
}

function labelUlang(p) {
  if (!p.ulang) return '';
  const jam = `${String(p.jam).padStart(2, '0')}.${String(p.menit).padStart(2, '0')}`;
  if (p.ulang.tipe === 'harian') return `🔁 setiap hari ${jam}`;
  if (p.ulang.tipe === 'mingguan') return `🔁 setiap ${NAMA_HARI[p.ulang.hari]} ${jam}`;
  return `🔁 setiap tgl ${p.ulang.tgl} ${jam}`;
}

function formatWaktu(w) {
  const d = w.startOf('day').diff(now().startOf('day'), 'day');
  const hari = d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : w.format('dddd, D MMM');
  return `${hari} ${w.format('HH.mm')}`;
}

const CONTOH = [
  'Contoh:',
  '› `ingatkan angkat jemuran 2 jam lagi`',
  '› `ingatkan kumpul tugas besok jam 8`',
  '› `ingatkan bayar kos setiap tgl 1`',
  '› `ingatkan minum obat setiap hari jam 7 malam`',
].join('\n');

function tambah(input) {
  const isi = input.replace(/^\s*(?:ingatkan|ingetin|ingatin|reminder|remind)\b\s*/i, '');
  const p = parse(isi);
  if (p.error) return `⚠️ ${p.error}\n\n${CONTOH}`;

  const db = muat();
  db.items.push({ id: db.nextId++, teks: p.teks, waktu: p.waktu.toISOString(), ulang: p.ulang, jam: p.jam, menit: p.menit });
  save(FILE, db);

  const ulang = labelUlang(p);
  return `✅ *Pengingat disimpan*\n📌 ${p.teks}\n⏰ ${formatWaktu(p.waktu)}${ulang ? `\n${ulang}` : ''}`;
}

function urut(db) {
  return [...db.items].sort((a, b) => new Date(a.waktu) - new Date(b.waktu));
}

function daftar() {
  const list = urut(muat());
  if (list.length === 0) return `📭 Belum ada pengingat.\n\n${CONTOH}`;
  const baris = list.map((p, i) => {
    const ulang = labelUlang(p);
    return `${i + 1}. *${p.teks}*\n   ⏰ ${formatWaktu(dayjs(p.waktu).tz(TZ))}${ulang ? `\n   ${ulang}` : ''}`;
  });
  return `⏰ *DAFTAR PENGINGAT*\n\n${baris.join('\n\n')}\n\n_Hapus dengan_ \`hapus pengingat <nomor>\``;
}

function hapus(nomor) {
  const db = muat();
  const p = urut(db)[nomor - 1];
  if (!p) return `⚠️ Pengingat nomor ${nomor} tidak ada. Ketik \`pengingat\` untuk lihat daftar.`;
  db.items = db.items.filter((x) => x.id !== p.id);
  save(FILE, db);
  return `🗑️ Pengingat dihapus: *${p.teks}*`;
}

// Dipanggil tiap menit: kirim pengingat yang sudah waktunya
function jatuhTempo() {
  const db = muat();
  const sekarang = now();
  const pesan = [];
  let berubah = false;

  for (const p of [...db.items]) {
    const w = dayjs(p.waktu).tz(TZ);
    if (w.isAfter(sekarang)) continue;
    const telat = sekarang.diff(w, 'minute');
    pesan.push(`⏰ *PENGINGAT*\n📌 ${p.teks}${telat > 5 ? `\n_(terlambat ${telat} menit, bot sempat mati)_` : ''}`);
    if (p.ulang) p.waktu = berikutnya(p.ulang, p.jam, p.menit, sekarang).toISOString();
    else db.items = db.items.filter((x) => x.id !== p.id);
    berubah = true;
  }
  if (berubah) save(FILE, db);
  return pesan;
}

module.exports = { tambah, daftar, hapus, jatuhTempo, parse };
