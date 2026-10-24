// Helper tanggal & zona waktu (default Asia/Jakarta)
require('dotenv').config();
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
require('dayjs/locale/id');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('id');

const TZ = process.env.TZ_NAME || 'Asia/Jakarta';

function now() {
  return dayjs().tz(TZ);
}

// Rentang [awal, akhir] untuk tiap jenis periode. Minggu = Senin s/d Minggu.
function getRange(kind) {
  const n = now();
  const today = n.startOf('day');
  const monday = today.subtract((today.day() + 6) % 7, 'day');
  switch (kind) {
    case 'hari':
      return [today, today.endOf('day')];
    case 'besok':
      return [today.add(1, 'day'), today.add(1, 'day').endOf('day')];
    case 'minggu':
      return [monday, monday.add(6, 'day').endOf('day')];
    case 'minggudepan':
      return [monday.add(7, 'day'), monday.add(13, 'day').endOf('day')];
    default:
      throw new Error(`Periode tidak dikenal: ${kind}`);
  }
}

module.exports = { dayjs, TZ, now, getRange };
