# AIUB Portal+

A browser extension that turns the AIUB Student Portal into a modern, fast workspace — without touching your credentials, without syncing anything to a server, and without leaving the official `portal.aiub.edu` session you already trust.

Built for students who spend real time in the portal: registering for courses, hunting clash-free routines, checking grades, planning semesters.

[![Release](https://img.shields.io/github/v/release/EhsanulHaqueSiam/aiub-portal-plus?color=1d4ed8&label=Release)](../../releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![WXT](https://img.shields.io/badge/built%20with-WXT-7c3aed)](https://wxt.dev/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4)](https://tailwindcss.com/)

---

## Features

### Routine Generator

Pick the courses you want, set filters (earliest start, latest end, seat cap, allowed days, included statuses, gap preference), and the extension builds **every clash-free timetable** from this semester's Offered Courses — inside your own browser, under your own session.

- Course / code / class-ID search with an eligibility shortcut (prerequisites satisfied + offered this semester)
- Pin specific sections or leave the field wide open
- "Minimize gaps" or "rank by off-days first" sort modes
- Paginated results — load more in batches of five
- Registration-open banner that warns you when cached data may already be stale

<p align="center">
  <img src="docs/screenshots/routine-generator.png" alt="Routine Generator" width="92%">
</p>

### Grade Analytics Graphs

Opens once you've visited your Grade Report pages. Computes **9 charts** from your own data — CGPA trend, semester GPA trend, grade distribution by credits, prerequisite unlock ratio, credits earned, GPA-vs-credit-load correlation, and more. Everything local.

<p align="center">
  <img src="docs/screenshots/graphs-dashboard.png" alt="Grade Analytics Dashboard" width="92%">
</p>

### CGPA Planner

Set a target CGPA and see exactly what it takes to get there. The planner reads the Grade Report data your browser already cached and shows:

- **Snapshot** — current CGPA, credits completed vs. the **148-credit BSc CSE minimum**, academic standing (Dean's list · Very good · Good · Passing · Probation)
- **Target setter** — input any goal CGPA (presets for 3.50 / 3.75 / 3.90 / 4.00), get required average GPA on remaining credits and a feasibility verdict
- **Ongoing courses matrix** — every ongoing course × every possible grade (A+ through F). Click any cell to pick that grade; the summary updates in real time
- **Remaining credits slider** — drag to see where different averages land you, with a live gap-to-target
- **Insights panel** — 8 data-driven cards: trajectory, impact of a single A+ or C, lowest affordable average, semesters to graduation, biggest retake lift, Dean's-list pathway, CGPA ceiling
- **Trajectory chart** — your actual CGPA per semester plus the projected path to your target

<p align="center">
  <img src="docs/screenshots/cgpa-planner.png" alt="CGPA Planner" width="92%">
</p>

### Section highlighting on Offered Courses & Registration

Pick classes in the Routine Generator and those exact Class IDs get highlighted when you open the Offered Courses or Registration page. No more cross-referencing between tabs.

### Live class schedule on the Home page

A unified "today / tomorrow" class strip with a live countdown to your next class — computed entirely from your cached routine.

### Filtered Offered Courses

Sticky toolbar on the Offered Courses page: filter by day, time, status, seat count, and search — verified against `FooTable.rows.all` so the count you see is always the real count.

### Unified blue design system across the portal

Every page the extension touches — navbar, sidebar, home greeting banner, Drop Application, Financials, Curriculum, Grade Reports by Curriculum & by Semester, Registration — is re-skinned with a consistent blue/ink palette, editorial typography (Playfair + Geist), and a modern spacing rhythm.

### Quick toggle + popup

Disable the extension in one click when you need the stock portal back.

<p align="center">
  <img src="docs/screenshots/popup.png" alt="Extension Popup" width="340">
</p>

---

## Install

Download the latest release from the [Releases page](../../releases).

### Chrome / Edge / Brave (Manifest V3)

1. Download `aiub-portal-plus-chrome.zip` and unzip it somewhere permanent.
2. Open `chrome://extensions/`.
3. Toggle **Developer mode** (top-right).
4. Click **Load unpacked** and select the unzipped folder.
5. Pin the extension, visit `portal.aiub.edu`, log in as usual.

### Firefox (Manifest V2)

Each release ships a `.xpi` **and** a `.zip`. Use whichever matches your flow.

**Quick test (any Firefox):**

1. Download `aiub-portal-plus-firefox.xpi` (or `.zip` — same bytes).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and pick the file. Works until you quit Firefox.

**Permanent install (Firefox Developer Edition / Nightly / Unbranded):**

1. Open `about:config` and set `xpinstall.signatures.required` to `false`.
2. Open `about:addons` → gear icon → **Install Add-on From File…** → pick the `.xpi`.

Stable Firefox and ESR enforce Mozilla-signed add-ons only, so distribution via [AMO](https://addons.mozilla.org/) is the eventual path for those channels.

### Build from source

```bash
# Requires Node 20+ and pnpm 10+
pnpm install

# Chrome (MV3)
pnpm build            # → .output/chrome-mv3/
pnpm zip              # → .output/aiub-portal-plus-<version>-chrome.zip

# Firefox (MV2)
pnpm build:firefox    # → .output/firefox-mv2/
pnpm zip:firefox      # → .output/aiub-portal-plus-<version>-firefox.zip  (rename to .xpi if you want)

# Dev with hot reload
pnpm dev              # Chrome
pnpm dev:firefox      # Firefox

# Typecheck
pnpm compile
```

---

## How it works — and what it deliberately does not do

This is designed to be a **good citizen** on top of the AIUB portal:

- Your AIUB username and password are **never seen, handled, or stored** by this extension. It does not render a login form, does not intercept keystrokes, and does not hook `fetch`/`XHR` to scrape credentials.
- **No background sync.** The extension only reads portal pages when **you** navigate to them in your own authenticated browser session. There is no polling, no cron, no worker that wakes up to "update" things.
- **No third-party network.** The only network traffic the content scripts make is to `portal.aiub.edu` — and even that happens *as* the portal (inside your logged-in session). Extension pages load fonts from Google Fonts; everything else is bundled locally.
- **No analytics, no telemetry.** There is no event-tracking, no "report error" ping, no remote config.
- **Local-first storage.** Everything (your cached Offered Courses, curriculum, grade data, highlights) lives in your browser's extension storage. Uninstall the extension and it's gone.

**Reminder, per AIUB's policy**: never enter your AIUB Portal username and password into any third-party application other than official AIUB platforms. This extension does not ask for your password — it only reads pages that you are already logged into.

**This extension is not affiliated with or endorsed by AIUB.** Provided exclusively for educational purposes. Users are expected to act responsibly and comply with all applicable laws, regulations, and institutional policies.

---

## Tech

- **[WXT](https://wxt.dev/)** — cross-browser extension framework (Vite under the hood)
- **React 19** + **TypeScript 5** — popup and the CGPA Planner page
- **[Tailwind CSS v4](https://tailwindcss.com/)** — styling on standalone extension pages
- **Vanilla DOM + TypeScript** — content scripts, because they mount *into* the portal's existing Angular/Bootstrap DOM and must stay lean
- **[Chart.js](https://www.chartjs.org/)** — the graph dashboard and the CGPA trajectory chart
- **Manifest V3** for Chrome / Edge / Brave · **Manifest V2** for Firefox

## Roadmap

- [x] CGPA Planner migrated to React + TS + Tailwind
- [ ] Migrate Graph Dashboard to React + TS + Tailwind
- [ ] Migrate Routine Generator to React + TS + Tailwind
- [ ] Self-host fonts (drop the last third-party network dependency)
- [ ] AMO submission for signed Firefox install

## Contributing

Issues and PRs are welcome. If a portal page looks broken or a feature would genuinely help your workflow, open an issue with a screenshot and the exact URL.

## License

MIT — do what you want, but it's on you to use it responsibly and within AIUB's acceptable-use policy.
