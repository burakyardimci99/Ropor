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

- [x] Monorepo yapısı + docker-compose
- [x] PostgreSQL + pgvector + Redis
- [x] Tam DB şeması (Alembic migration)
- [x] Backend recognition: pgvector eşleştirme, greeting, visit (Redis debounce), presence
- [x] Onboarding akışı (start/update/complete/cancel, mock email)
- [x] Visitor kaydı + host bildirimi (mock)
- [x] Users: profil, PATCH, KVKK silme (cascade)
- [x] Leaderboard + canlı dashboard + reservations
- [x] Mock face-service (embedding üretir; demo "known" vektör ile tanıma çalışır)
- [x] Next.js placeholder (canlı state akışını gösterir)
- [x] Seed script: `docker compose exec backend python -m app.seed`
- [ ] UI durum makinesi ve tüm ekranlar (sonraki adım)
- [ ] KVKK metni UI + opt-out toggle
- [ ] Gerçek InsightFace entegrasyonu (son adım)

## Geliştirme (Docker'sız)

Her servisin kendi README/komutları için ilgili klasöre bakın. Docker önerilir.
