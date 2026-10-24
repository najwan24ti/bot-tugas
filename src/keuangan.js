// Pencatat keuangan: "jajan 15rb bakso", "masuk 500rb kiriman", "rekap bulan ini", "budget 1jt"
const { load, save, rupiah } = require('./data');
const { now, dayjs, TZ } = require('./waktu');

const FILE = 'keuangan.json';
const KATA_KELUAR = ['jajan', 'beli', 'keluar', 'bayar', 'belanja', '-'];
const KATA_MASUK = ['masuk', 'dapat', 'terima', 'gaji', '+'];

// Kategori ditebak dari kata di keterangan
const KATEGORI = [
  ['🍜 Makan & minum', /makan|nasi|bakso|mie|mi |ayam|soto|sate|kopi|teh|es |jus|minum|sarapan|snack|gorengan|roti|martabak|seblak|warteg|geprek|cilok|cemilan|galon|air/],
  ['🛵 Transport', /bensin|pertalite|pertamax|ojek|ojol|grab|gojek|maxim|parkir|angkot|bus|travel|tiket|servis motor|ban/],
  ['📚 Kuliah', /print|fotokopi|fotocopy|buku|kuliah|ukt|praktikum|jilid|modul|alat tulis|pulpen|kertas|laporan/],
  ['📱 Pulsa & internet', /pulsa|kuota|paket data|wifi|internet|token listrik|listrik/],
  ['🏠 Kos & rumah', /kos|kost|sewa|laundry|sabun|shampo|odol|deterjen|kebersihan/],
  ['🎮 Hiburan', /game|nonton|bioskop|netflix|spotify|youtube|topup|top up|diamond|nongkrong|jalan/],
  ['👕 Belanja', /baju|celana|sepatu|tas|shopee|tokopedia|tiktok shop|lazada|online/],
];

function muat() {
  return load(FILE, { nextId: 1, budget: null, items: [] });
}

// "15000", "15.000", "15rb", "15k", "1,5jt", "2jt" -> angka
function parseNominal(str) {
  const m = String(str).toLowerCase().match(/^(\d+(?:[.,]\d+)*)(rb|ribu|k|jt|juta)?$/);
  if (!m) return null;
  if (m[2]) {
    const kali = ['jt', 'juta'].includes(m[2]) ? 1e6 : 1e3;
    return Math.round(parseFloat(m[1].replace(',', '.')) * kali);
  }
  const n = Number(m[1].replace(/[.,]/g, ''));
  return n >= 100 ? n : null;
}

function tebakKategori(ket, tipe) {
  if (tipe === 'masuk') return '💵 Pemasukan';
  const t = ` ${ket.toLowerCase()} `;
  return (KATEGORI.find(([, re]) => re.test(t)) || ['📦 Lainnya'])[0];
}

// Kalau pesan berupa catatan keuangan, kembalikan { tipe, jumlah, ket }. Selain itu null.
function parseCatatan(text) {
  const kata = text.trim().split(/\s+/);
  const kunci = kata[0].toLowerCase();
  let tipe = KATA_KELUAR.includes(kunci) ? 'keluar' : KATA_MASUK.includes(kunci) ? 'masuk' : null;
  let sisa = kata.slice(1);
  // Bentuk singkat "-15rb bakso" / "+500rb kiriman"
  if (!tipe && /^[-+]\d/.test(kunci)) {
    tipe = kunci[0] === '-' ? 'keluar' : 'masuk';
    sisa = [kunci.slice(1), ...sisa];
  }
  // Tanpa kata kunci tapi kata pertama jelas pengeluaran: "bensin 20rb", "kopi 12k"
  let kataPertamaKet = false;
  if (!tipe && kata.length >= 2 && KATEGORI.some(([, re]) => re.test(` ${kunci} `))) {
    tipe = 'keluar';
    kataPertamaKet = true;
  }
  if (!tipe) return null;
  const idx = sisa.findIndex((w) => parseNominal(w) !== null);
  if (idx === -1) return null;
  const jumlah = parseNominal(sisa[idx]);
  // Kata kuncinya ikut jadi keterangan kalau bermakna ("bayar kos", "beli galon")
  const awal = kataPertamaKet || ['bayar', 'beli', 'belanja', 'gaji'].includes(kunci) ? [kata[0]] : [];
  const ket = [...awal, ...sisa.filter((_, i) => i !== idx)].join(' ').trim() || (tipe === 'masuk' ? 'pemasukan' : 'pengeluaran');
  return { tipe, jumlah, ket };
}

function totalPeriode(items, mulai, akhir, tipe) {
  return items
    .filter((x) => x.tipe === tipe)
    .filter((x) => {
      const w = dayjs(x.waktu).tz(TZ);
      return !w.isBefore(mulai) && !w.isAfter(akhir);
    })
    .reduce((s, x) => s + x.jumlah, 0);
}

function infoBudget(db) {
  if (!db.budget) return '';
  const n = now();
  const keluar = totalPeriode(db.items, n.startOf('month'), n.endOf('month'), 'keluar');
  const persen = Math.round((keluar / db.budget) * 100);
  const sisa = db.budget - keluar;
  const hariSisa = n.endOf('month').diff(n.startOf('day'), 'day') + 1;
  let ikon = '🟢';
  if (persen >= 100) ikon = '🔴';
  else if (persen >= 80) ikon = '🟠';
  const perHari = sisa > 0 ? `\n   ≈ ${rupiah(sisa / hariSisa)}/hari untuk ${hariSisa} hari ke depan` : '';
  return `${ikon} Budget bulan ini: ${rupiah(keluar)} / ${rupiah(db.budget)} (${persen}%)\n   Sisa ${rupiah(Math.max(sisa, 0))}${perHari}`;
}

function catat(text) {
  const c = parseCatatan(text);
  if (!c) return null;
  const db = muat();
  const item = { id: db.nextId++, ...c, kategori: tebakKategori(c.ket, c.tipe), waktu: now().toISOString() };
  db.items.push(item);
  save(FILE, db);

  const n = now();
  const hariIni = totalPeriode(db.items, n.startOf('day'), n.endOf('day'), 'keluar');
  const tanda = c.tipe === 'masuk' ? '➕' : '➖';
  const baris = [`✅ *Tercatat* ${tanda} ${rupiah(c.jumlah)}`, `${item.kategori} — ${c.ket}`, '', `📅 Keluar hari ini: ${rupiah(hariIni)}`];
  const budget = infoBudget(db);
  if (budget) baris.push(budget);
  baris.push('', '_Salah catat? ketik_ `batal`');
  return baris.join('\n');
}

function batal() {
  const db = muat();
  const item = db.items.pop();
  if (!item) return '📭 Belum ada catatan keuangan.';
  save(FILE, db);
  return `↩️ Dibatalkan: ${item.tipe === 'masuk' ? '➕' : '➖'} ${rupiah(item.jumlah)} — ${item.ket}`;
}

function setBudget(text) {
  const arg = text.trim().split(/\s+/)[1];
  const db = muat();
  if (!arg) return db.budget ? infoBudget(db) : '💡 Atur batas pengeluaran per bulan, contoh: `budget 1jt`';
  if (arg === '0' || arg === 'hapus') {
    db.budget = null;
    save(FILE, db);
    return '🗑️ Budget bulanan dihapus.';
  }
  const n = parseNominal(arg);
  if (!n) return '⚠️ Nominal tidak valid. Contoh: `budget 1jt` atau `budget 750rb`';
  db.budget = n;
  save(FILE, db);
  return `✅ Budget bulanan diatur ke ${rupiah(n)}\n\n${infoBudget(db)}`;
}

function periode(text) {
  const t = text.toLowerCase();
  const n = now();
  if (t.includes('kemarin')) return ['Kemarin', n.subtract(1, 'day').startOf('day'), n.subtract(1, 'day').endOf('day')];
  if (t.includes('hari')) return ['Hari ini', n.startOf('day'), n.endOf('day')];
  if (t.includes('minggu')) {
    const senin = n.startOf('day').subtract((n.day() + 6) % 7, 'day');
    return ['Minggu ini', senin, senin.add(6, 'day').endOf('day')];
  }
  if (t.includes('bulan lalu')) {
    const b = n.startOf('month').subtract(1, 'month');
    return [b.format('MMMM YYYY'), b, b.endOf('month')];
  }
  return [n.format('MMMM YYYY'), n.startOf('month'), n.endOf('month')];
}

function rekap(text) {
  const db = muat();
  const [label, mulai, akhir] = periode(text);
  const items = db.items.filter((x) => {
    const w = dayjs(x.waktu).tz(TZ);
    return !w.isBefore(mulai) && !w.isAfter(akhir);
  });
  const header = `💰 *REKAP KEUANGAN*\n🗓️ ${label}`;
  if (items.length === 0) return `${header}\n\n📭 Belum ada catatan.\n\nCatat dengan \`jajan 15rb bakso\` atau \`masuk 500rb kiriman\``;

  const masuk = items.filter((x) => x.tipe === 'masuk').reduce((s, x) => s + x.jumlah, 0);
  const keluar = items.filter((x) => x.tipe === 'keluar').reduce((s, x) => s + x.jumlah, 0);
  const selisih = masuk - keluar;

  const perKategori = {};
  for (const x of items.filter((i) => i.tipe === 'keluar')) perKategori[x.kategori] = (perKategori[x.kategori] || 0) + x.jumlah;
  const kategori = Object.entries(perKategori)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const persen = Math.round((v / keluar) * 100);
      const bar = '▓'.repeat(Math.max(1, Math.round(persen / 10)));
      return `${k}\n   ${bar} ${rupiah(v)} (${persen}%)`;
    });

  const terakhir = items
    .slice(-8)
    .reverse()
    .map((x) => `${x.tipe === 'masuk' ? '➕' : '➖'} ${dayjs(x.waktu).tz(TZ).format('D/M HH.mm')}  ${rupiah(x.jumlah)}  ${x.ket}`);

  const baris = [
    header,
    '',
    `➕ Pemasukan: *${rupiah(masuk)}*`,
    `➖ Pengeluaran: *${rupiah(keluar)}*`,
    `${selisih >= 0 ? '🟢' : '🔴'} Selisih: *${selisih < 0 ? '-' : ''}${rupiah(Math.abs(selisih))}*`,
  ];
  if (keluar > 0) baris.push('', '📊 *Per kategori*', ...kategori);
  const budget = infoBudget(db);
  if (budget && !label.startsWith('Hari') && !label.startsWith('Kemarin')) baris.push('', budget);
  baris.push('', `🧾 *Transaksi terakhir*`, ...terakhir);
  return baris.join('\n');
}

module.exports = { catat, batal, rekap, setBudget, parseCatatan, parseNominal };
