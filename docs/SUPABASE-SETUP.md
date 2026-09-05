# CardSignal Supabase Setup

CardSignal's cloud account shell is already wired. It remains dormant until the two public Supabase environment variables are configured.

## 1. Create a Supabase project

Create a free Supabase account and a new project for CardSignal.

## 2. Create the database tables and security policies

Open the Supabase SQL Editor and run the complete contents of:

`supabase/schema.sql`

This creates:

- `profiles` — one display username per authenticated account
- `user_state` — one private CardSignal state document per authenticated user
- Row Level Security policies so authenticated users can only read/write their own rows

## 3. Authentication settings

For the POC, use Email + Password authentication.

CardSignal asks for a display username during account creation, but authentication is tied to the Supabase user ID and email/password. This prevents usernames from being used as the security boundary.

For immediate testing, either disable email confirmation in Supabase Auth settings or confirm the signup email before signing in.

## 4. Environment variables

Add these to local `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Publishable / anon key>
```

Do not commit secrets to GitHub. The public anon key is intended for browser use, but database security still depends on Row Level Security policies.

Add the same variables to the Vercel project Environment Variables before deploying.

## 5. First login / migration

When cloud auth is configured, CardSignal shows a login screen.

If an account is signed into a browser that already contains local CardSignal data, CardSignal asks whether to:

- **USE THIS DEVICE** — upload the current browser collection/history to that account
- **LOAD CLOUD COPY** — replace the current browser state with the account's existing cloud collection

After the first choice, CardSignal periodically synchronizes the major collection/history/settings keys to the authenticated user's cloud row.

## Family use

Separate brother/son accounts should use separate authenticated accounts so each gets a different Supabase user ID and private collection. A later Family Profiles feature can allow a parent account to manage child profiles without requiring separate email addresses.
