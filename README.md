# Sacred Heart RCIA Ministry Portal

A web app for managing the RCIA ministry at Church of the Sacred Heart:
announcements, important dates, and attendance (absence marking) for
sponsors and catechumens — with four access levels and one-tap sharing
of updates to WhatsApp.

- **Admin** — everything Core Team can do, plus assigning roles to members
- **Core Team** — post announcements & dates, manage sponsor/catechumen pairings, view attendance
- **Sponsor** — view announcements & dates, mark their own attendance
- **Catechumen** — view announcements & dates, mark their own attendance

Cost: **$0/month** at parish scale (Supabase free tier + Vercel free tier).

---

## 1. Create the database (Supabase — 10 min)

1. Go to [supabase.com](https://supabase.com) → sign up (free) → **New Project**.
   - Pick any name/region, set a database password (save it somewhere), wait ~2 min for it to spin up.
2. Once it's ready, open **SQL Editor** (left sidebar) → **New query**.
3. Open `supabase/schema.sql` from this project, copy the whole file, paste it in, click **Run**.
   - This creates all tables, security rules, and a trigger that auto-creates a profile whenever someone signs up.
4. Go to **Project Settings → API**. You'll need two values in the next step:
   - **Project URL**
   - **anon public** key

### Turn off email confirmation (recommended for a small parish)

By default Supabase requires people to click a confirmation email before
they can sign in. For a closed group like this, it's simpler to turn it off:
**Authentication → Providers → Email → toggle off "Confirm email"**.
(You can leave it on if you'd rather people verify their email first — the
app supports both.)

---

## 2. Run it locally to test (optional but recommended)

You'll need [Node.js](https://nodejs.org) installed.

```bash
cd rcia-app
cp .env.example .env
# edit .env and paste in your Supabase Project URL + anon key
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Register your own
account (choose "Catechumen" or "Sponsor" — see below for how to become Admin).

---

## 3. Make yourself Admin

The very first account can't be an Admin through the sign-up form (that's a
deliberate security rule — sign-up only allows Sponsor/Catechumen). To
promote yourself:

1. Register an account in the app normally.
2. In Supabase, go to **Table Editor → profiles**.
3. Find your row, change the `role` column to `admin`, save.
4. Refresh the app — you'll now see "Manage Users", where you can promote
   Core Team members going forward without touching the database again.

---

## 4. Deploy for free (Vercel — 5 min)

1. Push this project to a GitHub repository (or use Vercel's drag-and-drop
   deploy if you don't want to use GitHub — see their docs).
2. Go to [vercel.com](https://vercel.com) → sign up free → **Add New Project**
   → import your repo.
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
4. Click **Deploy**. In about a minute you'll get a live URL like
   `sacred-heart-rcia.vercel.app` — share this with your ministry.

---

## How WhatsApp sharing works

There's no cost-free way to have an app auto-send WhatsApp messages to a
group without Meta's official Business API (which requires business
verification and, past a free monthly quota, starts charging per message).

Instead, every announcement and important date has a **Share to WhatsApp**
button. Tapping it opens WhatsApp with the message already typed out —
whoever posted it (Admin or Core Team) just picks your parish WhatsApp
group and hits send. No setup, no cost, no risk of your number being
blocked by an unofficial automation tool.

If later on you want true automatic delivery (no tap required), the
natural upgrade path is Meta's WhatsApp Cloud API via a provider like
Twilio — the free tier covers a generous number of conversations per
month before any charge applies. That's a separate integration we can add
when you're ready.

---

## Project structure

```
src/
  context/AuthContext.jsx    session + role
  components/Layout.jsx      sidebar nav (changes per role)
  pages/Login.jsx            sign in / register
  pages/Announcements.jsx    announcements + WhatsApp share
  pages/ImportantDates.jsx   calendar of RCIA sessions/rites
  pages/Attendance.jsx       self-service absence marking + Core Team roll-up
  pages/People.jsx           sponsor/catechumen directory + pairing (Admin/Core Team)
  pages/Users.jsx            role management (Admin only)
supabase/schema.sql          full database schema + security rules
```

## Notes on the free tiers

- **Supabase free tier**: 500MB database, 50,000 monthly active users,
  auto-pauses after 1 week of no activity (just visit your Supabase
  dashboard to un-pause — takes a few seconds). Comfortably covers a
  parish RCIA ministry.
- **Vercel free tier**: generous bandwidth/build limits for a low-traffic
  internal tool like this — no cost expected.
