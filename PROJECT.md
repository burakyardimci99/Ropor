# AI Lab Giriş Sistemi — Proje Kapsam Dokümanı

> Bu doküman projenin yaşayan kapsam belgesidir. Faz planı ve mimari kararlar burada tutulur.

## Kararlaştırılmış Seçimler (2026-05-25)

- **Tech stack**: Next.js 14 (TS + Tailwind + Framer Motion) frontend + FastAPI (Python) backend + ayrı Python face-service.
- **İlk session kapsamı**: Monorepo iskelet + docker-compose (postgres+pgvector+redis) + Alembic şema/migration + **mock face-service** (sahte event üreten). UI akışları sonraki session'da.
- **Email**: MVP'de mock/log (gerçek SMTP/cloud sonra).

---

## 1. Vizyon

AI Lab girişinde duran bir sistem. Bir kamera, bir büyük ekran, bir klavye+mouse.

- Lab'a giren kişiyi yüz tanıma ile tanır
- Bağlamlı karşılama gösterir (isim, ziyaret sayısı, son oturum, varsa rezervasyon)
- Lab'ın canlı durumunu yayınlar
- Top 20 leaderboard ve rozetleri gösterir
- Sistemde olmayan kişiyi self-servis kayıt akışına alır
- Tanımlanamayan ama kayıt olmak istemeyeni "ziyaretçi" olarak kabul eder
- Kimse yokken ambient mod'a geçer

İleride: LLM concierge, daily intent, knowledge graph, achievement sistemi.

## 2. Donanım Varsayımları

- Kamera: USB veya IP, min 1080p, lab girişine sabit
- Ekran: 55"+, min 1920x1080, HDMI
- Giriş: USB klavye + mouse
- Host: GPU'lu mini-PC (yüz tanıma inference), Linux önerilir
- Ağ: Lab iç ağı + internet (email + opsiyonel cloud)

## 3. Teknoloji Yığını

| Katman | Seçim |
|---|---|
| Frontend (kiosk UI) | Next.js 14 (App Router) + TypeScript + Tailwind + Framer Motion |
| Backend API | FastAPI (Python 3.11+) |
| Yüz tanıma | InsightFace (buffalo_l, 512-dim embedding) |
| Yüz tespiti | InsightFace SCRFD / YOLOv8-face |
| Veritabanı | PostgreSQL 16 + pgvector |
| Realtime | WebSocket (FastAPI native) |
| Cache / Pub-Sub | Redis |
| Email | SMTP veya Resend/SendGrid (MVP: mock) |
| Kiosk modu | Chromium kiosk mode |
| Process manager | systemd / PM2 |

## 4. Mimari

Üretim topolojisi (2026-05-26 itibarıyla): kamera Smart TV'ye/kiosk-makinasına bağlı, **frame yakalama tarayıcıda**, **ML server'da**.

```
[USB Kamera] → [TV browser: getUserMedia, canvas → JPEG her 500ms] ─WS─→ [Server: InsightFace buffalo_l → recognition] ─WS state─→ [TV browser: UI]
```

Üç ana parça:
1. **frontend** (Next.js, TV browser): kiosk UI + durum makinesi + **kamera frame yakalama** (`useCamera` hook'u JPEG'leri `/ws/frames`'e gönderir).
2. **backend** (FastAPI, server): REST + WebSocket; `/ws/frames`'de **InsightFace buffalo_l** ile yüz tespiti + embedding; pgvector ile en yakın komşu eşleştirme; iş mantığı (onboarding/visitor/visit/presence); UI'ye state push.
3. **face-service** (Python, opsiyonel): kamerasız geliştirme için mock generator. Default'ta kapalı — `docker compose --profile mock up` ile açılır.

## 5. Veri Modelleri

Bkz. `backend/app/models/` ve Alembic migration. Tablolar: users, face_embeddings (vector(512)), visits, visitor_sessions, onboarding_sessions, reservations, badges, user_badges.

## 6. Ekran Durum Makinesi

`AMBIENT → ANALYZING → {GREETING | UNKNOWN_PROMPT | low_confidence}`; UNKNOWN_PROMPT → {ONBOARDING_FORM | VISITOR_MODE}; ONBOARDING_FORM → {GREETING(welcome) | AMBIENT}. 30s inaktivite → AMBIENT.

## 7. Ana Akışlar

- **Tanınan kullanıcı**: threshold > 0.55 eşleşme → visit kaydı (30 dk debounce) → GREETING.
- **Tanınmayan (onboarding)**: 2sn kararlı bilinmeyen yüz, en iyi eşleşme < 0.45 → onboarding_session + UNKNOWN_PROMPT. 5 adımlı form (ad, email, rol, ilgi, KVKK), email doğrulama.
- **Ziyaretçi**: isim + kimi ziyaret → visitor_session (24s geçici embedding) + host bildirimi.
- **Çıkış**: MVP'de pasif — son 5 dk FOV'da görülmezse exited_at doldur.
- **Düşük güven (0.45–0.55)**: "Acaba siz misiniz?" doğrulama.

## 8. API Sözleşmesi

**Browser → backend frame ingest (2026-05-26)**: TV browser kamerayı `getUserMedia` ile yakalar, her ~500 ms 640×480 JPEG'i `/ws/frames` WebSocket'ine **binary** olarak gönderir. Backend her frame'i InsightFace ile decode edip en büyük yüzü tespit eder, 512-dim embedding üretir ve dahili olarak `face_frame`/`face_lost` event'ini recognition pipeline'ına besler.

Backend pgvector ile en yakın komşuyu bulur: similarity ≥ 0.55 → `GREETING` (visit kaydı, 30dk Redis debounce, presence), aksi halde `UNKNOWN_PROMPT` (embedding 5dk Redis'te `embedding_ref` ile tutulur, kiosk onboarding/visitor başlatır).

**Opsiyonel mock face-service** (Python, kamerasız dev): aynı recognition pipeline'ı `/ws/face-service` üzerinden doğrudan `face_frame` event'leriyle besler. `docker compose --profile mock up` ile açılır.

backend ↔ frontend (REST): `/api/onboarding/{start,update,complete,cancel}`, `/api/visitors/register`, `/api/users/me`, `/api/users/:id`, `/api/leaderboard`, `/api/dashboard/live`, `/api/reservations/*`, `/api/verify`.

backend → frontend (WS): `state_change`, `live_update`, `achievement`.

## 9. KVKK / Gizlilik

Yüz biyometriği özel nitelikli kişisel veri — açık rıza şart. Açık rıza (opt-in), aydınlatma metni, silme hakkı (cascade), leaderboard opt-out, veri minimizasyonu (sadece embedding), retention policy (6 ay), şeffaflık göstergesi, audit log, alternatif giriş, VERBİS notu.

## 10. Faz Planı

### Faz 1 — MVP (öncelikli)
- [x] Monorepo + docker-compose + DB şema/migration + mock face-service
- [x] Backend REST + WebSocket (tam) — recognition, onboarding, visitor, users/KVKK, leaderboard, dashboard, reservations
- [x] Visit counter + basit leaderboard
- [x] Canlı dashboard (Redis presence)
- [x] Onboarding akışı backend + UI (email doğrulama mock + /verify sayfası)
- [x] Frontend state machine + tüm ekranlar (AMBIENT/GREETING/UNKNOWN_PROMPT/ONBOARDING_FORM/VISITOR_MODE) — tarayıcıda uçtan uca doğrulandı
- [x] KVKK açık rıza metni UI (onboarding adım 5)
- [x] Profil ekranı (GREETING'de P tuşu): leaderboard opt-out toggle + KVKK veri silme — tarayıcıda doğrulandı
- [x] Gerçek InsightFace entegrasyonu (browser camera → /ws/frames → buffalo_l server-side)
- [x] HTTPS reverse proxy (Caddy + tls internal: tek origin, self-signed CA, WSS upgrade dahil)
- [x] Sunucu boot deployment: systemd unit (`deploy/install.sh`) + `restart: unless-stopped` durable servislerde
- [x] Admin paneli: token auth (Bearer ADMIN_TOKEN), `/admin` sayfası — kullanıcı listesi (arama/rol/sıralama), detay & edit (rol/aktif/opt-in), KVKK silme, aktif misafir+onboarding oturumları, son ziyaretler, canlı stats
- [ ] Gerçek InsightFace entegrasyonu (son adım)

### Faz 2 — Derinleşme
- [x] Rozet/streak motoru (deklaratif katalog, her visit'te otomatik değerlendirme, achievement WS broadcast)
- [x] Admin paneli (token auth, kullanıcı CRUD, sessions, visits, badge backfill)
- [ ] Rezervasyon entegrasyonu (dış API)
- [ ] Daily intent prompt (greeting sonrası)
- [ ] Çıkış kapanış animasyonu
- [ ] Düşük güven 0.45–0.55 "Acaba siz misiniz?" akışı
- [ ] Auto-enrollment (her başarılı tanımada yeni embedding biriktirme)

### Faz 3 — Akıllı katman
LLM concierge, knowledge graph, Slack/email hub, ambient sanat, achievement spotlight, capacity forecast.

## 11. Test Stratejisi

Unit (modeller, embedding karşılaştırma, state machine), Integration (onboarding mock frame'lerle), E2E (Playwright), Manual QA (10+ yüz), FAR/FRR metrikleri.

## 12. Deployment

`docker compose up` (dev). Production: Ubuntu 22.04+, systemd servisleri (lab-backend, lab-face-service, lab-kiosk), chromium --kiosk.

## 13. Açık Sorular (güncel durum)

- Rezervasyon: MVP'de bu sistemde, Faz 2'de dış entegrasyon.
- SSO/LDAP: şimdilik stand-alone.
- Çoklu dil: şimdilik sadece TR.
- GPU: face-service mock ile başlıyor; gerçek InsightFace son adımda.
- Kamera modeli: USB/IP — face-service arkasında soyutlandı.
