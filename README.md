# AI Lab Giriş Sistemi

Yüz tanıma tabanlı, kiosk modunda çalışan AI Lab giriş/karşılama sistemi.

Mimari ve kapsam için bkz. [PROJECT.md](PROJECT.md).

## Monorepo Yapısı

```
backend/        FastAPI backend (REST + WebSocket), SQLAlchemy + Alembic
face-service/   Python yüz tanıma servisi (şu an mock event üreticisi)
frontend/       Next.js 14 kiosk UI (TS + Tailwind + Framer Motion)
docker/         Dockerfile'lar
docker-compose.yml
```

## Hızlı Başlangıç (Geliştirme)

```bash
cp .env.example .env
docker compose up --build
```

Servisler:
- Backend API + docs: http://localhost:8000/docs
- Backend health: http://localhost:8000/health
- Frontend: http://localhost:3000
- Postgres: localhost:5432, Redis: localhost:6379

Migration'lar backend container başlarken otomatik çalışır (`alembic upgrade head`).

## Mevcut Durum (Faz 1)

- [x] Monorepo + docker-compose, PostgreSQL+pgvector, Redis
- [x] Tam DB şeması (Alembic migration), seed script
- [x] Backend recognition: pgvector eşleştirme, greeting, visit (Redis debounce), presence
- [x] Onboarding akışı (start/update/complete/cancel, mock email + /verify sayfası)
- [x] Visitor kaydı + host bildirimi (mock)
- [x] Users: profil, PATCH, KVKK silme (cascade)
- [x] Leaderboard + canlı dashboard + reservations
- [x] Kiosk UI: AMBIENT, GREETING, UNKNOWN_PROMPT, 5 adımlı ONBOARDING_FORM, VISITOR_MODE, PROFILE (P tuşu)
- [x] **Gerçek InsightFace** (browser camera → /ws/frames → buffalo_l server-side)
- [x] Opsiyonel mock face-service: `docker compose --profile mock up` (kamerasız dev)
- [ ] HTTPS önünde sunma (Samsung TV browser kamera için secure context şart)

## Topoloji

```
[USB kamera + Smart TV browser]
   getUserMedia, 500 ms JPEG  --WS-->  [Server: backend + InsightFace + Postgres + Redis]
   state_change UI  <--WS--
```

Geliştirme için kamerasız kullanmak istersen:
```bash
docker compose --profile mock up      # mock face-service'i de açar
```

## Admin paneli

`/admin` adresinde — kiosk değil, ayrı bir laptop'tan eriş. Bearer token ile korumalı:

1. `.env` içinde `ADMIN_TOKEN=...` (boş bırakırsan panel 503 döner).
2. Tarayıcıda `https://server-ip/admin` aç → token gir → `sessionStorage`'da tutulur.
3. Yapabildiğin: kullanıcı listesi (arama/rol/sıralama), kullanıcı detayı (rol/aktif/opt-in toggle), KVKK silme, aktif misafir + onboarding oturumlarını görme, son ziyaretler feed'i, canlı stat'ler.

Tüm admin yazma işlemleri backend log'una düşer (gelecekte DB audit log'a taşıyacağız).

## TV / Production kurulumu (HTTPS via Caddy)

Samsung Android TV browser `getUserMedia` için **HTTPS secure context** ister. Bunu Caddy (`docker/Caddyfile`) **self-signed sertifikalarla** sağlıyor — frontend + backend tek HTTPS origin'inden sunuluyor (`https://server-ip/`), same-origin olduğu için CORS yok.

### 1. Server'ın hostname/IP'sini Caddy'e ekle
`docker/Caddyfile`'ı aç ve site adresine server'ın IP'sini veya hostname'ini ekle:
```
localhost, 127.0.0.1, host.docker.internal, 192.168.1.50, lab.example.com {
    tls internal
    ...
}
```
Sonra: `docker compose restart caddy`.

### 2. `.env`'de frontend URL'lerini boş bırak
```
NEXT_PUBLIC_BACKEND_URL=
NEXT_PUBLIC_BACKEND_WS_URL=
NEXT_PUBLIC_BACKEND_FRAMES_WS_URL=
```
Frontend bu durumda her şeyi `window.location`'dan türetir — TV `https://192.168.1.50/` açar, kiosk otomatik aynı origin'i kullanır.

### 3. TV'de sertifikayı güvenilir kıl

**Yol A — Caddy root CA'sını TV'ye yükle (önerilen):**

Server'da CA sertifikasını dışarı çıkar:
```bash
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./lab-root-ca.crt
```
Bu `.crt`'i bir USB belleğe at, TV'ye tak, Android TV ayarlarından "Install certificate from storage" ile güvenilir CA olarak ekle. Bir kez yapılır, ondan sonra `getUserMedia` sorunsuz çalışır.

**Yol B — chrome://flags kestirme (hızlı test):**

TV'nin Chrome'unda `chrome://flags/#unsafely-treat-insecure-origin-as-secure` aç, kiosk URL'ini (örn. `https://192.168.1.50`) listeye ekle, "Enabled" yap, Chrome'u restart et. CA yüklemeden secure context elde edersin.

### 4. Kiosk URL'i

TV browser'ı şuna açar:
```
https://<server-ip-veya-hostname>/
```
İlk açılışta kamera izni sorar → "İzin ver" → ekran AMBIENT durumuna geçer ve arka planda her 500 ms backend'e JPEG gönderir.

## Server'da boot deployment (systemd)

Stack'i server boot'ta otomatik ayağa kaldırmak için `deploy/` altındaki systemd unit'i kur:

```bash
cd /opt/ailab        # projeyi nereye yüklediysen
sudo ./deploy/install.sh
```

Bu:
1. `deploy/ailab-kiosk.service` unit'ini `/etc/systemd/system/`'a yazar (project path otomatik gömülür).
2. `daemon-reload` + `enable` + `start` yapar.
3. Bundan sonra her boot'ta `docker compose up -d` çağrılır.

Konteyner içi servisler (`backend`, `frontend`, `postgres`, `redis`, `caddy`) `restart: unless-stopped` ile zaten çökünce kendini toparlar; systemd unit'i sadece **host yeniden başladığında** ilk start'ı sağlar.

**Durum / log:**
```bash
systemctl status ailab-kiosk
journalctl -u ailab-kiosk -f
docker compose ps
docker compose logs -f backend
```

**Kaldırmak için:**
```bash
sudo ./deploy/uninstall.sh           # unit'i kaldır, container'ları durdur, veriyi tut
sudo ./deploy/uninstall.sh --purge   # ek olarak DB ve Caddy CA volume'lerini de sil
```

### Log rotation (önerilen)

Default Docker `json-file` log driver'ı limitsiz büyür. `/etc/docker/daemon.json`'a şunu ekle:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
```

Sonra `sudo systemctl restart docker` ve `sudo ./deploy/install.sh` ile stack'i tekrar kaldır.

### Update / redeploy

Yeni kod çekince:
```bash
cd /opt/ailab
git pull
docker compose build         # değişen image'lar derlensin
sudo systemctl restart ailab-kiosk
```

## TV tarafında kiosk modu (Android TV)

Server boot kurulumu **sadece sunucu için**. TV'nin de açılışta tam-ekran browser ile `https://server-ip/` adresine gitmesini istersen:

- **Google TV / Android TV**: Play Store'dan **Fully Kiosk Browser Lockdown** (popüler, ücretsiz sürümü var) kur. Start URL = `https://server-ip/`, "Launch on boot" + "Auto-reload on error" aç. Self-signed sertifikayı bir kez "Trust" deyince saklar.
- **Alternatif**: `adb` ile `am start` + `LAUNCHER` activity'sini Chrome'a yönlendiren basit bir startup script. Daha "hacky".
- **Sıfır cihaz**: HDMI'a takılı küçük bir mini-PC (NUC / Raspberry Pi 5) — Linux'ta `systemd --user` ile boot'ta `chromium --kiosk https://server-ip/` çalıştır. En sağlam.

## Geliştirme (Docker'sız)

Her servisin kendi README/komutları için ilgili klasöre bakın. Docker önerilir.
