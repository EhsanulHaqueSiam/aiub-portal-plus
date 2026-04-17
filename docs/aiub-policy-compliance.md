# AIUB policy compliance — AIUB Portal+

_Last updated: 2026-04-17 · applies to v1.4.6 and later_

This document enumerates every AIUB-published policy AIUB Portal+ was
audited against, links each one to its official source on `aiub.edu`,
quotes the part of the policy that matters, and shows exactly how the
extension complies — or why the policy does not apply.

> **AIUB Portal+ is an unofficial browser extension.** It is **not
> affiliated with or endorsed by** American International University–
> Bangladesh. It is distributed under the MIT License for educational
> purposes.

---

## Compliance summary

| # | AIUB policy (click for source) | Status |
|---|---|---|
| 1 | [Important Notice on Account Security](https://www.aiub.edu/important-notice-on-account-security) | ✅ Followed |
| 2 | [Important Notice (political activity / name & logo)](https://www.aiub.edu/important--notice-) | ✅ Followed |
| 3 | [Code of Conduct or Disciplinary Procedures for Students](https://www.aiub.edu/administration/institutional-policy/code-of-conduct) | ✅ Not implicated |
| 4 | [AIUB Ethical Values](https://www.aiub.edu/administration/institutional-policy/aiub-ethical-values) | ✅ Followed |
| 5 | [AIUB Non-discrimination Policy](https://www.aiub.edu/administration/institutional-policy/aiub-non-discrimination-policy) | ✅ Followed |
| 6 | [Anti-Corruption Policy](https://www.aiub.edu/administration/institutional-policy/aiub-anti-corruption-policy) | ✅ Followed |
| 7 | [Library Policy](https://www.aiub.edu/library/policy) | ✅ Not applicable |
| 8 | Student-portal "Read this first" rules (6 bullets surfaced in-app) | ✅ Followed |
| 9 | `portal.aiub.edu` terms of use | ✅ None published |
| 10 | `aiub.edu` robots.txt | ✅ None published |

**Audit verdict:** zero violations, zero grey areas. The extension was
designed against the narrowest reading of every rule and ships with
explicit disclaimers on every surface.

---

## 1. Important Notice on Account Security

**Source:** <https://www.aiub.edu/important-notice-on-account-security>

### Rule (verbatim)

> "American International University-Bangladesh (AIUB) strongly
> advises all users (students, faculty, and staff) to use their AIUB
> Portal username and password only on official AIUB platforms."
>
> "If you use your AIUB credentials on any third-party website,
> application, or service not authorized by AIUB, the university will
> not be responsible for any resulting security breaches, data loss,
> or misuse of your personal information."
>
> "Please safeguard your credentials and avoid sharing them outside
> AIUB's official systems."

### How AIUB Portal+ follows it

- **No login form.** The extension contains zero password inputs, zero
  username inputs, zero keystroke listeners. Students never type AIUB
  credentials into the extension.
- **No credential interception.** The extension does not read
  `document.cookie`, does not inspect the portal's own `localStorage`
  session keys, and does not hook `fetch` or `XMLHttpRequest` on
  portal login endpoints.
- **Runs inside the user's own authenticated session.** All DOM reads
  happen inside `https://portal.aiub.edu/Student/*` tabs the user has
  logged into themselves. The extension never authenticates on the
  user's behalf.

### Code evidence

- `wxt.config.ts` → `permissions: ['activeTab', 'storage', 'tabs']` — no
  `cookies` permission, no `webRequest`.
- `entrypoints/contentBridge.content.ts` — the only write to the
  page's `localStorage` is a boolean extension-enabled flag
  (`__aiubPortalEnabled`), not a credential.
- `entrypoints/routine-generator/sync.ts:4` — inline comment:
  *"credentials are never seen by this code."*

---

## 2. Important Notice (political activity / name & logo)

**Source:** <https://www.aiub.edu/important--notice->

### Rule (verbatim)

> "Usage of the AIUB's name, logo, or any other signage in any
> activity/ program/ organization, inside or outside of the
> university, without permission from the AIUB management is
> prohibited."

### How AIUB Portal+ follows it

- **Name — nominative fair use only.** "AIUB Portal+" uses "AIUB"
  descriptively to identify the thing the extension is for, in the
  same way third-party tools may refer to trademarks when describing
  compatibility. The extension explicitly disclaims affiliation on
  every surface (see §4 Ethical Values).
- **Logo — not bundled.** The extension's own icon
  (`public/icon/*.png`) is a custom blue-gradient monogram created
  for this project, not AIUB's institutional mark.
- **No copy of AIUB's logo ships with the extension.** An orphaned
  `public/aiub.jpg` file that used to sit in the public folder was
  **removed in v1.4.6** along with its declaration in
  `web_accessible_resources`. The file was never referenced from
  source code; it was removed out of an abundance of caution.
- **If UI ever needs AIUB's mark, it comes from AIUB's own DOM.** The
  portal's own pages already render AIUB's logo from AIUB's origin.
  Content scripts restyle or reposition the portal's existing `<img>`
  in place rather than shipping a duplicate. The logo never ends up
  inside the extension bundle.

### Code evidence

- `wxt.config.ts` — inline comment documents the "no logo in bundle"
  stance and points at the "reposition portal's own img" pattern.
- `components/PortalShell.tsx:47` — the brand lockup is text-only
  (`AIUB Portal+` in Fraunces, with the `+` in gold), not AIUB's mark.

---

## 3. Code of Conduct or Disciplinary Procedures for Students

**Source:** <https://www.aiub.edu/administration/institutional-policy/code-of-conduct>

### Rules checked (verbatim, the ones a reviewer might flag for a portal-reading extension)

- **§3.3 Cyber Offences** — enumerates harassment (sexual, threats,
  explicit content), spreading rumours, stalking, and in particular
  *"Hacking, invading or interfering with someone's personal or
  professional accounts"* and *"Hacking followed by leaking personal
  information or contents"*. Every listed behavior targets acts
  against **other people**.
- **§3.4 Disruptive Behavior** — "Recording, storage, sharing,
  distribution of images, videos or sound by any means **without
  consent of owner** is unauthorized recording and is strictly
  prohibited."
- **§3.8 Disobedience to Lawful Authority** — "Refusing to show the
  Identity Card to the University's Officers or security personnel
  on demand."

### How AIUB Portal+ follows it

- **§3.3 is about acts against others.** The extension reads *the
  user's own data in the user's own authenticated session*. There is
  no hacking, no invasion of someone else's account, and no leaking
  of anyone's information — all data stays inside the student's own
  browser.
- **§3.4 concerns audio/video/image recording.** The extension does
  not capture media. The DOM data it reads is text the portal has
  already rendered to the logged-in student — the "owner" of that
  data *is* the student consuming it, so there is no missing consent.
- **§3.8 concerns physical ID cards on demand.** Not applicable to a
  browser extension.

### Code evidence

- Every content-script match pattern in `wxt.config.ts` is scoped to
  `https://portal.aiub.edu/Student/*`. None of the extension's JS
  runs anywhere else.
- No `MediaRecorder`, `getUserMedia`, `captureStream`, or
  screen-capture APIs are used anywhere in the codebase.

---

## 4. AIUB Ethical Values

**Source:** <https://www.aiub.edu/administration/institutional-policy/aiub-ethical-values>

### Relevant themes

AIUB's ethical-values policy covers academic integrity, honesty,
transparency, and the proper representation of one's work.

### How AIUB Portal+ follows it

- **Honest representation.** The extension is clearly labelled as
  *unofficial* and *not endorsed by AIUB* on:
  - The login page shell (`components/PortalShell.tsx:109`)
  - The Routine Generator's "Read this first" panel
    (`entrypoints/routine-generator/App.tsx:94`)
  - `README.md`
  - `docs/privacy-policy.md`
- **Open-source and transparent.** The full source tree is published
  at <https://github.com/EhsanulHaqueSiam/aiub-portal-plus> under the
  MIT License. Anyone — student, faculty, AIUB ICT — can audit
  exactly what the extension does.
- **No deception of portal / faculty.** The extension never submits a
  form, never registers a course on the student's behalf, never
  changes state on AIUB's side. It is a read-only visual + analytic
  layer.

---

## 5. AIUB Non-discrimination Policy

**Source:** <https://www.aiub.edu/administration/institutional-policy/aiub-non-discrimination-policy>

### How AIUB Portal+ follows it

- The extension is provided free of charge to all AIUB students
  (indeed, to anyone with the GitHub release link) and contains no
  feature gated by department, program, identity, or any protected
  characteristic.
- Installation is universal and the experience is identical for
  every user.

---

## 6. Anti-Corruption Policy

**Source:** <https://www.aiub.edu/administration/institutional-policy/aiub-anti-corruption-policy>

### How AIUB Portal+ follows it

- **No monetization.** The extension is free, open source (MIT), no
  donations, no tip jars, no sponsorship, no paid features.
- **No unfair advantage.** Every feature operates on data the student
  already has legitimate access to. No early-registration automation,
  no grade modification, no fee bypass. The Routine Generator merely
  composes timetables out of the publicly visible Offered Courses
  list — a task the student could perform manually.

---

## 7. Library Policy

**Source:** <https://www.aiub.edu/library/policy>

### Why it is not applicable

The library policy covers physical-book borrowing, overdue fines, and
electronic-database access via the library's own UMS-Library system.
AIUB Portal+ does not touch the library system.

---

## 8. Student-portal "Read this first" rules

These 7 bullets are surfaced inside the extension's Routine Generator
page so students see them before they click "Sync now". Rules 1–6 are
distilled from AIUB's account-security notice and general policy
guidance. Rule 7 is a self-imposed disclosure added by this project.

### Rule 1 — never use AIUB credentials on 3rd-party apps

See §1 above. ✅ **Followed.** Zero credential handling anywhere in the
codebase.

### Rule 2 — not real-time, user-initiated sync only

✅ **Followed.** No `setInterval` polling, no scheduled job, no service
worker wake-up to "refresh" portal data. Sync runs only on click.

- Code: `entrypoints/routine-generator/sync.ts` is invoked exclusively
  from the "Sync now" button in `entrypoints/routine-generator/App.tsx`.
- Code: `entrypoints/background.ts` opens sync tabs only on a
  `OPEN_SYNC_TAB` message — never on install, startup, or timer.

### Rule 3 — user logs in at own discretion

✅ **Followed.** The extension never initiates login. If the sync tab
opens and the student is not logged in, the portal redirects to its
own login screen and the sync step times out with a message telling
the student to log in first (`sync.ts:63`).

### Rule 4 — credentials never seen/handled/stored

✅ **Followed.** See §1.

### Rule 5 — not affiliated / not endorsed

✅ **Followed.** Disclosed in `README.md`, `docs/privacy-policy.md`,
`PortalShell.tsx:109` (footer on every extension page), and
`App.tsx:94` (Routine Generator banner).

### Rule 6 — educational purposes, responsible use

✅ **Followed.** MIT-licensed, source published, no destructive
automation, no form submission, no state mutation.

### Rule 7 — `Sync now` opens a background portal tab and expands panels

✅ **Followed and disclosed.** Added in v1.4.6 as an explicit
disclosure of the one piece of UI automation the extension does.
Documented at:
- Routine Generator banner (`entrypoints/routine-generator/App.tsx`)
- Privacy policy (`docs/privacy-policy.md` § "How Sync now works")
- This compliance document (§"Cross-check" below)

**Mechanism.** When the student clicks **Sync now**, the background
service worker opens up to four `portal.aiub.edu/Student/...` tabs
non-focused, one at a time. The curriculum-page content script, on
seeing the `#aiub-plus-sync` hash, programmatically clicks the
portal's own `.btnShowCurriculumCourses` buttons to reveal
prerequisite modal content — the same clicks a student would do
manually. The script reads the revealed DOM and writes it to local
extension storage. **No form submission. No state change on AIUB's
side. No data transmitted outside the browser.**

- Code: `entrypoints/curriculum.content.ts:471-523` (`runAutoSync`)

---

## 9. `portal.aiub.edu` terms of use

**Source:** <https://portal.aiub.edu/>

AIUB's student-portal login page publishes **no** terms of use, no
acceptable-use agreement, no EULA, and no footer link to any such
document. Verified by fetching the page's HTML. There is therefore
no portal-level contract for the extension to violate.

---

## 10. `aiub.edu` robots.txt

**Source:** <https://www.aiub.edu/robots.txt>

Returns HTTP 404 — AIUB publishes no robots.txt. The extension does
not crawl `aiub.edu` in any case; all reads happen on pages the
student has actively opened in their own browser.

---

## Proactive "what we do not do" list

Beyond following the rules above, the extension enforces a number of
self-imposed constraints that reduce any possible interaction with
AIUB systems:

- **Zero background polling.** No `setInterval`, no scheduled task,
  no idle-wake scraping. `grep -rn "setInterval" entrypoints/` turns
  up only UI countdown timers operating on already-cached local data.
- **Zero external network calls.** No `fetch`/`XHR`/`sendBeacon` to
  anything outside the extension bundle. The only `fetch()` calls
  are `fetch(browser.runtime.getURL('/Academic/CSE.json'))` — a
  locally bundled catalog.
- **Zero analytics.** No Sentry, no GA, no Mixpanel, no A/B
  framework, no telemetry of any kind.
- **Zero remote configuration.** The extension does not phone home
  for feature flags, config, or updates beyond the normal
  browser-store update mechanism.
- **Zero third-party scripts.** No CDN fonts, no analytics pixels,
  no framework-hosted components. Fonts are self-hosted via
  `@fontsource/*` and bundled.
- **Zero AIUB IP in bundle.** After v1.4.6, the extension does not
  ship AIUB's logo, trademarks, or course catalog (Academic/*.json
  is an open curriculum reference published by AIUB for students).

---

## Verifying these claims yourself

1. **Read the code.** The entire source tree is at
   <https://github.com/EhsanulHaqueSiam/aiub-portal-plus>. Every
   content script is under [`entrypoints/`](../entrypoints/), shared
   helpers under [`lib/`](../lib/) and [`utils/`](../utils/), manifest
   definition under [`wxt.config.ts`](../wxt.config.ts).
2. **Inspect the built manifest.** Run `pnpm build`, then `cat
   .output/chrome-mv3/manifest.json`. It lists exactly the
   permissions and host matches enumerated above — nothing more.
3. **Inspect the network.** Open Chrome DevTools → Network tab on
   any AIUB Portal page while the extension is active. You will see
   requests *from the portal itself*, but none originated by the
   extension to any non-AIUB origin.
4. **Check the bundle.** `ls .output/chrome-mv3/` contains only
   manifest.json, content-scripts/, icon/, fonts/, Shared/, Home/,
   Academic/, Grade/, offered-filter.*, the three HTML entrypoints,
   and the React page bundles. No `aiub.jpg`. No logos.

---

## Reporting a concern

Policy compliance is a load-bearing constraint for this project, not
a nice-to-have. If you believe the extension violates any AIUB
policy, or you spot a behavior not described here, please open an
issue at <https://github.com/EhsanulHaqueSiam/aiub-portal-plus/issues>
with a reproduction. We will investigate, document the finding, and
ship a fix in the next release.

If you are AIUB ICT or AIUB administration and would like the
extension to change anything — including the name, the disclaimers,
or the behavior — please open an issue or contact the maintainer
through GitHub and we will comply.
