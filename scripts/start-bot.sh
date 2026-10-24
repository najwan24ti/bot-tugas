#!/data/data/com.termux/files/usr/bin/sh
# Auto-start Bot Tugas saat HP selesai booting (dipakai Termux:Boot).
# Pasang: salin ke ~/.termux/boot/start-bot lalu `chmod +x ~/.termux/boot/start-bot`

# Cegah HP "tidur" & nyalakan server SSH (port 8022)
termux-wake-lock
sshd 2>/dev/null

# Jalankan bot di sesi tmux "bot". Kalau bot crash/berhenti, otomatis dinyalakan lagi 10 detik kemudian.
# Lihat bot: `tmux attach -t bot`  ·  keluar tanpa mematikan: Ctrl+B lalu d
tmux has-session -t bot 2>/dev/null || tmux new-session -d -s bot \
  'cd ~/Bot-Tugas; while true; do npm start; echo "Bot berhenti. Menyala lagi dalam 10 detik (Ctrl+C dua kali untuk batal)..."; sleep 10; done'
