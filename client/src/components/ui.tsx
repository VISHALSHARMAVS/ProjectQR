import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DietaryType, OrderStatus } from '../types';

export function DietaryBadge({ type = 'VEG' }: { type?: DietaryType }) {
  if (type === 'NON_VEG') {
    return <span className="dietary-badge non-veg" title="Non-Vegetarian" aria-label="Non-Vegetarian"><span className="dietary-symbol" /></span>;
  }
  if (type === 'EGG') {
    return <span className="dietary-badge egg" title="Contains Egg" aria-label="Contains Egg"><span className="dietary-symbol" /></span>;
  }
  return <span className="dietary-badge veg" title="Pure Vegetarian" aria-label="Pure Vegetarian"><span className="dietary-symbol" /></span>;
}

export function MesaMonogram({ size = 22, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="mesaGreenGradInline" x1="100" y1="120" x2="412" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="50%" stopColor="#16A34A" />
          <stop offset="100%" stopColor="#14532D" />
        </linearGradient>
        <linearGradient id="mesaAmberGradInline" x1="220" y1="120" x2="292" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <filter id="mesaAmberGlowInline" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#F59E0B" floodOpacity="0.8" />
        </filter>
      </defs>

      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Left Outer Table Leg of 'M' */}
        <path d="M 132 400 L 132 152" stroke={light ? '#4ade80' : 'url(#mesaGreenGradInline)'} strokeWidth="36" />

        {/* Right Outer Table Leg of 'M' */}
        <path d="M 380 400 L 380 152" stroke={light ? '#4ade80' : 'url(#mesaGreenGradInline)'} strokeWidth="36" />

        {/* Inner Chevron meeting at Table Center */}
        <path d="M 132 152 L 256 256 L 380 152" stroke={light ? '#4ade80' : 'url(#mesaGreenGradInline)'} strokeWidth="36" />

        {/* The Dining Table Horizon Surface */}
        <path d="M 172 256 L 340 256" stroke={light ? '#4ade80' : 'url(#mesaGreenGradInline)'} strokeWidth="32" />

        {/* Hospitality Signal Arc (Acoustic Chime / Soundbox Wave) */}
        <path d="M 224 140 C 240 126 272 126 288 140" stroke="url(#mesaAmberGradInline)" strokeWidth="24" />

        {/* Table-Side Active Beacon (4-digit PIN access point) */}
        <circle cx="256" cy="184" r="16" fill="url(#mesaAmberGradInline)" filter="url(#mesaAmberGlowInline)" />
      </g>
    </svg>
  );
}

// Backwards-compatible alias for existing components
export const ScanPlateIcon = MesaMonogram;

export function Brand({ light = false, showTagline = false }: { light?: boolean; showTagline?: boolean }) {
  return (
    <span className="brand" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span
        className="brand-mark"
        style={
          light
            ? { color: 'white', background: 'rgba(255, 255, 255, 0.12)', border: '1px solid rgba(255, 255, 255, 0.22)', padding: '5px', borderRadius: '10px' }
            : { color: 'var(--green)', background: 'var(--soft-green)', border: '1px solid var(--line)', padding: '5px', borderRadius: '10px' }
        }
      >
        <MesaMonogram size={22} light={light} />
      </span>
      <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
        <span
          className="brand-name"
          style={{
            fontFamily: "'Manrope', -apple-system, sans-serif",
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: '-0.03em',
            color: light ? '#F8FAFC' : 'var(--ink)',
            lineHeight: 1.1,
            display: 'inline-flex',
            alignItems: 'baseline'
          }}
        >
          Mesa
          <span
            style={{
              display: 'inline-block',
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: '#F59E0B',
              marginLeft: 4,
              boxShadow: '0 0 6px #F59E0B'
            }}
            aria-hidden="true"
          />
        </span>
        {showTagline && (
          <span
            style={{
              fontSize: 9.5,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              fontWeight: 700,
              marginTop: 2
            }}
          >
            The Table Operating System
          </span>
        )}
      </span>
    </span>
  );
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const style = status === 'NEW' ? 'orange' : status === 'REJECTED' ? 'red' : status === 'DELIVERED' ? 'gray' : '';
  return <span className={`pill ${style}`}>{status.replace('_', ' ')}</span>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="loading"><div style={{ display: 'grid', justifyItems: 'center', gap: 9 }}><span className="spinner" /><span>{label}</span></div></div>;
}

export function ErrorPanel({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="surface" style={{ padding: 22, marginTop: 20 }}><div className="form-error">{message}</div>{retry && <button className="btn secondary small" style={{ marginTop: 13 }} onClick={retry}>Try again</button>}</div>;
}

export function Modal({ title, children, onClose, width }: { title: string; children: ReactNode; onClose: () => void; width?: number }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal surface" style={width ? { width: `min(${width}px, 100%)` } : undefined} role="dialog" aria-modal="true" aria-label={title}><header className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Close" onClick={onClose}>×</button></header>{children}</section></div>;
}

export function AppHeader({ action }: { action?: ReactNode }) {
  return <header className="topbar page-wrap"><Link to="/"><Brand /></Link><div>{action}</div></header>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty"><strong style={{ display: 'block', marginBottom: 7, color: 'var(--ink)' }}>{title}</strong><span>{description}</span>{action && <div style={{ marginTop: 15 }}>{action}</div>}</div>;
}
