# Project Structure

## Summary
This repository is a Vite + React + TypeScript application backed by Supabase. It also includes SQL migrations, a Supabase Edge Function, local printing helpers, admin scripts, and spreadsheet templates.

## Top-Level Layout
- `src/` - frontend application code
- `supabase/migrations/` - SQL migrations and schema policy files
- `supabase/functions/` - Supabase Edge Function source
- `scripts/` - local admin and data utility scripts
- `templates/` - spreadsheet templates used by operational workflows
- `public/` - static assets and PWA icons
- `.trae/documents/` - preserved Trae planning documents

## Frontend Layout
- `src/main.tsx` - router and providers
- `src/App.tsx` - auth gate and top-level route flow
- `src/pages/` - page-level screens
- `src/components/` - shared UI components
- `src/context/` - auth context
- `src/lib/` - shared helpers and Supabase client
- `src/utils/` - operational helpers such as printing
- `src/types.ts` - shared domain types

## Current Routes
- `/login`
- `/dashboard`
- `/issue`
- `/reports`
- `/admin`
- `/` redirects to `/issue`

## Operational Scripts
- `scripts/seed-users.ts`
- `scripts/create-company.ts`
- `scripts/add-user.ts`
- `scripts/update-role.ts`
- `scripts/fix-user-access.ts`
- `scripts/ensure-profile.ts`
- `scripts/generate-import-template.ts`
- `scripts/generate-test-workbook.ts`

## Deployment and Runtime Notes
- Static deployment is currently configured for Netlify via `netlify.toml`.
- Local print helpers reference `https://issuing-system.netlify.app`.
- Environment variables are expected through Vite envs:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` for admin scripts only
