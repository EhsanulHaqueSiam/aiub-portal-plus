import { latestRelease } from '@/utils/storage';

const REPO = 'EhsanulHaqueSiam/aiub-portal-plus';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;

export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function currentVersion(): string {
  return browser.runtime.getManifest().version;
}

export function isUpdateAvailable(latest: string, current = currentVersion()): boolean {
  return compareSemver(latest, current) > 0;
}

async function setBadge(show: boolean) {
  try {
    await browser.action.setBadgeText({ text: show ? 'NEW' : '' });
    if (show) {
      await browser.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    }
  } catch {
    // action API unavailable in some contexts — non-fatal
  }
}

export async function refreshBadge(): Promise<void> {
  const rel = await latestRelease.getValue();
  await setBadge(!!rel && isUpdateAvailable(rel.version));
}

export async function checkForUpdate(): Promise<void> {
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { tag_name?: string; html_url?: string };
    if (!data.tag_name || !data.html_url) return;
    const tag = data.tag_name;
    const version = tag.replace(/^v/, '');
    await latestRelease.setValue({
      tag,
      version,
      url: data.html_url,
      checkedAt: Date.now(),
    });
    await setBadge(isUpdateAvailable(version));
  } catch {
    // network blips are fine — alarm retries every 6h
  }
}
