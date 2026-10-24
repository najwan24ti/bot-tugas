# Menu pengelola Bot Tugas di HP server (lewat SSH). Jalankan dengan klik dua kali bot.cmd
$ErrorActionPreference = 'Continue'
$Root = Split-Path $PSScriptRoot -Parent
$HpIp = '192.168.0.101'
$HpPort = 8022

function Tunggu { Write-Host ''; Read-Host 'Tekan Enter untuk kembali ke menu' | Out-Null }

function Cek-HP {
    $t = New-Object Net.Sockets.TcpClient
    try { $t.ConnectAsync($HpIp, $HpPort).Wait(3000) | Out-Null; return $t.Connected } catch { return $false } finally { $t.Close() }
}

function Pastikan-HP {
    if (Cek-HP) { return $true }
    Write-Host ''
    Write-Host 'X  HP server tidak bisa dihubungi.' -ForegroundColor Red
    Write-Host '   1. Buka aplikasi Termux di HP (cukup tap ikonnya).'
    Write-Host '   2. Pastikan HP & laptop di WiFi yang sama.'
    Write-Host "   3. Cek IP HP masih $HpIp (Pengaturan > WiFi)."
    return $false
}

function Status-Bot {
    if (-not (Pastikan-HP)) { return }
    Write-Host "OK HP server tersambung ($HpIp)" -ForegroundColor Green
    $sesi = ssh hp 'tmux has-session -t bot 2>/dev/null && echo JALAN || echo MATI'
    if ($sesi -match 'JALAN') { Write-Host 'OK Bot sedang berjalan' -ForegroundColor Green }
    else { Write-Host 'X  Bot tidak berjalan (pilih menu 3 untuk menyalakan)' -ForegroundColor Yellow }
}

function Nyalakan-Bot {
    if (-not (Pastikan-HP)) { return }
    ssh hp '~/.termux/boot/start-bot'
    Write-Host 'OK Bot dinyalakan. Cek dengan /status di Telegram.' -ForegroundColor Green
}

function Matikan-Bot {
    if (-not (Pastikan-HP)) { return }
    ssh hp 'tmux kill-session -t bot 2>/dev/null; true'
    Write-Host 'OK Bot dimatikan.' -ForegroundColor Yellow
}

function Update-Bot {
    if (-not (Pastikan-HP)) { return }
    Write-Host 'Mengirim kode terbaru dari laptop ke HP...'
    Push-Location $Root
    scp -r src package.json package-lock.json hp:Bot-Tugas/
    Pop-Location
    Write-Host 'Memasang library (kalau ada yang baru)...'
    ssh hp 'cd ~/Bot-Tugas && npm install --omit=dev --no-audit --no-fund 2>&1 | tail -2'
    ssh hp 'tmux kill-session -t bot 2>/dev/null; ~/.termux/boot/start-bot'
    Write-Host 'OK Kode terkirim & bot di-restart.' -ForegroundColor Green
}

function Pasang-AutoStart {
    if (-not (Pastikan-HP)) { return }
    Push-Location $Root
    ssh hp 'mkdir -p ~/.termux/boot'
    scp scripts/start-bot.sh hp:.termux/boot/start-bot
    Pop-Location
    ssh hp "chmod +x ~/.termux/boot/start-bot; grep -q 'boot/start-bot' ~/.bashrc 2>/dev/null || echo '~/.termux/boot/start-bot' >> ~/.bashrc; grep -q 'sshd 2>/dev/null' ~/.bashrc || echo 'sshd 2>/dev/null; termux-wake-lock' >> ~/.bashrc"
    Write-Host 'OK Auto-start terpasang: bot & SSH menyala tiap Termux dibuka / HP booting.' -ForegroundColor Green
}

while ($true) {
    Clear-Host
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host '        BOT TUGAS - PANEL KONTROL        ' -ForegroundColor Cyan
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  1. Cek status bot'
    Write-Host '  2. Lihat layar bot (log)     [keluar: Ctrl+B lalu d]'
    Write-Host '  3. Nyalakan bot'
    Write-Host '  4. Restart bot'
    Write-Host '  5. Matikan bot'
    Write-Host '  6. Update kode bot ke HP     [setelah ada perubahan kode]'
    Write-Host '  7. Masuk ke terminal HP      [keluar: ketik exit]'
    Write-Host '  8. Pasang ulang auto-start'
    Write-Host '  0. Keluar'
    Write-Host ''
    $p = Read-Host 'Pilih nomor'
    Write-Host ''
    switch ($p) {
        '1' { Status-Bot; Tunggu }
        '2' { if (Pastikan-HP) { ssh -t hp 'tmux attach -t bot || echo "Bot tidak berjalan."' }; Tunggu }
        '3' { Nyalakan-Bot; Tunggu }
        '4' { Matikan-Bot; Nyalakan-Bot; Tunggu }
        '5' { Matikan-Bot; Tunggu }
        '6' { Update-Bot; Tunggu }
        '7' { if (Pastikan-HP) { ssh hp }; Tunggu }
        '8' { Pasang-AutoStart; Tunggu }
        '0' { exit }
        default { Write-Host 'Pilihan tidak ada.'; Start-Sleep 1 }
    }
}
