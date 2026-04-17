import { extensionEnabled } from '@/utils/storage';

export default defineContentScript({
  matches: ['https://portal.aiub.edu/Student*'],
  runAt: 'document_start',
  allFrames: false,

  async main() {
    try {
      const enabled = await extensionEnabled.getValue();
      localStorage.setItem('__aiubPortalEnabled', enabled ? '1' : '0');
    } catch {
      // storage may be unavailable in some contexts
    }
  },
});
