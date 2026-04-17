import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'AIUB Portal+',
    description: 'Comprehensive enhancement suite for the AIUB Student Portal',
    // version intentionally omitted — WXT picks it up from package.json so
    // the CI workflow's `npm version <tag>` flows through to the manifest.
    permissions: ['activeTab', 'storage', 'tabs'],
    host_permissions: ['https://portal.aiub.edu/*'],
    web_accessible_resources: [
      {
        // Intentionally does NOT include AIUB's institutional logo. If the
        // extension ever needs to display the official AIUB mark (e.g. for
        // visual continuity in a styled header), the portal's own DOM
        // already contains it — content scripts can reposition or restyle
        // the existing `<img>` in place instead of shipping a copy of the
        // logo inside the extension bundle. AIUB's policy prohibits
        // using the AIUB name or logo without permission; shipping the
        // logo file inside this extension would be the most likely way to
        // trip that rule, so we do not ship it.
        resources: [
          'Shared/*',
          'Home/*',
          'Academic/*',
          'Grade/*',
          'fonts/*',
          'offered-filter.js',
          'offered-filter.css',
          // Standalone extension pages linked from the sidebar. MV3 requires
          // each chrome-extension:// HTML that the portal navigates to be
          // listed here; otherwise Chromium blocks the click with
          // ERR_BLOCKED_BY_CLIENT.
          'graphs.html',
          'cgpa-planner.html',
          'routine-generator.html',
        ],
        matches: ['https://portal.aiub.edu/*'],
      },
    ],
  },
});
