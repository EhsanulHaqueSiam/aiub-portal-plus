import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'AIUB Portal+',
    description: 'Comprehensive enhancement suite for the AIUB Student Portal',
    version: '1.0.0',
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
