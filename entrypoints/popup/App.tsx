import { useState, useEffect } from 'react';
import { extensionEnabled, latestRelease, type LatestRelease } from '@/utils/storage';
import { currentVersion, isUpdateAvailable } from '@/utils/updateCheck';
import './App.css';

const FEATURES = [
  { icon: '🔍', label: 'Course & Class ID Search' },
  { icon: '📅', label: 'Day-based Filtering' },
  { icon: '⏰', label: 'Live Class Schedule with Countdown' },
  { icon: '📊', label: 'Grade Visualization' },
  { icon: '💰', label: 'Financial Dashboard' },
  { icon: '📋', label: 'Enhanced Sidebar Navigation' },
  { icon: '⚡', label: 'Conflict Detection' },
];

const VERSION = currentVersion();

function App() {
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState<'active' | 'inactive' | 'neutral'>('neutral');
  const [release, setRelease] = useState<LatestRelease | null>(null);

  useEffect(() => {
    extensionEnabled.getValue().then((val) => {
      setEnabled(val);
    });

    latestRelease.getValue().then(setRelease);
    const unwatch = latestRelease.watch(setRelease);
    browser.runtime.sendMessage({ type: 'CHECK_UPDATE_NOW' }).catch(() => {});

    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const url = tabs[0]?.url ?? '';
      if (!enabled) {
        setStatus('inactive');
      } else if (url.includes('portal.aiub.edu/Student')) {
        setStatus('active');
      } else {
        setStatus('neutral');
      }
    });

    return () => unwatch();
  }, [enabled]);

  const updateReady = release ? isUpdateAvailable(release.version, VERSION) : false;

  const handleToggle = async () => {
    const newValue = !enabled;
    setEnabled(newValue);
    await extensionEnabled.setValue(newValue);

    // Reload the active tab to apply changes
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      browser.tabs.reload(tabs[0].id);
    }
  };

  const statusMessages = {
    active: 'Filter panel is active on this page.',
    inactive: 'Extension is disabled. Toggle ON to activate.',
    neutral: 'Go to AIUB Portal to use enhancements.',
  };

  return (
    <div className="popup-container">
      <div className="popup-header">
        <div className="popup-brand">
          AIUB Portal<span className="popup-brand-accent">+</span>
        </div>
        <div className="popup-subtitle">Portal Enhancement Suite</div>
      </div>

      {updateReady && release && (
        <a
          className="popup-update-banner"
          href={release.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="popup-update-dot" />
          <span className="popup-update-text">
            Update available — <strong>{release.tag}</strong>
          </span>
          <span className="popup-update-cta">Download ↗</span>
        </a>
      )}

      <div className="popup-toggle-section">
        <div className="toggle-label">
          <div className={`toggle-dot ${enabled ? 'active' : 'inactive'}`} />
          <span className="toggle-text">
            Extension {enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      <div className={`popup-status ${status}`}>
        <span>{status === 'active' ? '✓' : status === 'inactive' ? '✕' : '→'}</span>
        <span>{statusMessages[status]}</span>
      </div>

      <div className="popup-features">
        <div className="popup-features-title">Features</div>
        <ul className="feature-list">
          {FEATURES.map((feature) => (
            <li key={feature.label} className="feature-item">
              <span className="feature-icon">{feature.icon}</span>
              <span>{feature.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="popup-footer">
        AIUB Portal+ v{VERSION}
      </div>
    </div>
  );
}

export default App;
