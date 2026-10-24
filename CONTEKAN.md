# Contekan Bot Tugas

## Cara paling gampang
Klik dua kali **`bot.cmd`** di folder `D:\Bot-Tugas`, lalu pilih nomor menu.

| No | Menu | Kapan dipakai |
|---|---|---|
| 1 | Cek status bot | Mau tahu bot hidup atau mati |
| 2 | Lihat layar bot | Lihat log / error. Keluar: **Ctrl+B** lalu **d** |
| 3 | Nyalakan bot | Bot mati |
| 4 | Restart bot | Bot aneh / macet |
| 5 | Matikan bot | Mau berhenti sementara |
| 6 | Update kode bot ke HP | Setelah kode di laptop diubah |
| 7 | Masuk ke terminal HP | Mau ketik perintah sendiri. Keluar: `exit` |
| 8 | Pasang ulang auto-start | Kalau skrip auto-start hilang / HP di-reset |

## Kalau HP server restart / mati lampu
1. Di HP: **tap ikon Termux sekali**. SSH & bot menyala sendiri.
2. Cek: kirim `/status` ke **@Tugas_juan_bot** di Telegram.

## Posisi kamu di mana?
| Tanda di layar | Kamu ada di | Pakai `ssh hp`? |
|---|---|---|
| `PS D:\...>` | Laptop (PowerShell) | Ya |
| `~ $` | HP (Termux) | Tidak, langsung ketik perintahnya |

## Perintah manual (kalau tidak pakai menu)
Di PowerShell laptop:

| Mau apa | Ketik |
|---|---|
| Masuk ke HP | `ssh hp` |
| Lihat bot | `ssh -t hp "tmux attach -t bot"` |
| Nyalakan bot | `ssh hp "~/.termux/boot/start-bot"` |
| Matikan bot | `ssh hp "tmux kill-session -t bot"` |
| Kirim file ke HP | `scp namafile hp:Bot-Tugas/` |

Di dalam HP (`~ $`):

| Mau apa | Ketik |
|---|---|
| Lihat bot | `tmux attach -t bot` |
| Keluar dari layar bot (bot tetap jalan) | **Ctrl+B** lalu **d** |
| Nyalakan bot | `~/.termux/boot/start-bot` |
| Cek bot jalan | `tmux ls` |
| Keluar dari HP | `exit` |

## Git (simpan perubahan kode ke GitHub)
Di PowerShell `D:\Bot-Tugas`:
```
git add -A
git commit -m "pesan perubahan"
git push
```

## Data penting
| Hal | Nilai |
|---|---|
| IP HP server | `192.168.0.101` (cek di Pengaturan > WiFi kalau berubah) |
| User Termux | `u0_a378`, port SSH `8022` |
| Bot Telegram | @Tugas_juan_bot |
| Repo GitHub | github.com/najwan24ti/bot-tugas |

Kalau IP HP berubah: ubah `HostName` di `C:\Users\Ahmad\.ssh\config` dan `$HpIp` di `scripts\bot.ps1`.
