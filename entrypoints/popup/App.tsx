import { useState, useEffect } from 'react';
import { extensionEnabled, latestRelease, type LatestRelease } from '@/utils/storage';
import { currentVersion, isUpdateAvailable } from '@/utils/updateCheck';
import type { Highlights, HighlightColor } from '@/lib/offered';
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

// Matches PALETTE in entrypoints/highlight.content.ts. Used only for the
// popup's swatch dot so the pinned-list color reads as the same routine
// the user sees on Offered Courses.
const POPUP_SWATCH: Record<HighlightColor, string> = {
  amber:   '#fbbf24',
  royal:   '#60a5fa',
  emerald: '#34d399',
  rose:    '#fb7185',
  violet:  '#a78bfa',
};

function App() {
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState<'active' | 'inactive' | 'neutral'>('neutral');
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [highlights, setHighlights] = useState<Highlights | null>(null);

  useEffect(() => {
    extensionEnabled.getValue().then((val) => {
      setEnabled(val);
    });

    latestRelease.getValue().then(setRelease);
    const unwatch = latestRelease.watch(setRelease);
    browser.runtime.sendMessage({ type: 'CHECK_UPDATE_NOW' }).catch(() => {});

    browser.storage.local.get({ aiubHighlights: null }).then((res) => {
      setHighlights((res.aiubHighlights as Highlights | null) ?? null);
    });
    const storageListener = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area !== 'local' || !changes.aiubHighlights) return;
      setHighlights((changes.aiubHighlights.newValue as Highlights | null) ?? null);
    };
    browser.storage.onChanged.addListener(storageListener);

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

    return () => {
      unwatch();
      browser.storage.onChanged.removeListener(storageListener);
    };
  }, [enabled]);

  const updateReady = release ? isUpdateAvailable(release.version, VERSION) : false;
  const pinGroups = (highlights?.groups ?? []).filter((g) => Array.isArray(g.classIds) && g.classIds.length > 0);
  const pinsEnabled = highlights?.enabled !== false;

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

  const writeHighlights = async (next: Highlights) => {
    await browser.storage.local.set({
      aiubHighlights: { ...next, updatedAt: new Date().toISOString() },
    });
  };

  const handleUnpin = (idx: number) => {
    const nextGroups = pinGroups.filter((_, i) => i !== idx);
    writeHighlights({
      ...(highlights ?? {}),
      groups: nextGroups,
      classIds: [],
      enabled: pinsEnabled,
    });
  };

  const handleClearAll = () => {
    writeHighlights({
      ...(highlights ?? {}),
      groups: [],
      classIds: [],
      enabled: pinsEnabled,
    });
  };

  const handleTogglePins = () => {
    writeHighlights({
      ...(highlights ?? {}),
      groups: pinGroups,
      classIds: highlights?.classIds ?? [],
      enabled: !pinsEnabled,
    });
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

      {enabled && (
        <div className="popup-pinned">
          <div className="popup-pinned-header">
            <div className="popup-pinned-title">Pinned routine highlights</div>
            <label className="popup-pinned-master" title={pinsEnabled ? 'Turn highlights off' : 'Turn highlights on'}>
              <span className="popup-pinned-master-label">{pinsEnabled ? 'On' : 'Off'}</span>
              <input
                type="checkbox"
                checked={pinsEnabled}
                onChange={handleTogglePins}
                disabled={pinGroups.length === 0 && pinsEnabled}
              />
              <span className="popup-pinned-master-track" aria-hidden />
            </label>
          </div>

          {pinGroups.length === 0 ? (
            <div className="popup-pinned-empty">
              No routines pinned yet. Open the Routine Generator and click
              <strong> Pin</strong> on any routine to highlight its class IDs
              here and on the portal.
            </div>
          ) : (
            <>
              <ul className="popup-pinned-list">
                {pinGroups.map((g, i) => {
                  const color: HighlightColor = (POPUP_SWATCH as Record<string, string>)[g.color]
                    ? (g.color as HighlightColor)
                    : 'amber';
                  return (
                    <li key={i} className="popup-pinned-item">
                      <span
                        className="popup-pinned-swatch"
                        style={{ background: POPUP_SWATCH[color] }}
                        aria-hidden
                      />
                      <span className="popup-pinned-label">Pin {i + 1}</span>
                      <span className="popup-pinned-count">
                        {g.classIds.length} class ID{g.classIds.length === 1 ? '' : 's'}
                      </span>
                      <button
                        type="button"
                        className="popup-pinned-remove"
                        onClick={() => handleUnpin(i)}
                        aria-label={`Unpin routine ${i + 1}`}
                        title="Unpin"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="popup-pinned-footer">
                <button
                  type="button"
                  className="popup-pinned-btn"
                  onClick={handleClearAll}
                >
                  Clear all pins
                </button>
              </div>
            </>
          )}
        </div>
      )}

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
