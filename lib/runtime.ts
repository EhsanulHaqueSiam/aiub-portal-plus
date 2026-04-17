/* Tiny helpers for working with browser/chrome extension APIs in pages that
   may be loaded in either Firefox (`browser`) or Chromium (`chrome`). */

type StorageLocal = {
  get(keys: Record<string, unknown>): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};
type StorageChangedHost = {
  addListener(
    cb: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => void,
  ): void;
  removeListener?(cb: (...args: unknown[]) => void): void;
};
type ExtRuntime = {
  storage: { local: StorageLocal; onChanged?: StorageChangedHost };
  runtime: { getURL(path: string): string };
};

export function extApi(): ExtRuntime | null {
  const b = (globalThis as unknown as { browser?: unknown }).browser;
  const c = (globalThis as unknown as { chrome?: unknown }).chrome;

  if (b && (b as { storage?: unknown }).storage) {
    return b as ExtRuntime;
  }
  if (c && (c as { storage?: unknown }).storage) {
    // Chrome's storage.local uses callbacks; wrap for a unified promise API.
    // All three methods must be wrapped — an earlier version only wrapped
    // `get` which caused writeHighlights() to silently drop its writes.
    const cc = c as {
      storage: {
        local: {
          get(keys: Record<string, unknown>, cb: (res: Record<string, unknown>) => void): void;
          set(items: Record<string, unknown>, cb: () => void): void;
          remove(keys: string | string[], cb: () => void): void;
        };
        onChanged?: StorageChangedHost;
      };
      runtime: { getURL(path: string): string };
    };
    return {
      ...cc,
      storage: {
        ...cc.storage,
        local: {
          get(keys) {
            return new Promise<Record<string, unknown>>((resolve) => {
              cc.storage.local.get(keys, resolve);
            });
          },
          set(items) {
            return new Promise<void>((resolve) => {
              cc.storage.local.set(items, () => resolve());
            });
          },
          remove(keys) {
            return new Promise<void>((resolve) => {
              cc.storage.local.remove(keys, () => resolve());
            });
          },
        },
      },
    };
  }
  return null;
}

export function runtimeURL(path: string): string {
  const api = extApi();
  if (!api) return path;
  try {
    return api.runtime.getURL(path);
  } catch {
    return path;
  }
}
