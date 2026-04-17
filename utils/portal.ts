export function escHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getStudentName(): string {
  const el =
    document.querySelector('.navbar-text .navbar-link small') ??
    document.querySelector('.navbar-text .navbar-link');
  if (!el?.textContent) return '';
  const raw = el.textContent.trim();
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length >= 2) return titleCase(parts[1]) + ' ' + titleCase(parts[0]);
  return titleCase(raw);
}

export function getStudentId(): string {
  const idEl = document.querySelector('.navbar-text .navbar-link small');
  const raw = idEl?.textContent?.trim() ?? '';
  const m = raw.match(/(\d{2}-\d{5}-\d+)/);
  return m ? m[1] : '';
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function loadCSS(id: string, path: string): void {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  link.href = (browser.runtime.getURL as (p: string) => string)(
    path.startsWith('/') ? path : `/${path}`,
  );
  document.head.appendChild(link);
}

export function loadInlineStyle(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

const htmlParser =
  typeof DOMParser !== 'undefined' ? new DOMParser() : (null as unknown as DOMParser);

export function parseHTML(source: string): DocumentFragment {
  const doc = htmlParser.parseFromString(source, 'text/html');
  const fragment = document.createDocumentFragment();
  const nodes = Array.from(doc.body.childNodes);
  for (const n of nodes) fragment.appendChild(document.importNode(n, true));
  return fragment;
}

export function replaceChildrenHTML(target: Element, source: string): void {
  target.replaceChildren(parseHTML(source));
}

export function prependHTML(target: Element, source: string): void {
  target.insertBefore(parseHTML(source), target.firstChild);
}

export function appendHTML(target: Element, source: string): void {
  target.appendChild(parseHTML(source));
}

export function beforeHTML(target: Element, source: string): void {
  target.parentNode?.insertBefore(parseHTML(source), target);
}

export function afterHTML(target: Element, source: string): void {
  target.parentNode?.insertBefore(parseHTML(source), target.nextSibling);
}

export function waitFor(selector: string, cb: () => void, interval = 200, maxTries = 50): void {
  let tries = 0;
  const tick = () => {
    if (document.querySelector(selector)) {
      cb();
    } else if (++tries < maxTries) {
      setTimeout(tick, interval);
    }
  };
  tick();
}

type TimePart = { h: number; m: number };

export function parseTimePart(str: string): TimePart | null {
  const m = str.trim().match(/\w+\s+(\d{1,2}):(\d{1,2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = (m[3] ?? '').toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return { h, m: min };
}

export function parseTimeRange(label: string): { start: TimePart; end: TimePart } | null {
  const idx = label.indexOf(' - ');
  if (idx === -1) return null;
  const start = parseTimePart(label.substring(0, idx));
  const end = parseTimePart(label.substring(idx + 3));
  if (!start || !end) return null;
  return { start, end };
}

export function fmtDuration(ms: number): string {
  const t = Math.floor(ms / 1000);
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function getDateForLabel(text: string): Date | null {
  text = text.trim();
  const now = new Date();
  if (/^today$/i.test(text)) return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/^tomorrow$/i.test(text)) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + 1);
    return d;
  }
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const m = text.match(/(\d{1,2})-(\w{3})-(\d{4})/);
  if (m && m[2] in months) {
    return new Date(parseInt(m[3], 10), months[m[2]], parseInt(m[1], 10));
  }
  return null;
}

export function fmtDate(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export async function isExtensionEnabled(): Promise<boolean> {
  const { extensionEnabled } = await import('@/utils/storage');
  return extensionEnabled.getValue();
}
