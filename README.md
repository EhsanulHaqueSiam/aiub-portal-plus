<div align="center">

# AIUB Portal+

**A browser extension that turns the AIUB Student Portal into a modern, fast workspace — without touching your credentials, without syncing to a server, without leaving the `portal.aiub.edu` session you already trust.**

[![Release](https://img.shields.io/github/v/release/EhsanulHaqueSiam/aiub-portal-plus?color=1d4ed8&label=Release&style=flat-square)](../../releases/latest)
[![Downloads](https://img.shields.io/github/downloads/EhsanulHaqueSiam/aiub-portal-plus/total?color=059669&label=Downloads&style=flat-square)](../../releases)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![WXT](https://img.shields.io/badge/built%20with-WXT-7c3aed?style=flat-square)](https://wxt.dev/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4?style=flat-square)](https://tailwindcss.com/)

### [⬇ Install on Chrome](../../releases/latest/download/aiub-portal-plus-chrome.zip) · [⬇ Install on Firefox](../../releases/latest/download/aiub-portal-plus-firefox.xpi) · [📖 Jump to features](#features) · [🛠 Build from source](#build-from-source)

Built for students who actually *live* in the portal — registering for courses, hunting clash-free routines, checking grades, planning the next semester.

</div>

---

## Contents

- [Features](#features)
  - [Routine Generator](#routine-generator)
  - [Grade Analytics Graphs](#grade-analytics-graphs)
  - [CGPA Planner](#cgpa-planner)
  - [Section highlighting](#section-highlighting-on-offered-courses--registration)
  - [Live class schedule](#live-class-schedule-on-the-home-page)
  - [Filtered Offered Courses](#filtered-offered-courses)
  - [Unified blue design system](#unified-blue-design-system-across-the-portal)
  - [Quick toggle + popup](#quick-toggle--popup)
- [Install](#install)
  - [Chrome / Edge / Brave](#chrome--edge--brave-manifest-v3)
  - [Firefox](#firefox-manifest-v2)
  - [Build from source](#build-from-source)
- [How it works — and what it deliberately does not do](#how-it-works--and-what-it-deliberately-does-not-do)
- [Tech](#tech)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Routine Generator

Pick the courses you want, set filters (earliest start, latest end, seat cap, allowed days, included statuses, gap preference) and the extension builds **every clash-free timetable** from this semester's Offered Courses — inside your own browser, under your own session.

- Course / code / class-ID search with an eligibility shortcut (prerequisites satisfied + offered this semester)
- Pin specific sections or leave the field wide open
- "Minimize gaps" or "rank by off-days first" sort modes
- Paginated results — load more in batches of five
- Registration-open banner that warns when cached data is already stale

<p align="center">
  <img src="docs/screenshots/routine-generator.png" alt="Routine Generator" width="92%">
</p>

### Grade Analytics Graphs

Opens once you've visited your Grade Report pages. Computes **9 charts** from your own data — CGPA trend, semester GPA trend, grade distribution by credits, prerequisite unlock ratio, credits earned, GPA-vs-credit-load correlation, and more. Everything local, nothing transmitted.

<p align="center">
  <img src="docs/screenshots/graphs-dashboard.png" alt="Grade Analytics Dashboard" width="92%">
</p>

### CGPA Planner

Set a target CGPA and see exactly what it takes to get there. The planner reads the Grade Report data your browser already cached and shows:

- **Snapshot** — current CGPA, credits completed vs. the **148-credit BSc CSE minimum**, and academic standing (Dean's list · Very good · Good · Passing · Probation)
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

Sticky toolbar on the Offered Courses page: filter by day, time, status, seat count and search — verified against `FooTable.rows.all` so the count you see is always the real count.

### Unified blue design system across the portal

Every page the extension touches — navbar, sidebar, home greeting banner, Drop Application, Financials, Curriculum, Grade Reports by Curriculum & by Semester, Registration — is re-skinned with a consistent blue/ink palette, editorial typography (Playfair + Geist), and a modern spacing rhythm.

### Quick toggle + popup

Disable the extension in one click when you need the stock portal back.

<p align="center">
  <img src="docs/screenshots/popup.png" alt="Extension Popup" width="320">
</p>

---

## Install

<table>
<tr>
<th width="50%">Chrome / Edge / Brave</th>
<th width="50%">Firefox</th>
</tr>
<tr>
<td valign="top">

**[⬇ Download aiub-portal-plus-chrome.zip](../../releases/latest/download/aiub-portal-plus-chrome.zip)**

1. Unzip somewhere permanent (don't delete the folder after install).
2. Open `chrome://extensions/`.
3. Toggle **Developer mode** (top-right).
4. Click **Load unpacked** → select the unzipped folder.
5. Pin the extension, visit `portal.aiub.edu`, log in as usual.

</td>
<td valign="top">

**[⬇ Download aiub-portal-plus-firefox.xpi](../../releases/latest/download/aiub-portal-plus-firefox.xpi)**

**Quick test** (any Firefox):

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** → pick the `.xpi`.
3. Lasts until you quit Firefox.

**Permanent** (Developer Edition / Nightly / Unbranded):

1. `about:config` → set `xpinstall.signatures.required` to `false`.
2. `about:addons` → gear → **Install Add-on From File…**

Stable Firefox and ESR enforce Mozilla-signed add-ons only — AMO submission is on the [roadmap](#roadmap).

</td>
</tr>
</table>

### Chrome / Edge / Brave (Manifest V3)

See the left column of the table above.

### Firefox (Manifest V2)

See the right column of the table above. Each release ships both `.xpi` and `.zip` — byte-for-byte identical; the extensions just differ for different Firefox install flows.

### Build from source

Requires Node 20+ and pnpm 10+.

```bash
pnpm install

# Chrome (MV3)
pnpm build            # → .output/chrome-mv3/
pnpm zip              # → .output/aiub-portal-plus-<version>-chrome.zip

# Firefox (MV2)
pnpm build:firefox    # → .output/firefox-mv2/
pnpm zip:firefox      # → .output/aiub-portal-plus-<version>-firefox.zip (rename to .xpi for install)

# Dev with hot reload
pnpm dev              # Chrome
pnpm dev:firefox      # Firefox

# Typecheck
pnpm compile
```

Tagged releases are built automatically by [`.github/workflows/release.yml`](./.github/workflows/release.yml): push `vX.Y.Z` and the workflow syncs `package.json`, runs the typecheck, builds both browsers, and uploads the Chrome `.zip`, Firefox `.zip`, and Firefox `.xpi` to a GitHub Release.

---

## How it works — and what it deliberately does not do

This is designed to be a **good citizen** on top of the AIUB portal.

- Your AIUB username and password are **never seen, handled, or stored**. The extension does not render a login form, does not intercept keystrokes, does not hook `fetch`/`XHR` for credentials.
- **No background sync.** The extension only reads portal pages when **you** navigate to them in your own browser. There is no polling, no scheduled job, no worker that wakes up to "refresh" things.
- **No third-party network.** Content scripts only talk to `portal.aiub.edu`, and only *as* the portal — inside your logged-in session. Standalone extension pages currently load fonts from Google Fonts; self-hosting those is tracked on the [roadmap](#roadmap).
- **No analytics, no telemetry.** No event tracking, no error reporting, no remote config.
- **Local-first storage.** Cached Offered Courses, curriculum, grade data, highlights — all in your browser's extension storage. Uninstall and the data is gone.

**AIUB policy, repeated:** never enter your AIUB Portal username and password into any third-party application other than official AIUB platforms. This extension does not ask for your password — it only reads pages you are already logged into.

**This extension is not affiliated with or endorsed by AIUB.** Provided exclusively for educational purposes. Users are expected to act responsibly and comply with all applicable laws, regulations and institutional policies.

---

## Tech

| Layer | Tooling |
|---|---|
| Framework | **[WXT](https://wxt.dev/)** — Vite-powered cross-browser extension framework |
| Popup · CGPA Planner · Graph Dashboard · Routine Generator | **React 19** + **TypeScript 5** + **[Tailwind CSS v4](https://tailwindcss.com/)** with self-hosted fonts via `@fontsource/*` |
| Content scripts | Vanilla DOM + TypeScript — deliberately lean because they graft onto the portal's existing Angular / Bootstrap DOM |
| Charts | **[Chart.js](https://www.chartjs.org/)** (dynamically imported on chart pages) |
| Manifest | **MV3** for Chrome / Edge / Brave · **MV2** for Firefox |

---

## Roadmap

- [x] CGPA Planner migrated to React + TS + Tailwind
- [x] Firefox `.xpi` produced by CI alongside the `.zip`
- [x] Graph Dashboard migrated to React + TS + Tailwind
- [x] Routine Generator migrated to React + TS + Tailwind
- [x] Fonts self-hosted on all standalone pages (zero third-party network)
- [ ] AMO submission for signed Firefox install
- [ ] Chrome Web Store listing

Track these at [Issues](../../issues); feel free to open new ones for anything missing.

---

## Contributing

Issues and PRs welcome. If a portal page looks broken or a feature would genuinely help your workflow, open an issue with a screenshot and the exact URL. Please don't file requests for scraping features that would hit AIUB infrastructure on a schedule — this project deliberately stays user-initiated.

## License

MIT — do what you want, but it's on you to use it responsibly and within AIUB's acceptable-use policy.
