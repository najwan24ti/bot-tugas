// Ambil daftar tugas dari Google Classroom.
const fs = require('fs/promises');
const path = require('path');
const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');
const { TZ, dayjs } = require('./waktu');

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
];
const ROOT = path.join(__dirname, '..');
const CREDENTIALS_PATH = path.join(ROOT, 'credentials.json');
const TOKEN_PATH = path.join(ROOT, 'token.json');

async function loadSavedToken() {
  try {
    const content = JSON.parse(await fs.readFile(TOKEN_PATH, 'utf8'));
    return google.auth.fromJSON(content);
  } catch {
    return null;
  }
}

async function saveToken(client) {
  const keys = JSON.parse(await fs.readFile(CREDENTIALS_PATH, 'utf8'));
  const key = keys.installed || keys.web;
  const payload = {
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  };
  await fs.writeFile(TOKEN_PATH, JSON.stringify(payload, null, 2));
}

// interactive=true membuka browser untuk login Google kalau belum ada token.json
async function authorize({ interactive = false } = {}) {
  const saved = await loadSavedToken();
  if (saved) return saved;
  if (!interactive) {
    throw new Error('Belum login Google. Jalankan dulu: npm run login');
  }
  const client = await authenticate({ scopes: SCOPES, keyfilePath: CREDENTIALS_PATH });
  if (client.credentials.refresh_token) await saveToken(client);
  return client;
}

// Ambil semua halaman dari endpoint list Google API
async function listAll(fn, params, field) {
  const items = [];
  let pageToken;
  do {
    const res = await fn({ ...params, pageToken });
    items.push(...(res.data[field] || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return items;
}

function toDueDate(work) {
  if (!work.dueDate) return null;
  const { year, month, day } = work.dueDate;
  if (work.dueTime && (work.dueTime.hours !== undefined || work.dueTime.minutes !== undefined)) {
    // dueDate + dueTime dari API dalam UTC
    return dayjs.utc(Date.UTC(year, month - 1, day, work.dueTime.hours || 0, work.dueTime.minutes || 0)).tz(TZ);
  }
  // Tanpa jam: anggap akhir hari itu (waktu lokal)
  return dayjs.tz(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 23:59`, TZ);
}

const DONE_STATES = new Set(['TURNED_IN', 'RETURNED']);

let cache = { at: 0, data: null };
const CACHE_MS = 5 * 60 * 1000;

// Mengembalikan [{ course, title, due (dayjs|null), done, link }]
async function getAssignments({ fresh = false } = {}) {
  if (!fresh && cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;

  const auth = await authorize();
  const classroom = google.classroom({ version: 'v1', auth });

  const courses = await listAll(
    (p) => classroom.courses.list(p),
    { studentId: 'me', courseStates: ['ACTIVE'], pageSize: 100 },
    'courses'
  );

  const perCourse = await Promise.all(
    courses.map(async (course) => {
      try {
        const [works, submissions] = await Promise.all([
          listAll(
            (p) => classroom.courses.courseWork.list(p),
            { courseId: course.id, courseWorkStates: ['PUBLISHED'], pageSize: 100 },
            'courseWork'
          ),
          listAll(
            (p) => classroom.courses.courseWork.studentSubmissions.list(p),
            { courseId: course.id, courseWorkId: '-', userId: 'me', pageSize: 100 },
            'studentSubmissions'
          ),
        ]);
        const stateByWork = new Map(submissions.map((s) => [s.courseWorkId, s.state]));
        return works.map((w) => ({
          id: `${course.id}:${w.id}`,
          course: course.name,
          title: w.title,
          due: toDueDate(w),
          done: DONE_STATES.has(stateByWork.get(w.id)),
          link: w.alternateLink,
        }));
      } catch (err) {
        console.error(`Gagal ambil tugas kelas "${course.name}":`, err.message);
        return [];
      }
    })
  );

  const data = perCourse.flat();
  cache = { at: Date.now(), data };
  return data;
}

module.exports = { authorize, getAssignments };
