# Bot WhatsApp Pengingat Tugas Google Classroom

Tanya lewat WhatsApp, bot membalas daftar tugas + deadline dari Google Classroom.
Tiap pagi bot juga otomatis mengingatkan tugas yang deadline-nya hari ini/besok.

**Contoh perintah:** `tugas minggu ini`, `tugas minggu depan`, `tugas hari ini`,
`tugas besok`, `tugas belum`, `menu`.

---

## 1. Siapkan akses Google Classroom API (sekali saja)

1. Buka <https://console.cloud.google.com/> → buat project baru (misal `bot-tugas`).
2. Menu **APIs & Services → Library** → cari **Google Classroom API** → **Enable**.
3. Menu **APIs & Services → OAuth consent screen**:
   - User type: **External** → isi nama aplikasi & email.
   - Di bagian **Test users**, tambahkan email Google yang kamu pakai di Classroom.
4. Menu **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Desktop app**.
   - Klik **Download JSON**, ganti namanya jadi `credentials.json`,
     taruh di folder ini (sejajar dengan `package.json`).

> ⚠️ Kalau akun Classroom kamu akun sekolah/kampus (`@sekolah.sch.id` dll), admin
> sekolah bisa saja memblokir aplikasi pihak ketiga. Kalau login ditolak, coba minta
> izin admin atau pakai akun Gmail pribadi yang terdaftar di kelas.

## 2. Install & login

```bash
npm install
```

```bash
npm run login
```

Browser akan terbuka → pilih akun Google → izinkan. Token tersimpan di `token.json`.

Tes dulu tanpa WhatsApp:

```bash
npm run cek -- tugas minggu ini
```

## 3. Atur konfigurasi

Salin `.env.example` jadi `.env`, lalu isi:

- `OWNER_NUMBER` — **kosongkan** kalau bot jalan di nomor WhatsApp kamu sendiri
  (kamu chat bot lewat **"Message yourself" / chat ke diri sendiri**).
  Isi dengan nomormu (misal `6281234567890`) kalau bot jalan di **nomor kedua**.
- `REMINDER_CRON` — jadwal pengingat otomatis (default `0 7 * * *` = jam 07:00 tiap hari).

## 4. Jalankan bot

```bash
npm start
```

QR code muncul di terminal → buka WhatsApp di HP → **Perangkat tertaut → Tautkan
perangkat** → scan. Setelah muncul `✅ Bot WhatsApp siap!`, coba kirim
`tugas minggu ini`.

Sesi WhatsApp tersimpan di folder `auth_wa`, jadi tidak perlu scan ulang
setiap kali.

---

## Telegram (opsional, disarankan)

1. Di Telegram, chat **@BotFather** → `/newbot` → isi nama & username (harus berakhiran `bot`).
   Salin **token** yang diberikan.
2. Chat **@userinfobot** → salin angka **Id** kamu.
3. Isi di `.env`: `TELEGRAM_TOKEN=...` dan `TELEGRAM_OWNER_ID=...`.
4. `NOTIF_KE=telegram` supaya semua notifikasi otomatis masuk ke Telegram.
   `WA_AKTIF=false` kalau mau berhenti pakai WhatsApp sama sekali.

Bot Telegram punya tombol pintas di bawah chat dan perintah `/tugas`, `/jadwal`, `/rekap`, dll.
Hanya akun dengan ID di `TELEGRAM_OWNER_ID` yang dilayani.

## 5. Jalankan 24 jam di HP Android (Termux)

HP cukup pakai WiFi, tidak perlu kartu SIM.

1. Pasang **Termux dari F-Droid** (bukan Play Store).
2. Di laptop, salin `Bot-Tugas-Android.zip` (di `D:\`) ke folder **Download** HP lewat kabel USB.
3. Buka Termux, jalankan satu per satu:
   ```bash
   termux-setup-storage
   pkg update -y && pkg upgrade -y
   pkg install -y nodejs-lts git unzip
   cp /sdcard/Download/Bot-Tugas-Android.zip ~ && cd ~ && unzip -o Bot-Tugas-Android.zip
   cd ~/Bot-Tugas && npm install
   termux-wake-lock
   npm start
   ```
4. Scan QR dari HP utama → WhatsApp → Perangkat tertaut → Tautkan perangkat.
5. Pengaturan HP → Aplikasi → Termux → Baterai → **Tidak dibatasi**. Biarkan HP dicas & tersambung WiFi.

Supaya perintah `status` bisa membaca baterai & suhu HP: pasang aplikasi **Termux:API**
(dari GitHub/F-Droid yang sama dengan Termux), lalu jalankan `pkg install -y termux-api`.

File kiriman WA (caption `simpan <folder>`) tersimpan di `/sdcard/BotTugas/<folder>`.
Data keuangan & pengingat ada di folder `data/`, dan dibackup otomatis ke WhatsApp tiap 23.00.

Menyalakan lagi setelah Termux ditutup: `cd ~/Bot-Tugas && termux-wake-lock && npm start`.
Kalau login Google kedaluwarsa: jalankan `npm run login` di laptop, lalu salin `token.json`
yang baru ke HP (`cp /sdcard/Download/token.json ~/Bot-Tugas/`).

---

## Catatan

- Bot hanya berjalan selama komputer menyala dan `npm start` aktif. Supaya jalan
  24 jam, taruh di VPS/Raspberry Pi atau pakai `pm2`.
- Pakai library tidak resmi `Baileys` (seperti WhatsApp Web, tanpa browser). Untuk
  pemakaian pribadi umumnya aman, tapi jangan dipakai untuk spam.
- "Minggu ini" dihitung **Senin – Minggu** sesuai zona waktu `TZ_NAME`.
- `credentials.json`, `token.json`, dan `auth_wa/` itu rahasia — jangan
  dibagikan.

## Struktur file

| File | Isi |
|---|---|
| `src/index.js` | Bot WhatsApp + jadwal pengingat |
| `src/pesan.js` | Mengartikan perintah & menyusun balasan |
| `src/classroom.js` | Login Google & ambil tugas dari Classroom |
| `src/waktu.js` | Hitung rentang hari/minggu & zona waktu |
| `src/login.js` | `npm run login` |
| `src/cek.js` | `npm run cek` (tes di terminal) |
