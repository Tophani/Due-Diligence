# TracTrac Due Diligence & Compliance Portal — design handoff

Source of truth: the `design/*.dc.html` files in this folder (exported from the Claude Design canvas).
Each file is one screen: plain HTML + inline styles, with `{{hole}}` template bindings,
`<sc-for>` (loops), `<sc-if>` (conditionals), `<dc-import>` (child components) and a
`class Component extends DCLogic` block holding sample data and interaction logic.
Treat them as a **visual + behavioural spec**, not code to ship.

Target stack (from the brief): React (JavaScript ES6+, no TypeScript), Tailwind CSS,
React Router, Node.js/Express, PostgreSQL.

## Screen → route map

| Design file | Route | Notes |
|---|---|---|
| VendorSignIn | `/signin`, `/register`, `/verify`, `/forgot` | 4 modes in one file |
| VendorDashboard | `/` (vendor) | |
| VendorWorkspace | `/assessments/:cycleId/sections/:n` | Centrepiece. Contains all 159 real items as data (`RAW` string) |
| VendorMobile | same as workspace | Mobile behaviour: section navigator becomes bottom sheet; upload sheet offers camera/files |
| VendorReview | `/assessments/:cycleId/review` | Submit disabled until complete + declaration ticked |
| VendorConfirmation | `/assessments/:cycleId/submitted` | |
| VendorStatus | `/assessments/:cycleId/status` | 5 stages; reviewer requests list |
| AdminDashboard | `/admin` | |
| AdminOrganisations | `/admin/organisations` | Add-organisation drawer |
| AdminOrgDetail | `/admin/organisations/:id` | Tabs: overview, documents, history, notes |
| AdminMonitoring | `/admin/monitoring` | 3 separate status columns |
| AdminReview | `/admin/reviews/:submissionId` | 3-panel review, save-and-next |
| AdminUpload | `/admin/uploads/new` | |
| AdminQuestionnaires | `/admin/questionnaires` | |
| AdminImport | `/admin/questionnaires/:id/versions/:v/review` | Publish blocked until warnings resolved + all sections reviewed |
| AdminCycles | `/admin/cycles`, `/admin/cycles/new` | |
| AdminReports | `/admin/reports/:type` | Excel + PDF export |
| VendorHeader, AdminNav | layout components | Shared shells |
| Main | — | Design system reference sheet |

## Design tokens → `tailwind.config.js`

```js
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'], mono: ['"IBM Plex Mono"', 'monospace'] },
      colors: {
        navy: { 900: '#12284C', 950: '#0B1C38', 700: '#1D4E89', 50: '#EEF2F8' },
        teal: { 700: '#0F766E', 800: '#0B5E58', 50: '#E2F3F1' },
        ink: { 900: '#1B2433', 700: '#3A4456', 500: '#5B6577' },
        line: { 200: '#E1E4EA', 100: '#EEF0F3', input: '#C9CED8' },
        canvas: { 50: '#F4F5F7' },
        status: {
          green: '#1A6B40', 'green-bg': '#E6F4EC',
          amber: '#8A4B00', 'amber-bg': '#FDF1DC', 'amber-line': '#F0D29A',
          red: '#A8201A', 'red-bg': '#FCE8E6',
          blue: '#1A54A6', 'blue-bg': '#E6EEFA', 'blue-line': '#C7D7EE',
          grey: '#4E5768', 'grey-bg': '#EEF0F3',
        },
      },
      borderRadius: { control: '8px', card: '10px', dialog: '12px' },
      boxShadow: { sm: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08)', lg: '0 12px 32px rgba(16,24,40,.16)' },
    },
  },
};
```

Rules: navy = structure and primary actions; teal = progress only; status colours only on status.
Buttons 40px (32px dense, 44px touch). Focus ring: 3px `#7FA7E0`, 2px offset.

## Reusable components to build

Button (primary, secondary, teal, ghost, danger, sm, disabled) · Input / Textarea / Select / DateInput / NumberInput ·
YesNoToggle (radio group + conditional detail) · CheckboxGroup · RepeatingTable · UploadDropzone · FileRow
(states: uploading, uploaded, under review, approved, changes requested, failed, provided-by-TracTrac, not applicable) ·
ProgressBar · StatusBadge · SectionNavItem · SectionCard · CollapsibleGroup · DataTable (search, filter, sort) ·
Breadcrumbs · SaveIndicator (saving / saved / error + retry) · Toast · ConfirmDialog · Drawer · EmptyState · Skeleton.

## Status model (keep these as three separate fields)

1. **Requirement status** (per item): `not_started | answered | uploaded | not_applicable | provided_by_tractrac`
   plus review state per file: `awaiting | under_review | approved | changes_requested | rejected | clarification`.
2. **Submission completeness** (per org per cycle): `not_started | defaulter | partial | complete`.
   Defaulter = zero required documents after the cycle's `first_submission_date`.
3. **Compliance outcome** (per org per cycle, set by a reviewer): `pending | compliant | conditionally_compliant | non_compliant`.

Progress = required, visible items that are done ÷ required, visible items. Hidden conditional items don't count.
An item with any `changes_requested` file is not done.

## Data model hints (PostgreSQL)

organisations, org_users, questionnaire_templates, template_versions (immutable once published),
sections, subsections, items (ref, type, required, condition_item_id, condition_value),
cycles (template_version_id, opens_at, first_submission_date, deadline, allow_incomplete_submit),
cycle_assignments, responses, documents (uploaded_by, source: vendor|tractrac, item_id, version),
reviews (document_id, decision, comment, due_date), submissions (reference, submitted_at, declaration),
outcomes, internal_notes, audit_log.
