# Orbit

A daily topic-selection and review system. Each morning it chooses one topic from the Master Topic Library, gives you a time budget and a deadline, and then asks what you learned. Your journal schedules spaced reviews so you return to what you studied before it fades.

## Files

```
orbit/
├── app/
│   ├── globals.css          theme: white, monoline, terracotta accent
│   ├── layout.js            root layout
│   ├── page.js              Today: selection, reveal, accept/reject, reviews due
│   ├── login/page.js        email and password sign in / create account
│   ├── journal/page.js      write entries, confidence, spaced review, memory archive
│   ├── topics/page.js       library controls, custom topics
│   └── log/page.js          decision log
├── components/
│   ├── Shell.js             auth guard, top bar, bottom nav, tap sounds
│   └── Reveal.js            randomized selection animation
├── lib/
│   ├── supabase.js          client
│   ├── dates.js             Nairobi-time date helpers
│   ├── context.js           gathers selector inputs, pages past the 1,000-row cap
│   ├── selector.js          selection engine
│   ├── review.js            SM-2 spaced repetition
│   ├── log.js               decision log writer
│   └── sound.js             synthesized UI sounds
├── data/library.txt         Master Topic Library source
├── scripts/build-library.mjs  turns library.txt into seed.sql
├── supabase/
│   ├── schema.sql           tables, indexes, row level security
│   └── seed.sql             generated library rows (run after schema.sql)
├── .env.example
├── .gitignore
└── package.json
```

## Setup, in order

1. **Supabase.** The project `orbit` (Mumbai, ap-south-1) already exists with the schema applied. Open the SQL editor and run `supabase/seed.sql` once to load the library. It’s safe to re-run.
2. **Supabase Auth.** Authentication > Providers > Email: keep it enabled. Under Authentication > Sign In / Providers, turn Confirm email off if you want instant sign-in with no email step. Under URL Configuration, set Site URL to your Vercel URL.
3. **GitHub.** Create a repo named `orbit`. Upload the files above at their paths.
4. **Vercel.** Import the repo. Add two environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ircuoxjkuszeijribrar.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the legacy `anon` key from Supabase (Project Settings > API Keys > Legacy). The app uses `@supabase/supabase-js` 2.45.4, which expects this format. Row-level security protects the data, so this key is safe in the browser.

   Deploy.
5. **Reminders.** Two daily reminders are already set in your default Reminders list:
   - **6:00 AM**: open Today, accept or reject the topic, check reviews due. You’re awake from 5, so this is the first thing you do, before the day’s load builds.
   - **9:30 PM**: log what you learned. It’s before your 10:45 bedtime and clear of midday, so the entry is written while the day is still fresh.

   Nothing is scheduled at midday on purpose.

## Updating the library

Edit `data/library.txt`. Run `npm run seed` to regenerate `supabase/seed.sql`. Paste only the new rows into the SQL editor. Existing rows are skipped automatically.

## How selection works

- **Auto** (70%): weighted random over the whole library.
- **Cross** (15%): picks from fields linked to the one you studied last.
- **Serendipity** (10%): uniform random, ignores weights.
- **Reinforce** (5%): pulls up fields where your confidence is below 3.
- **Manual**: you choose a field.

Every mode skips topics assigned in the last 14 days, reduces repeats of a field used in the last 2 days, and respects your More / Less / Archive / Remove controls. Difficulty follows your recent confidence. If a topic has an unfinished prerequisite, the prerequisite is chosen instead.

Time budgets: beginner 30 min and 1 day, intermediate 45 min and 2 days, advanced 75 min and 3 days.

## Reviews

Saving an entry with confidence 0–5 schedules the next review with SM-2. A rating under 3 brings the topic back tomorrow. A rating of 4 or higher, after three or more successful reviews, moves the topic to Less, and the decision log records that it happened.

## Access check

This line confirms write access to the repository.
