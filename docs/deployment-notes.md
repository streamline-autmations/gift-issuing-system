# Deployment Notes

## Confirmed Supabase Context
- Confirmed project URL: `https://rsxsvgfzzdtlmdaifuxo.supabase.co`
- Confirmed organization name: `gentle koos`
- User-provided associated email: `christiaansteffen123345gmail`

## Historical Supabase Context in Repo
- `README.md` contains:
  - GitHub account: `gentle-koos`
  - linked email: `christiaansteffen123@gmail.com`
  - same Supabase project URL: `https://rsxsvgfzzdtlmdaifuxo.supabase.co`

## Note on Email Discrepancy
Two email forms now exist in project context:
- `christiaansteffen123345gmail` from user clarification
- `christiaansteffen123@gmail.com` from historical `README.md`

The project URL is consistent. The email should be manually verified before relying on it for account recovery or access operations.

## Current Hosting Clues
- Netlify config exists in `netlify.toml`
- Local print server allows requests from `https://issuing-system.netlify.app`
- No repo-local evidence of an active Vercel project configuration was found

## Environment Variables
From `.env.example`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Caution
- `README.md` currently contains live-looking account and credential information. Treat that file as sensitive operational context and review it before sharing the repository externally.
