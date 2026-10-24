// Login Google sekali saja; token disimpan ke token.json
const { authorize } = require('./classroom');

authorize({ interactive: true })
  .then(() => console.log('✅ Login Google berhasil. Token tersimpan di token.json'))
  .catch((err) => {
    console.error('❌ Login gagal:', err.message);
    process.exit(1);
  });
