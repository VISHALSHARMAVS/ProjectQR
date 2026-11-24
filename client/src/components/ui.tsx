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

export function ScanPlateIcon({ size = 20, light = false }: { size?: number; light?: boolean }) {
  const strokeColor = light ? '#ffffff' : 'currentColor';
  const accentColor = '#ea580c';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <g stroke={strokeColor} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="28,78 28,28 78,28" />
        <polyline points="178,28 228,28 228,78" />
        <polyline points="28,178 28,228 78,228" />
        <polyline points="178,228 228,228 228,178" />
      </g>
      <line x1="64" y1="156" x2="192" y2="156" stroke={strokeColor} strokeWidth="16" strokeLinecap="round" />
      <path
        d="M 74,156 C 74,98 100,78 128,78 C 156,78 182,98 182,156"
        stroke={strokeColor}
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="128" cy="66" r="11" fill={accentColor} />
    </svg>
  );
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className="brand">
      <span
        className="brand-mark"
        style={
          light
            ? { color: 'white', background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.25)' }
            : { color: 'var(--green)', background: 'var(--soft-green)', border: '1px solid var(--line)' }
        }
      >
        <ScanPlateIcon size={20} light={light} />
      </span>
      <span className="brand-name" style={light ? { color: 'white' } : undefined}>
        Project<span style={{ color: light ? '#a7f3d0' : 'var(--green)' }}>QR</span>
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
