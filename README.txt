OvoBot AI Concierge Platform - Introduction
===========================================

This repository contains an MVP AI Concierge platform focused on hospitality and tourism.
It includes:
- Public website + embeddable chat widget (client)
- Agent/Admin panel (client)
- Fastify API + Socket.IO realtime server (server)
- PostgreSQL + Prisma + pgvector based RAG backend

Main folders
------------
- client/: React + Vite frontend (widget + agent/admin UI)
- server/: Fastify backend, Prisma schema, AI/RAG services
- project.md: incremental implementation log and release notes

Requirements
------------
- Node.js 18+
- PostgreSQL with pgvector extension
- API credentials (Gemini/Translate) in server .env

Quick start
-----------
1. Server setup
   cd server
   npm install
   cp .env.example .env   (or create .env manually)
   npx prisma migrate dev
   npm run seed
   npm run dev

2. Client setup
   cd client
   npm install
   npm run dev

3. Open
   - Landing/widget demo: http://localhost:5173
   - Agent/Admin panel: http://localhost:5173/agent

Production deploy (single URL)
------------------------------
A Docker-based one-domain deployment is included under:
- `deploy/`

Start here:
- `deploy/README.md`

Database full reset (fresh start)
---------------------------------
If you want to wipe and recreate everything:
1. cd server
2. npm run db:reset

This will:
- drop/reset schema via Prisma migrations
- regenerate Prisma client
- run seed again

Seed admin user
---------------
`server/prisma/seed.js` requires:
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD` (minimum 12 chars)

Example:
`SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD='ChangeMe12345!' npm run seed`

Environment notes
-----------------
Server .env should include at minimum:
- DATABASE_URL
- JWT_SECRET
- GEMINI_API_KEY (or equivalent configured provider key)
Optional:
- GOOGLE_TRANSLATE_API_KEY
- CORS_ORIGIN
- LOG_LEVEL

Language support
----------------
Admin panel UI supports:
- Turkish (tr)
- English (en)
- German (de)
- Russian (ru)
- French (fr)

Agent profiles include native language selection. Incoming visitor messages are translated for the assigned agent language when live support is active.

Knowledge Base bulk import
--------------------------
Admin panel now supports bulk import under Knowledge Base.

API endpoint:
- `POST /api/admin/knowledge-base/bulk-import`

Request body:
- `format`: `json` or `csv`
- `mode`: `AUTO`, `DOCUMENT`, `FAQ`
- `payload`: stringified JSON or CSV text

Rules:
- Max 1000 rows per request
- Max 20,000 characters per row content

Mode behavior:
- `AUTO`: detects either `title+content` or `question+answer`
- `DOCUMENT`: requires `title`, `content`
- `FAQ`: requires `question`, `answer` and stores as:
  - `Soru: ...`
  - `Cevap: ...`

Sample JSON payload (`DOCUMENT`):
```json
[
  {
    "title": "Check-in ve Check-out Saatleri",
    "content": "Check-in 14:00, check-out 12:00 olarak uygulanir."
  },
  {
    "title": "Spa Calisma Saatleri",
    "content": "Spa her gun 09:00 - 22:00 arasinda hizmet verir."
  }
]
```

Sample CSV payload (`FAQ`):
```csv
question,answer
"King room kahvalti dahil mi?","Evet, secilen paketlerde acik bufe kahvalti dahildir."
"Havalimani transfer hizmeti var mi?","Talep uzerine ucretli transfer planlanabilir."
```

Template download:
- `GET /api/admin/knowledge-base/import-template?format=json&mode=FAQ`
- `GET /api/admin/knowledge-base/import-template?format=csv&mode=DOCUMENT`

Widget SDK i18n (5 languages)
-----------------------------
The widget SDK supports:
- tr
- en
- de
- ru
- fr

React usage:
```jsx
import { OvoWidget } from './widget-sdk';

export default function Page() {
  return (
    <OvoWidget
      locale=\"de\"
      brandName=\"OvoBot\"
      visitorName=\"Max Mustermann\"
    />
  );
}
```

Advanced i18n override:
```jsx
import { OvoWidget } from './widget-sdk';

const widgetI18nOverride = {
  de: {
    header: { title: 'OvoBot Vertrieb' },
    input: { placeholder: 'Nachricht an OvoBot...' }
  }
};

<OvoWidget locale=\"de\" i18n={widgetI18nOverride} />;
```

Git hygiene
-----------
A root .gitignore is included to prevent pushing:
- node_modules
- build artifacts
- local env files
- logs and OS temp files

Next recommended checks before first push
-----------------------------------------
1. Verify .env files are not tracked (git status)
2. Run client build (cd client && npm run build)
3. Run server syntax check (node --check on changed files)
4. Review project.md for current status and implemented epics
