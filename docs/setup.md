# Local Development Setup

Use this guide to configure Supabase credentials without committing secrets.

## Prerequisites
- Node.js 18+ and npm.
- Supabase project URL and anon key with access to the `games` table.

## 1. Install dependencies
```bash
npm install
```

## 2. Create your `.env`
```bash
cp .env.example .env
```
Edit `.env` and provide:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=anon-key
```

## 3. Generate `config.js`
```bash
npm run build:config
```
The script reads `.env` and writes `config.js` (already gitignored). Re-run this command anytime you rotate Supabase credentials.

### Optional flags
You can point to alternative files if needed:
```bash
node scripts/generate-config.js --env .env.staging --out public/config.js
```

## 4. Run the site
Serve the repository with any static server, e.g.:
```bash
python -m http.server 8080
```
Open `http://localhost:8080` and the app will load credentials from the generated `config.js`.

## Troubleshooting
- **Missing .env** – The generator will exit with instructions if `.env` is not found. Copy `.env.example` and try again.
- **Undefined variables** – Ensure both `SUPABASE_URL` and `SUPABASE_ANON_KEY` are present and do not contain quotes.
- **Stale config** – Delete `config.js` and rerun `npm run build:config` after updating `.env`.
