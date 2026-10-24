// Tes tanpa WhatsApp. Contoh: npm run cek -- tugas minggu ini
const { parseCommand, buildReply } = require('./pesan');

const text = process.argv.slice(2).join(' ') || 'tugas minggu ini';
const kind = parseCommand(text) || 'menu';

buildReply(kind)
  .then((reply) => console.log(reply))
  .catch((err) => {
    console.error('❌', err.message);
    process.exit(1);
  });
