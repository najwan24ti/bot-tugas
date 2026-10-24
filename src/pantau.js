// Pantau Classroom berkala: kabar tugas baru & pengingat 3 jam sebelum deadline
const fs = require('fs');
const path = require('path');
const { getAssignments } = require('./classroom');
const { now } = require('./waktu');
const { formatItem, urutkan } = require('./pesan');
const { kuliahAkanMulai } = require('./jadwal');

const STATE_PATH = path.join(__dirname, '..', 'state.json');
const JAM_SEBELUM_DEADLINE = 3;

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// Mengembalikan daftar pesan yang perlu dikirim (bisa kosong)
async function cekClassroom() {
  const all = await getAssignments({ fresh: true });
  const state = loadState();
  const pesan = [];

  // Pertama kali jalan: catat semua tugas yang ada tanpa mengirim kabar
  if (!state) {
    saveState({ known: all.map((a) => a.id), deadlineSent: [] });
    return pesan;
  }

  const known = new Set(state.known);
  const deadlineSent = new Set(state.deadlineSent);

  const baru = urutkan(all.filter((a) => !known.has(a.id)));
  if (baru.length > 0) {
    pesan.push(`🆕 *Ada ${baru.length} tugas baru di Classroom!*\n\n${baru.map(formatItem).join('\n\n')}`);
  }

  const batas = now().add(JAM_SEBELUM_DEADLINE, 'hour');
  const mepet = urutkan(
    all.filter((a) => !a.done && a.due && a.due.isAfter(now()) && !a.due.isAfter(batas) && !deadlineSent.has(a.id))
  );
  if (mepet.length > 0) {
    pesan.push(
      `🚨 *Deadline kurang dari ${JAM_SEBELUM_DEADLINE} jam & belum dikumpulkan!*\n\n${mepet.map(formatItem).join('\n\n')}`
    );
  }

  const ids = new Set(all.map((a) => a.id));
  saveState({
    // Gabung dengan yang lama, supaya kelas yang sempat gagal diambil tidak dianggap "baru" lagi
    known: [...new Set([...known, ...ids])],
    // Simpan hanya id yang masih ada supaya file tidak membengkak
    deadlineSent: [...deadlineSent, ...mepet.map((a) => a.id)].filter((id) => ids.has(id)),
  });
  return pesan;
}

// Pesan pengingat kuliah yang mulai `menit` menit lagi, atau null
function cekKuliah(menit = 30) {
  const list = kuliahAkanMulai(menit);
  if (list.length === 0) return null;
  return list
    .map((k) => {
      const extra = k.catatan ? `\n📝 ${k.catatan}` : '';
      return `🔔 *${menit} menit lagi kuliah!*\n📖 *${k.matkul}*\n🕐 ${k.mulai.replace(':', '.')}–${k.selesai.replace(':', '.')}\n👤 ${k.dosen}\n📍 ${k.ruang}${extra}`;
    })
    .join('\n\n');
}

module.exports = { cekClassroom, cekKuliah };
