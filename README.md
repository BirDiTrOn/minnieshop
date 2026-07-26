# Minnieshop

A small marketplace for your Roblox items (Grow a Garden, Blade Ball, etc.):

- **`/`** — public storefront buyers browse and "pay" via your QR code, then tap
  "I've paid" to notify you.
- **`/admin/login`** → **`/admin/dashboard`** — password-protected page for you
  to add/edit/remove listings and confirm or reject payment claims.
- **Telegram notification** — the moment a buyer taps "I've paid," you get an
  instant Telegram message.

**Important honesty note:** this cannot verify that a payment actually
happened — ABA Pay (and most bank QR systems) don't give outside apps access
to your transaction history. The "notify" button just tells you someone
*claims* they paid, with their contact info, at the moment they claim it.
Always check your bank app/ABA Pay history yourself before handing over the
item, then tap "Confirm" in the dashboard. Also worth keeping in mind: most
games' Terms of Service prohibit real-money trading of in-game items, so
there's some inherent account risk on your end.

## 1. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → New project.
2. Once it's created, open **SQL Editor** → paste the contents of
   `supabase/schema.sql` → Run.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → this is `SUPABASE_URL`
   - **service_role key** (not the anon key!) → this is `SUPABASE_SERVICE_ROLE_KEY`

   The service_role key is powerful — never put it in frontend code or share
   it. It's only used inside this project's server-side API routes.

## 2. Create a Telegram bot (free, instant notifications)

1. In Telegram, message **@BotFather** → `/newbot` → follow the prompts.
   You'll get a token like `123456789:AAExample...` → this is `TELEGRAM_BOT_TOKEN`.
2. Start a chat with your new bot (search its username, tap Start) and send
   it any message, e.g. "hi".
3. In your browser, visit:
   `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
   Find `"chat":{"id": ...}` in the response — that number is `TELEGRAM_CHAT_ID`.

## 3. Choose your admin credentials

- `ADMIN_PASSWORD` — the password you'll type to log into `/admin/login`.
- `ADMIN_SESSION_SECRET` — any long random string (used to sign your login
  cookie). You can generate one at [1password.com/password-generator](https://1password.com/password-generator/)
  or run `openssl rand -hex 24` in a terminal.

## 4. Deploy to Vercel (free)

1. Push this folder to a new GitHub repo (or use Vercel's CLI/drag-and-drop
   deploy — GitHub isn't strictly required).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Before deploying, add these Environment Variables (Project Settings →
   Environment Variables):

   ```
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   ADMIN_PASSWORD
   ADMIN_SESSION_SECRET
   TELEGRAM_BOT_TOKEN
   TELEGRAM_CHAT_ID
   ```
4. Deploy. You'll get a URL like `https://minnieshop-yourname.vercel.app`.

   - Buyers use: `https://minnieshop-yourname.vercel.app`
   - You use: `https://minnieshop-yourname.vercel.app/admin/login`

You can add a custom domain later for free under Vercel's Domains settings if
you own one.

## Local development (optional)

```bash
npm install
cp .env.example .env.local   # fill in your real values
npm run dev
```

Then open `http://localhost:3000` and `http://localhost:3000/admin/login`.

## How it works, briefly

- Listings and orders live in Supabase (Postgres).
- All reads/writes go through this app's own `/api/*` routes using the
  Supabase **service role** key — the database itself has no public access
  (Row Level Security is on with zero public policies), so nobody can query
  your data directly even if they found your Supabase URL.
- The admin pages are protected by a simple password → signed cookie check
  in `middleware.js`. This is fine for a personal, low-stakes shop, but it's
  not bank-grade auth — don't reuse a sensitive password for it.
- Buyer photos and your QR code are stored/served as plain files/text, no
  external storage bucket needed, to keep setup to just one service
  (Supabase) plus hosting (Vercel).
