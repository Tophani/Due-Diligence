# Due Diligence Portal — final design

Product name everywhere: **Due Diligence Portal** (browser tab, headers, emails).
Company line where needed: "TracTrac Mechanization Services Limited".
These screens replace every earlier design. Older design files are no longer used.

## Colours (TracTrac)

| Token | Hex | Use |
|---|---|---|
| `brand` | `#F36A02` | Primary buttons, progress fill, top stripe on header cards, current nav underline, checkmarks, focus border on inputs |
| `brand-light` | `#F79A5B` | Hover on primary buttons and tiles |
| `sand` | `#DCD6CD` | Borders, dividers, progress track, disabled buttons |
| `sand-50` | `#F5F2EE` | Page background (a light tint of sand) |
| `ink` | `#14110F` | All body text, headings, links, logo tile, focus ring |
| `white` | `#FFFFFF` | Cards, inputs |
| `stone` | `#6E6A65` | Secondary text, input underlines, outline-button borders |

Accessibility rules:
- **Primary buttons are orange with ink (#14110F) text.** Never use white text on orange: it fails contrast (3:1).
- Never use orange for text. Links are ink and underlined.
- Use `stone` for secondary text on white or `sand-50` only, never on `sand`.
- Focus ring: 3px solid `ink`, 2px offset.
- The only other colour allowed is `#B42318` for the required `*` and error messages.

Tailwind:
```js
colors: { brand: { DEFAULT: '#F36A02', light: '#F79A5B' }, sand: { DEFAULT: '#DCD6CD', 50: '#F5F2EE' }, ink: '#14110F', stone: '#6E6A65' }
```
Font: IBM Plex Sans (IBM Plex Mono for reference numbers).

## Screens and routes

| File | Route | Who |
|---|---|---|
| vendor/VendorSimpleSignIn | `/signin` (email → code), `/register` | Everyone |
| vendor/VendorSimpleStart | `/` | Vendor |
| vendor/VendorSimpleForm | `/form/:section` | Vendor |
| vendor/VendorSimpleSubmit | `/submit` | Vendor |
| vendor/VendorSimpleStatus | `/submitted` | Vendor |
| admin/AdminSimpleHome | `/admin` | Staff |
| admin/AdminSimpleOrg | `/admin/organisations/:id` | Staff |
| admin/AdminSimpleSetup | `/admin/setup` | Staff (Full access can add; Reviewer reads only) |

## What it does (and nothing more)

**Vendors:** sign in with an emailed code → answer questions and upload files section by section
(autosave) → see "TracTrac already has this document" where staff uploaded it → can remove their
own files until TracTrac marks them reviewed (then the chip shows "Checked by TracTrac", with no
remove button) → submit with one declaration tick → answers lock.

**Staff:**
- Home: four filter tiles, a search, "Send reminder", and "Download Excel".
- Organisation page:
  - "Download" on every file, and "Download all files (ZIP)" for the organisation, with folders per section and files named `2.1.3 – Original_Name.pdf`
  - "Upload a file" on any missing item (the vendor sees "TracTrac already has this document")
  - "Mark as reviewed" per item, with Undo
- Setup: add organisations (sends an invitation), and invite staff with the roles Reviewer or Full access.

Removed on purpose: change requests, approval/rejection, final decisions, questionnaire import,
multiple cycles in the UI, reports beyond the one Excel export.

## Words to use

Vendor progress: Not started · In progress · Submitted · No documents yet
File (staff view): Not yet reviewed · Reviewed by {name}, {date}
File (vendor view): your file name, or "TracTrac already has this document"
