# Store submission kit

Pre-packaged assets and copy for submitting **AIUB Portal+** to the Chrome Web
Store and Mozilla Add-ons (AMO). Nothing here is submitted yet — both stores
require an owner account and manual upload.

## Listing copy

### Name
`AIUB Portal+`

### Short description (≤ 132 chars)
`Routine Generator, Grade Analytics, CGPA Planner and a modern UI for the AIUB Student Portal. Runs entirely in your browser.`

### Full description
```
AIUB Portal+ is an unofficial browser extension that turns the AIUB Student
Portal (portal.aiub.edu) into a modern, fast workspace for students.

FEATURES

• Routine Generator — pick your courses, set filters, and the extension
  builds every clash-free timetable from this semester's Offered Courses,
  inside your own browser.

• Grade Analytics Graphs — nine interactive charts computed locally from
  your cached Grade Report data (CGPA trend, GPA trend, grade distribution,
  prerequisite unlock ratio, credits earned, GPA-vs-credits correlation).

• CGPA Planner — set a target CGPA and see exactly what each ongoing course
  and each remaining semester needs to deliver. Includes academic-standing
  indicator, feasibility verdict, ongoing grade matrix, remaining-credits
  slider, and a trajectory chart toward your target.

• Section highlighting — the Class IDs you chose in the Routine Generator
  are highlighted on Offered Courses and Registration, so you don't have
  to cross-reference between tabs.

• Live class schedule on the Home page with a countdown to the next class.

• Filtered Offered Courses — sticky toolbar for day, time, status, seat
  count and text search.

• Unified blue design system across every portal page the extension
  touches.

PRIVACY

Your AIUB username and password are NEVER seen, handled or stored by this
extension. It does not render a login form and does not intercept keystrokes.
There is no background sync — the extension only reads portal pages when YOU
visit them in your own authenticated session. No analytics, no telemetry,
no remote server. Everything lives in your browser's local storage.

NOT AFFILIATED WITH AIUB

This extension is not affiliated with or endorsed by AIUB. Provided for
educational purposes only. Users are expected to act responsibly and comply
with all applicable laws, regulations, and institutional policies.

AIUB POLICY REMINDER

Never enter your AIUB Portal username and password into any third-party
application other than official AIUB platforms. This extension does not
ask for your password — it only reads pages you are already logged into.
```

### Category
**Chrome Web Store:** Productivity
**AMO:** Other (educational) · alternative: Appearance / Feeds, News & Blogging

### Keywords / tags
`aiub, american international university bangladesh, student portal, routine generator, cgpa calculator, grade analytics, bscse, university, timetable, course registration`

### Official URL
`https://github.com/EhsanulHaqueSiam/aiub-portal-plus`

### Support URL
`https://github.com/EhsanulHaqueSiam/aiub-portal-plus/issues`

### Privacy policy URL
`https://github.com/EhsanulHaqueSiam/aiub-portal-plus/blob/main/docs/privacy-policy.md`

---

## Permission justifications

Each store asks why each permission is needed. Keep answers specific, concrete,
and no broader than the actual behavior. Fails to do this are the #1 reason
listings get rejected.

### Chrome (MV3) — `manifest.json` permissions

- **`activeTab`**
  > Opens the Routine Generator, Graph Dashboard and CGPA Planner on the
  > currently active AIUB Portal tab when the user clicks the extension
  > button. Not used for any other site.

- **`storage`**
  > Persists the user's own Offered Courses list, curriculum, grade report
  > snapshot, highlighted class IDs and extension preferences. All data is
  > stored in the user's local browser (`chrome.storage.local`); nothing is
  > transmitted to any server.

- **`tabs`**
  > Needed to detect when the user is on `portal.aiub.edu` and, from the
  > popup, to open the extension's own pages in a new tab. Not used to
  > read contents of unrelated tabs.

- **Host permission: `https://portal.aiub.edu/*`**
  > The entire feature set targets the AIUB Student Portal. The extension
  > reads pages the user is already viewing (Grade Reports, Offered Courses,
  > Curriculum, Registration, Home) to cache them locally and overlay
  > enhancements. No other domain is accessed.

### Firefox (MV2) — equivalent statement for AMO

Use the same justifications. AMO reviewers are strict on host permissions —
emphasize that `portal.aiub.edu/*` is the *only* origin the content scripts
touch, and that no other network request leaves the browser except for
self-hosted font assets bundled inside the extension.

---

## Screenshots required

Each store has its own sizing:

| Store | Dimensions | Count |
|---|---|---|
| Chrome Web Store | 1280×800 or 640×400 | up to 5 |
| AMO | ≤ 2500×1400 (any landscape) | up to 10 |

Source images live under [`docs/screenshots/`](./screenshots/). Ready-to-upload:

1. **`routine-generator.png`** — full Routine Generator page (crop to 1280×800).
2. **`graphs-dashboard.png`** — Grade Analytics with all 9 charts populated.
3. **`cgpa-planner.png`** — CGPA Planner with target, matrix and trajectory.
4. **`popup.png`** — the extension popup (fits inside 640×400 with padding).

For the Chrome store we need landscape (1280×800). Current captures are
full-page tall. Before submission, **crop each screenshot to the top
1280×800** showing the most important UI.

## Promotional tile (Chrome Web Store, optional)

440×280 or 920×680. Can be a simple banner with the name and a subtitle:
> AIUB Portal+ — modern UI + routine generator + grade analytics for AIUB students.

## Icon

Manifest already ships 16, 32, 48, 96, 128 in `public/icon/`. Chrome
specifically wants a 128×128 PNG at submission.

---

## Pre-submission checklist

- [ ] Bump the version in `package.json` to something ≥ what's on the store.
- [ ] Run `pnpm zip` / `pnpm zip:firefox` locally and verify installs cleanly.
- [ ] Upload `aiub-portal-plus-<version>-chrome.zip` to the Chrome Web Store
      Developer Dashboard (one-time $5 developer fee required).
- [ ] Upload `aiub-portal-plus-<version>-firefox.xpi` to
      [addons.mozilla.org](https://addons.mozilla.org/developers/) — they
      handle signing automatically on approval.
- [ ] Fill in store listing copy from the sections above.
- [ ] Paste permission justifications verbatim.
- [ ] Upload landscape-cropped screenshots.
- [ ] Link privacy policy.
- [ ] Submit for review. Turnaround: 1-3 days for Chrome, up to 10 days for
      AMO full review.

Both stores will reject listings that don't clearly disclose scope and data
handling. This extension is **local-first**, **user-initiated**, and touches
**only** `portal.aiub.edu` — lead every description with those facts.
