import { useTheme, type Theme } from '../lib/theme';

interface ThemeToggleProps {
  variant?: 'compact' | 'segmented';
  className?: string;
}

export function ThemeToggle({ variant = 'compact', className = '' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'segmented') {
    return (
      <div
        className={`theme-segmented-group ${className}`}
        role="radiogroup"
        aria-label="Color theme selection"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--paper-elevated, #f1f5f9)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          padding: 2,
          gap: 2
        }}
      >
        {(['system', 'light', 'dark'] as Theme[]).map((t) => {
          const isActive = theme === t;
          const label = t === 'system' ? 'Auto' : t === 'light' ? 'Light' : 'Dark';
          const icon = t === 'system' ? '⚙️' : t === 'light' ? '☀️' : '🌙';

          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setTheme(t)}
              style={{
                border: 'none',
                background: isActive ? 'var(--paper, #ffffff)' : 'transparent',
                color: isActive ? 'var(--ink)' : 'var(--muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 200ms cubic-bezier(0.22, 1, 0.36, 1)'
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Compact variant: Ideal for mobile headers and top bars
  return (
    <button
      type="button"
      className={`btn secondary small theme-toggle-btn ${className}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode (currently ${resolvedTheme})`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 8,
        minWidth: 34,
        height: 34
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 14 }}>
        {resolvedTheme === 'dark' ? '☀️' : '🌙'}
      </span>
      <span className="theme-toggle-label" style={{ fontSize: 11 }}>
        {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
