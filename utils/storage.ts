import { storage } from 'wxt/utils/storage';

export const extensionEnabled = storage.defineItem<boolean>('sync:extensionEnabled', {
  fallback: true,
});
