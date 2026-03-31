# Glide Page Scout

Website auditing and sales prospecting intelligence platform.

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (auth, database, edge functions)
- TanStack React Query

## Local Development

```sh
# Install dependencies
bun install

# Copy environment variables and fill in your Supabase credentials
cp .env.example .env

# Start the development server
bun run dev
```

## Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Install the CLI: `brew install supabase/tap/supabase`
3. Link your project: `supabase link --project-ref <your-project-ref>`
4. Apply migrations: `supabase db push`
5. Set secrets: `supabase secrets set GEMINI_API_KEY=... ANTHROPIC_API_KEY=...`
6. Deploy functions: `supabase functions deploy`

## Deployment

Deploy the frontend to Vercel:

1. Connect your GitHub repo to Vercel
2. Set environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`)
3. Build command: `bun run build`
4. Output directory: `dist`
