# Page Design Spec — Gift Issuing System (Desktop-first)

## Global Styles
- Layout system: CSS Grid for page scaffolding + Flexbox for components.
- Breakpoints: Desktop-first (≥1024px). Collapse to single-column at ≤768px.
- Design tokens:
  - Background: `#0B1220` (app shell), surfaces `#111A2E`
  - Text: primary `#E6EDF7`, secondary `#A9B4C7`
  - Accent: `#5B8CFF` (primary action), danger `#FF5B6E`, success `#39D98A`
  - Radius: 10px; Shadows: subtle elevation for cards
  - Typography: 14px base, 16px body, 20–24px section titles
- Buttons:
  - Primary: solid accent; hover slightly brighter; disabled 40% opacity
  - Secondary: surface + border; hover border accent
- Inputs:
  - Full-width in forms; clear error text under field; focus ring accent
- Loading/empty/error:
  - Inline skeleton rows for tables; empty state copy with a single “primary next action”

## Shared Components
- AppHeader: left logo/title, center breadcrumb (optional), right user menu (name + Sign out).
- PageContainer: max-width 1200px, centered, 24px padding.
- Card: header + body; used for search, issue form, and recent issues.
- Toasts: success/error for issuance results and auth failures.

---

## Page: Login
### Layout
- Centered single-column card, max-width 420px.

### Meta Information
- Title: “Sign in — Gift Issuing”
- Description: “Secure sign in for gift issuing staff.”
- Open Graph: title + description; no image required.

### Page Structure
1. Brand block (app name + brief tagline)
2. Login card

### Sections & Components
- LoginCard
  - Email input
  - Password input (with show/hide toggle)
  - Primary button: “Sign in”
  - Error region: auth error message
  - Optional helper text: “Contact admin if you can’t access your account.”
- Behavior
  - On success: redirect to `/`
  - If already authenticated: auto-redirect to `/`

---

## Page: Gift Issuing Dashboard
### Layout
- Desktop: 2-column grid (left 5/12, right 7/12) with a full-width header row.
- Tablet/mobile: stack cards vertically.

### Meta Information
- Title: “Dashboard — Gift Issuing”
- Description: “Find recipients, issue gifts, and view recent activity.”

### Page Structure
1. AppHeader
2. PageTitle row + quick status (optional)
3. Main grid:
   - Left column: Recipient Lookup + Issue Form
   - Right column: Recent Issues

### Sections & Components
- RecipientLookupCard
  - Search input(s) (based on fields your existing schema supports)
  - Results list/table (name/id + key attributes)
  - Select recipient action
  - Empty state when no matches
- IssueGiftCard
  - Selected recipient summary (read-only)
  - Gift selector (dropdown/table) from existing gifts/catalog data
  - Required issuance fields (e.g., quantity, note) only if present in schema
  - Primary action: “Issue gift”
  - Confirmation summary after success (issued id + timestamp)
  - Validation: block submit until required inputs are present
- RecentIssuesCard
  - Table: issued id, recipient, gift, status, issued_at
  - Row action: “View” → `/issues/:issueId`
  - Filters: recipient (if selected), date range (optional if supported by query)

---

## Page: Issue Details
### Layout
- Single-column container with two stacked cards.

### Meta Information
- Title: “Issue Details — Gift Issuing”
- Description: “View the details and audit fields of an issued gift record.”

### Page Structure
1. AppHeader
2. Back link to dashboard
3. Issue summary card
4. Audit/details card

### Sections & Components
- IssueSummaryCard
  - Prominent Issue ID
  - Recipient name/id
  - Gift name/id
  - Status chip (success/failed/voided only if schema has it)
- AuditDetailsCard
  - Issued by (user id/email if available)
  - Issued at, updated at
  - Any immutable references needed for support/audit
- Behavior
  - If RLS denies access: show “Not authorized to view this issue.” with link back to `/`
