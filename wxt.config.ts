import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
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
          'RoutineGenerator/*',
          'CGPAPlanner/*',
          'offered-filter.js',
          'offered-filter.css',
          'aiub.jpg',
        ],
        matches: ['https://portal.aiub.edu/*'],
      },
    ],
  },
});
