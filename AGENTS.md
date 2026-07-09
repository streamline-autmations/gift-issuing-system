# AGENTS.md

## Project Overview
- Project name: `gift-issuing-system`
- Primary purpose: internal gift issuing workflow for mining/company operators, backed by Supabase.
- Current app behavior is broader than the original Trae brief and includes issuing, dashboard, reports, and admin flows.
- Source of truth for implementation is the current codebase, not the historical Trae planning docs.

## Tech Stack
- Frontend: React 19, TypeScript, Vite 7
- Routing: `react-router-dom`
- Data fetching: `@tanstack/react-query`
- Styling: Tailwind CSS 4
- Backend/services: Supabase JS client, Supabase SQL migrations, Supabase Edge Function(s)
- Utility scripts: `tsx`, `xlsx`
- Printing support: local Node print server using `puppeteer` and `pdf-to-printer`

## Project-Specific Instructions

### Current App Structure
- Auth gate and route wrapper: `src/App.tsx`
- Router setup: `src/main.tsx`
- Pages:
  - `src/pages/Login.tsx`
  - `src/pages/Dashboard.tsx`
  - `src/pages/Issue.tsx`
  - `src/pages/Reports.tsx`
  - `src/pages/Admin.tsx`
- Shared components: `src/components/`
- Shared utilities: `src/lib/`, `src/utils/`
- Domain types: `src/types.ts`
- Supabase database artifacts: `supabase/migrations/`, `supabase/functions/`
- Admin/data scripts: `scripts/`
- Spreadsheet templates: `templates/`

### Confirmed Supabase Context
- Confirmed project URL: `https://rsxsvgfzzdtlmdaifuxo.supabase.co`
- Confirmed organization name: `gentle koos`
- User-provided associated email: `christiaansteffen123345gmail`
- Historical repo README lists a different email format: `christiaansteffen123@gmail.com`
- Treat the project URL as confirmed. Treat the email discrepancy as historical context that may need manual verification before operational changes.

### Coding Standards
- Preserve existing TypeScript strictness from `tsconfig.app.json` and `tsconfig.node.json`.
- Follow existing path alias usage with `@/*`.
- Keep React code functional and consistent with current patterns.
- Prefer narrowly scoped changes over refactors.
- Do not introduce new dependencies unless clearly required and explicitly approved.
- Keep browser-side Supabase usage limited to anon-key-safe operations.

### Design Preferences
- Prefer the current application’s utilitarian operational style over marketing layout patterns.
- Historical design guidance from Trae is preserved in `docs/trae-page-design.md`.
- Use current app structure and components as the baseline for UI decisions.
- Favor dense, practical workflows for admin/operator use.

### File Structure Rules
- Put historical source context under `docs/`.
- Put reusable AI prompts under `prompts/`.
- Put repeatable human/AI procedures under `workflows/`.
- Put Codex-specific reusable guidance or future skill material under `skills/`.
- Do not move or delete original Trae files.
- Do not rewrite application code during documentation-only migrations.

### Testing and Build Instructions
- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Seed helper: `npm run seed`
- Template generator: `npm run template`
- List local Windows printers: `.\scripts\start-print-server.ps1 -ListPrinters`
- Start local slip print server: `.\scripts\start-print-server.ps1 -PrinterName "Exact Printer Name"`

### AI Assistant Workflow
1. Read the current code before proposing or applying changes.
2. Check `docs/` for preserved project context and historical notes.
3. Use current routes and current schema assumptions from code and migrations, not only Trae planning docs.
4. Keep deployment/account assumptions explicit when they depend on external state.
5. Record any repo/account/config mismatch in `migration-report.md` or a relevant doc before changing behavior.

### Codex Should Always Do
- Inspect the current implementation before editing.
- Preserve historical context when it is still useful.
- Prefer repo-local patterns and existing abstractions.
- Keep secrets out of frontend code.
- Call out mismatches between docs and code before relying on either.
- Keep changes scoped and auditable.

### Codex Should Never Do
- Delete Trae files during migration.
- Assume historical planning docs are fully current.
- Change application behavior as part of documentation migration.
- Install packages without explicit approval.
- Expose service-role credentials in frontend code.
- Overwrite existing files without checking whether they already contain user-managed content.

## General AI Preferences
- Be concise and factual.
- Separate observed facts from assumptions.
- Prefer implementation detail grounded in the repo over generic advice.
- Surface risks early, especially around auth, deployment, and Supabase configuration.
