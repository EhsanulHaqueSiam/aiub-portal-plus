/* Canonical UI disclosure strings.
 *
 * These sentences are repeated across the extension's surfaces (sidebar
 * footer, Routine Generator policy panel, popup, etc.) and need to stay
 * in lockstep — if the legal/policy wording ever changes, it should
 * change in one place, not grep-and-replace across the tree.
 *
 * Every sentence here is a single user-facing unit; do not build copy by
 * concatenating these (other than bullet pairs, where the first fragment
 * is the bold lead-in and the second is the body). Markdown docs under
 * `docs/` intentionally keep their own wording for their audience
 * (privacy policy, store-submission kit, etc.) — these constants are for
 * UI only. */

/** Tiny pill / chip label. Used on every extension page's sidebar footer
 *  and anywhere else a compact "this is unofficial" marker is needed. */
export const UNOFFICIAL_TAG = 'Unofficial extension';

/** One-line affiliation disclaimer — the short form, suitable for a
 *  footer or banner. */
export const NOT_AFFILIATED =
  'This extension is not affiliated with or endorsed by AIUB.';

/** Purpose + responsibility statement, paired with NOT_AFFILIATED in the
 *  Routine Generator's "Read this first" panel. */
export const EDUCATIONAL_PURPOSE =
  'Provided exclusively for educational purposes. Users are expected to act responsibly and comply with all applicable laws, regulations, and institutional policies.';

/** Footer body shown on every extension page's sidebar. */
export const NO_CREDENTIALS_REMINDER =
  'No credentials handled. Verify every action on the official AIUB Portal before relying on it.';

/** Structured bullet pair used by the Routine Generator's "Read this
 *  first" panel. `[strong, rest]` — the lead-in is rendered bold. */
export type PolicyBullet = readonly [string, string];

export const POLICY_BULLETS: readonly PolicyBullet[] = [
  [
    'AIUB policy:',
    'never use your AIUB Portal username and password on any third-party application other than official AIUB platforms.',
  ],
  [
    'This extension does not sync in real time.',
    'Syncing is user-initiated — data is only read from the Offered Courses page when you visit it in your own browser.',
  ],
  [
    'If you sync for fresh data,',
    'you log in to the official AIUB Portal at your own discretion.',
  ],
  [
    'Your username and password are never seen, handled, or stored',
    'by this extension. Sync happens inside your authenticated session on portal.aiub.edu.',
  ],
  [
    'This extension is not affiliated with AIUB',
    'and is not endorsed by AIUB.',
  ],
  [
    'Provided exclusively for educational purposes.',
    'Users are expected to act responsibly and comply with all applicable laws, regulations, and institutional policies.',
  ],
  [
    'Under the hood, when you click "Sync now":',
    'a portal tab briefly opens in the background and a content script programmatically expands curriculum panels to read prerequisite data from pages you already have access to. No data is submitted, modified, or transmitted outside your browser.',
  ],
];
