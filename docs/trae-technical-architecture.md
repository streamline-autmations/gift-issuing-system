# Trae Technical Architecture

Preserved from `.trae/documents/gift-issuing-system-technical-architecture.md` for historical context.

## Summary
- Frontend SPA calling Supabase directly
- Existing schema and RLS assumed
- Static hosting model assumed

## Historical Architecture Notes
- Frontend: React + TypeScript + Vite
- Styling recommendation in Trae doc: Tailwind
- Data fetching recommendation in Trae doc: React Query
- Backend: Supabase only, no separate custom backend

## Historical Route Definitions
- `/login`
- `/`
- `/issues/:issueId`

## Important Preservation Note
These historical route assumptions do not fully match the current application code. The current router lives in `src/main.tsx` and includes `/dashboard`, `/issue`, `/reports`, and `/admin`.

## Historical Supabase Guidance
- Use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Do not expose service-role keys in the frontend
- Respect existing RLS and only use RPC/functions already permitted by the security model

## Historical Deployment Guidance
- Static hosting assumption
- SPA fallback to `index.html`
- Suggested hosts included Vercel, Netlify, and Cloudflare Pages
