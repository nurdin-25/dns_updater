# Ì∫Ä DNS Updater

Web UI + API untuk menambahkan **subdomain A record** ke **Google Cloud DNS** menggunakan **Service Account**.  
Didesain agar ringan, bisa di-deploy di server internal, dan mudah digunakan oleh tim non-technical.  

---

## ‚ú® Features
- Web UI sederhana untuk input subdomain + IP
- API endpoint (REST) untuk integrasi otomatis
- Authentication via Basic Auth (username/password)
- Menggunakan Google Cloud DNS API
- Bisa dijalankan di PM2 dan diakses via Apache2/Nginx reverse proxy

---

## ‚öôÔ∏è Setup

### 1. Clone repo
```bash
git clone https://github.com/nurdin-25/dns_updater.git
cd dns_updater

