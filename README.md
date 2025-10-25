# GiftLink

GiftLink pairs a lightweight Fastify backend with a Vite + React client to make sharing gift ideas feel effortless.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   npm --prefix backend install
   ```
   The backend ships with a default SQLite path; copy `backend/.env.example` to `backend/.env` if you need a different location.
2. Sync the database schema (creates `backend/prisma/dev.db` when needed):
   ```bash
   (cd backend && npx prisma db push)
   ```
3. Start the development server(s) as needed.

## Database Seeding

Seed data helps you preview the Space dashboard and join flow without manual setup.

1. Populate demo data (this also ensures the schema is pushed):
   ```bash
   npm run db:seed
   ```
2. You will see calm confirmation logs similar to:
   ```
   🌱 Preparing demo spaces for GiftLink...
   ✨ Demo spaces ready. Join codes:
   • Alpha Space → "alpha-space"
   • Beta Space → "beta-space"
   🤝 Re-run this seed anytime for a fresh-yet-familiar test bed.
   ```
3. Verify the records if desired:
   ```bash
   (cd backend && npx prisma studio)
   ```
   or run a quick SQL check:
   ```bash
   (cd backend && npx prisma db execute --stdin <<'SQL'
   SELECT joinCode FROM Space;
   SQL
   )
   ```

The seed is idempotent, so you can re-run it whenever you want to reset join codes for manual testing.
