# Privacy policy — AIUB Portal+

_Last updated: 2026-04-17_

**AIUB Portal+** ("the extension") is an unofficial browser extension that
enhances the AIUB Student Portal at `portal.aiub.edu`. This policy describes
what data the extension reads, where it stores it, and what it does not do.

## Summary

- The extension does **not** see, handle, request or store your AIUB username
  or password.
- The extension does **not** transmit any data to any server controlled by
  the author or any third party. It has no analytics, telemetry or
  remote-logging of any kind.
- All data the extension caches lives in your browser's local extension
  storage. It is wiped when you uninstall the extension.

## What the extension reads

The extension contains content scripts that run **only** on pages matching
`https://portal.aiub.edu/Student/*`, and **only while you are viewing those
pages in your own browser**. There is no background sync, no scheduled task,
no cron job. The content scripts read the DOM of the pages you open — exactly
the same HTML the portal already renders to you — and extract:

- Your name, student ID and program (for the shell UI)
- Your Offered Courses for the current semester (for the Routine Generator)
- Your Grade Report (by Curriculum + by Semester) — course list, grades,
  states, CGPA, semester trends
- Your Curriculum — prerequisite information, course states
- Your selected timetable from the Routine Generator (for the highlight
  feature)

## What the extension stores

All of the above is cached in `browser.storage.local` — a per-profile,
per-extension key-value store inside your own browser. It is never sent
anywhere. The keys used:

- `aiubStudent` — your name and student ID
- `aiubOfferedCourses` — cached Offered Courses list
- `aiubCurriculum` — cached curriculum + prerequisite data
- `aiubGraphData` — cached Grade Report data (curriculum + semester)
- `aiubRegistrationStatus` — whether registration is currently open
- `aiubHighlights` — your chosen routine's class IDs for the highlight
  feature
- Extension-toggle preference

When you uninstall the extension, Chrome / Firefox delete this data
automatically.

## What the extension does NOT do

- **No credential handling.** The extension does not render a login form,
  does not attach keystroke listeners, does not intercept `fetch` or `XHR`
  requests for credentials, does not read cookies or `localStorage` of the
  portal, and does not call AIUB login endpoints.
- **No third-party network calls from content scripts.** Content scripts
  only read the DOM of pages *you* are already viewing. They do not initiate
  network requests to any server.
- **No external network calls from extension pages.** The standalone
  extension pages (Routine Generator, Graph Dashboard, CGPA Planner, popup)
  are rendered entirely from locally bundled assets. Fonts are self-hosted
  via `@fontsource/*`.
- **No analytics.** There is no event tracking, no crash reporting, no
  remote configuration, no A/B testing framework.
- **No scraping on a schedule.** The extension refuses to poll the portal
  in the background. Sync is always initiated by the user visiting a page.

## Permissions and why they are needed

| Permission | Why |
|---|---|
| `activeTab` | Open the extension's own pages on the active AIUB tab. |
| `storage` | Persist your own Offered Courses, curriculum, grades and highlight list — locally, in your browser. |
| `tabs` | Detect whether the active tab is `portal.aiub.edu` and open the extension's pages in a new tab. |
| Host: `https://portal.aiub.edu/*` | Content scripts that overlay enhancements on AIUB Portal pages. The only origin the extension touches. |

## Third-party services

- **None.** The extension does not integrate with any third-party service.
  All icons are local, all fonts are bundled locally, all data is local.

## Data sharing

The extension does **not** share data with anyone. There is no author-run
server to share with.

## Changes to this policy

If the privacy model ever changes, this file will be updated and a new
extension release will be published describing the change.

## Contact

For questions or concerns:

- Open an issue on GitHub:
  [github.com/EhsanulHaqueSiam/aiub-portal-plus/issues](https://github.com/EhsanulHaqueSiam/aiub-portal-plus/issues)

## Disclaimer

**AIUB Portal+ is not affiliated with or endorsed by American International
University–Bangladesh (AIUB).** It is an unofficial, student-maintained
enhancement suite provided exclusively for educational purposes. Users are
expected to act responsibly and comply with all applicable laws, regulations,
and institutional policies — including AIUB's policy that the Portal's
credentials must never be entered into third-party applications.
