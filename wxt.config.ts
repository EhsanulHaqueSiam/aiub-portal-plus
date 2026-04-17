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
        resources: [
          'Shared/*',
          'Home/*',
          'Academic/*',
          'Grade/*',
          'fonts/*',
          'offered-filter.js',
          'offered-filter.css',
          'aiub.jpg',
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
