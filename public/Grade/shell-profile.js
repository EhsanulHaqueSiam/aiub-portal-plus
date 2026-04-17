// Hydrate the portal app shell's profile card + welcome name from the
// aiubStudent record that sidebar.content.ts captures on any portal page.
// Lives outside Graphs.html because MV3's default CSP forbids inline scripts.
(function hydrateProfile() {
  const api = (typeof browser !== 'undefined' && browser.storage) ? browser
    : (typeof chrome !== 'undefined' && chrome.storage) ? chrome
    : null;
  if (!api) return;
  api.storage.local.get({ aiubStudent: null }, (res) => {
    const student = res && res.aiubStudent;
    if (!student) return;
    const nameEl = document.getElementById('portal-profile-name');
    const idEl = document.getElementById('portal-profile-id');
    const welcomeEl = document.getElementById('portal-welcome-name');
    if (student.name) {
      if (nameEl) nameEl.textContent = student.name;
      if (welcomeEl) welcomeEl.textContent = student.name;
    }
    if (idEl) idEl.textContent = student.studentId || '';
  });
})();
