import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { OrderStatus } from '../types';

export function Brand({ light = false }: { light?: boolean }) {
  return <span className="brand"><span className="brand-mark" style={light ? { color: 'var(--green)', background: 'white' } : undefined}>QR</span><span className="brand-name">ProjectQR</span></span>;
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
