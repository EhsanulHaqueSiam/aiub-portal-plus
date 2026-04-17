import { storage } from 'wxt/utils/storage';

export const extensionEnabled = storage.defineItem<boolean>('sync:extensionEnabled', {
  fallback: true,
});

/* Students see the Microsoft Teams one-time-password card on every home
   visit. It's useful once per semester (first login), then noise for the
   other 100+ visits. Let them collapse it; re-open link stays visible so
   the info is never lost. Local-scoped — matches per-device, per-install. */
export const teamsCredsDismissed = storage.defineItem<boolean>('local:teamsCredsDismissed', {
  fallback: false,
});
