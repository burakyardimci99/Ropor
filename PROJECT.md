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

Üç ana servis:
1. **face-service** (Python): kameradan frame, tespit, embedding, en yakın eşleşme; backend'e WS event yayar (`face_detected`, `face_recognized`, `face_unknown`, `face_lost`).
2. **backend** (FastAPI): iş mantığı, REST, WebSocket; UI'ye state push.
3. **frontend** (Next.js): kiosk UI, durum makinesi, animasyonlar, klavye etkileşimi.

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

face-service → backend (WS) — **evrim (2026-05-25)**: Eşleştirmeyi **backend** yapıyor (DB sahipliği backend'de, face-service ince kalıyor; ayrıca KVKK veri minimizasyonu — kayıt olmayan geçici yüz için DB satırı yazılmaz). Olaylar:
- `{"type":"face_frame","embedding":[...512],"quality":float}` — kararlı bir yüz görüldüğünde
- `{"type":"face_lost"}` — kameradan çıkınca

Backend pgvector ile en yakın komşuyu bulur: similarity ≥ 0.55 → `GREETING` (visit kaydı, 30dk Redis debounce, presence), aksi halde `UNKNOWN_PROMPT` (embedding 5dk Redis'te `embedding_ref` ile tutulur, kiosk onboarding/visitor başlatır).

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
- [ ] Kiosk deployment (systemd + chromium)
- [ ] Gerçek InsightFace entegrasyonu (son adım)

### Faz 2 — Derinleşme
Rozet/streak, rezervasyon entegrasyonu, daily intent, çıkış animasyonu, düşük-güven akışı, auto-enrollment, admin paneli.

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
