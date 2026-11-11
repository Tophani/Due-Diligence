# TracTrac portal — simplified design

These 7 screens replace the earlier, more detailed vendor and admin screens.
Keep the existing data, logic and connections; change what people see.

## Vendor (Google Forms style) — `vendor/`

| File | Route | Replaces |
|---|---|---|
| VendorSimpleStart | `/` | Vendor dashboard |
| VendorSimpleForm | `/assessments/:cycleId/sections/:n` | Assessment workspace (+ mobile version) |
| VendorSimpleSubmit | `/assessments/:cycleId/review` | Review page and confirmation page |
| VendorSimpleStatus | `/assessments/:cycleId/status` | Submission status |

- One centred column, max 680px. One white card per question. Red `*` for required.
- No sidebar, status badges, counters, filters or vendor top navigation.
- Files show as small removable name tags under an "Add file" / "Add another file" button.
- "This doesn't apply to us" is a small link that reveals a reason box.
- TracTrac requests show as a red note on that question only.
- Documents TracTrac already holds: "TracTrac already has this document. Nothing to do here."
- Back / Next, "Save and finish later", small "Saving… / All changes saved" note.

## Admin (3 pages) — `admin/`

| File | Route | Replaces |
|---|---|---|
| AdminSimpleHome | `/admin` | Dashboard, Assessment monitoring, Reports |
| AdminSimpleOrg | `/admin/organisations/:id` | Organisation details, Document review workspace, Upload existing documents |
| AdminSimpleSetup | `/admin/setup` | Questionnaire management, Import review, Assessment cycles, User management |

- Top bar with 3 links: Home, Organisations, Setup. No dark sidebar.
- **Home:** 4 clickable numbers that filter one table (No documents yet, In progress,
  Submitted, Waiting for your review), search, "Send reminder" on rows with no documents,
  "Download Excel" (all the old report data in one workbook).
- **Organisation:** sections as an expandable list. Under each document: Approve, or
  Ask for changes (message box, then "Send to vendor"). Missing documents get
  "Add a document we received". Final decision (Approved / Approved with conditions /
  Not approved), enabled once nothing is waiting for review. Internal notes box.
- **Setup:** questionnaire (upload new version, simple "things to check" list with a fix or
  "Leave as is", Publish), assessment cycles (list + inline "Start a new cycle" form),
  staff with two roles: Reviewer and Full access.

## Plain-language status words (use these everywhere)

- Vendor progress: Not started · In progress · Submitted · No documents yet (after the first-submission date)
- Document: Waiting for your review · Approved · Waiting for vendor (changes asked) · Added by TracTrac · Not uploaded yet · Doesn't apply
- Final decision: Approved · Approved with conditions · Not approved

Keep these three kinds of status as separate fields in the data, even though the screens use simple words.
