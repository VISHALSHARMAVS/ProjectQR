import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { EmptyState, ErrorPanel, Loading, Modal } from '../../components/ui';
import { formatTableLabel } from '../../lib/format';
import type { TableRecord } from '../../types';

interface TablesPayload { tables: TableRecord[] }
interface QrData {
  qrCode: string;
  url: string;
  restaurantName: string;
  tableLabel: string;
  brandColor?: string;
  logoUrl?: string;
  welcomeTagline?: string;
}

export default function TablesPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['staff-tables'], queryFn: () => api.get<TablesPayload>('/tables') });
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<TableRecord | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [qr, setQr] = useState<QrData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [deactivating, setDeactivating] = useState<TableRecord | null>(null);

  // Bulk Generator State
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkPrefix, setBulkPrefix] = useState('Table ');
  const [bulkStart, setBulkStart] = useState('1');
  const [bulkEnd, setBulkEnd] = useState('10');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState('');

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBulkSuccess('');
    const start = parseInt(bulkStart, 10);
    const end = parseInt(bulkEnd, 10);

    if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
      setError('Please provide a valid start and end number (e.g. 1 to 10).');
      return;
    }
    if (end - start + 1 > 40) {
      setError('Maximum 40 tables can be generated at once to avoid timeouts.');
      return;
    }

    setBulkLoading(true);
    let createdCount = 0;
    try {
      for (let i = start; i <= end; i++) {
        const tableLabel = `${bulkPrefix.trim()} ${i}`.trim();
        try {
          await api.post('/tables', { label: tableLabel });
          createdCount++;
        } catch {
          // Skip if already exists or fails
        }
      }
      await client.invalidateQueries({ queryKey: ['staff-tables'] });
      setBulkSuccess(`Successfully generated ${createdCount} tables with QR codes!`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Failed to generate bulk tables.');
    } finally {
      setBulkLoading(false);
    }
  };
  const create = useMutation({
    mutationFn: () => api.post('/tables', { label: label.trim() }),
    onSuccess: async () => { setLabel(''); setError(''); await client.invalidateQueries({ queryKey: ['staff-tables'] }); },
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'This table could not be created.')
  });
  const save = useMutation({
    mutationFn: () => api.patch(`/tables/${editing?.id ?? editing?._id}`, { label: editLabel.trim() }),
    onSuccess: async () => { setEditing(null); setError(''); await client.invalidateQueries({ queryKey: ['staff-tables'] }); },
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'This table could not be updated.')
  });
  const deactivate = useMutation({
    mutationFn: (table: TableRecord) => api.delete(`/tables/${table.id ?? table._id}`),
    onSuccess: async () => { setDeactivating(null); await client.invalidateQueries({ queryKey: ['staff-tables'] }); },
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'This table could not be deactivated.')
  });
  const setActive = useMutation({
    mutationFn: ({ table, active }: { table: TableRecord; active: boolean }) => api.patch(`/tables/${table.id ?? table._id}`, { active }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['staff-tables'] }),
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'This table could not be updated.')
  });
  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) return <ErrorPanel message="Tables could not be loaded." retry={() => void query.refetch()} />;
  const getQr = async (table: TableRecord): Promise<void> => {
    setError(''); setQrLoading(true);
    try { const data = await api.post<QrData>(`/tables/${table.id ?? table._id}/qr`); setQr(data); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'The QR code could not be generated.'); }
    finally { setQrLoading(false); }
  };
  const qrFilename = qr ? `${qr.restaurantName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-table-${qr.tableLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-qr.png` : 'table-qr.png';
  return <>
    <div className="heading-row">
      <div>
        <span className="eyebrow">Your floor</span>
        <h1>Tables & QR codes</h1>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
          Every table has its own unique, dynamic QR ordering code.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className={`btn ${bulkMode ? '' : 'secondary'}`}
          onClick={() => { setBulkMode(true); setError(''); setBulkSuccess(''); }}
        >
          ⚡ Bulk Generator
        </button>
        <button
          type="button"
          className={`btn ${!bulkMode ? '' : 'secondary'}`}
          onClick={() => { setBulkMode(false); setError(''); setBulkSuccess(''); }}
        >
          ➕ Single Table
        </button>
      </div>
    </div>

    {bulkSuccess && (
      <div className="notice success" style={{ marginBottom: 16 }}>
        ✓ {bulkSuccess}
      </div>
    )}

    {bulkMode ? (
      <form
        className="surface"
        style={{
          padding: 18,
          marginBottom: 20,
          borderRadius: 14,
          border: '1.5px solid var(--line)'
        }}
        onSubmit={handleBulkGenerate}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <strong style={{ fontSize: 15 }}>Bulk Generate Table QR Codes</strong>
        </div>
        <p className="muted" style={{ margin: '0 0 14px', fontSize: 12 }}>
          Create up to 40 numbered dining tables in 1 click. Useful for rapid onboarding or opening new dining sections.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
          <div className="field">
            <label htmlFor="bulk-prefix">Label Prefix</label>
            <input
              className="input"
              id="bulk-prefix"
              value={bulkPrefix}
              onChange={(e) => setBulkPrefix(e.target.value)}
              placeholder="e.g. Table, T-, Patio "
              required
            />
          </div>
          <div className="field">
            <label htmlFor="bulk-start">From #</label>
            <input
              className="input"
              id="bulk-start"
              type="number"
              min="1"
              value={bulkStart}
              onChange={(e) => setBulkStart(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="bulk-end">To #</label>
            <input
              className="input"
              id="bulk-end"
              type="number"
              min="1"
              value={bulkEnd}
              onChange={(e) => setBulkEnd(e.target.value)}
              required
            />
          </div>
          <div>
            <button
              className="btn full"
              disabled={bulkLoading}
              style={{ minHeight: 42 }}
            >
              {bulkLoading ? 'Generating…' : '⚡ Generate All Tables'}
            </button>
          </div>
        </div>
      </form>
    ) : (
      <form
        className="surface"
        style={{
          padding: 18,
          marginBottom: 20,
          borderRadius: 14,
          border: '1.5px solid var(--line)'
        }}
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          setBulkSuccess('');
          if (label.trim()) create.mutate();
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>🪑</span>
          <strong style={{ fontSize: 15 }}>Add Single Dining Table</strong>
        </div>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
          Enter a table number (e.g. 1, 2) or section name (e.g. Patio 4, Bar 2, Rooftop 6). Once added, its QR code is generated instantly.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            id="table-label"
            required
            maxLength={40}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Table 1, T-5, Patio 2"
            style={{ flex: '1 1 200px' }}
          />
          <button
            className="btn"
            disabled={create.isPending || !label.trim()}
            style={{ whiteSpace: 'nowrap' }}
          >
            {create.isPending ? 'Adding…' : '➕ Add Table'}
          </button>
        </div>
      </form>
    )}
    {error && !editing && !deactivating && <div className="form-error" style={{ marginBottom: 13 }}>{error}</div>}
    <section className="surface table-wrap">
      {query.data.tables.length === 0 ? (
        <EmptyState
          title="No tables yet"
          description="Add your first table or use the Bulk Generator to create QR codes for your entire restaurant."
        />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Table</th>
              <th>Status</th>
              <th>QR Code</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.data.tables.map((table) => (
              <tr key={table.id ?? table._id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🪑</span>
                    <strong style={{ fontSize: 14 }}>{table.label}</strong>
                  </div>
                </td>
                <td>
                  <span className={`pill ${table.active ? '' : 'gray'}`}>
                    {table.active ? '● Active' : '○ Inactive'}
                  </span>
                </td>
                <td>
                  <button className="btn secondary small" onClick={() => void getQr(table)} disabled={qrLoading}>
                    📱 View QR
                  </button>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="toolbar" style={{ justifyContent: 'flex-end', gap: 6 }}>
                    <button
                      className="btn secondary small"
                      onClick={() => {
                        setEditing(table);
                        setEditLabel(table.label);
                        setError('');
                      }}
                    >
                      ✏️ Edit
                    </button>
                    {table.active ? (
                      <button
                        className="btn ghost small"
                        style={{ color: 'var(--red)' }}
                        onClick={() => {
                          setDeactivating(table);
                          setError('');
                        }}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        className="btn secondary small"
                        onClick={() => setActive.mutate({ table, active: true })}
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
    {editing && <Modal title="Edit table" onClose={() => { setEditing(null); setError(''); }}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}><div className="field"><label htmlFor="edit-table-label">Table number or label</label><input className="input" id="edit-table-label" required maxLength={40} value={editLabel} onChange={(event) => setEditLabel(event.target.value)} /></div>{error && <div className="form-error">{error}</div>}<button className="btn full" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save table'}</button></form></Modal>}
    {deactivating && <Modal title="Deactivate this table?" onClose={() => { setDeactivating(null); setError(''); }}><p className="muted">New orders through {deactivating.label}’s QR code will stop. Existing orders will remain available to your team.</p>{error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}<div className="toolbar" style={{ justifyContent: 'end' }}><button className="btn secondary" onClick={() => setDeactivating(null)}>Cancel</button><button className="btn danger" onClick={() => deactivate.mutate(deactivating)} disabled={deactivate.isPending}>{deactivate.isPending ? 'Deactivating…' : 'Deactivate table'}</button></div></Modal>}
    {qr && (
      <Modal title={`${formatTableLabel(qr.tableLabel)} QR code`} onClose={() => setQr(null)} width={570}>
        <div
          className="qr-print-card"
          style={{
            border: `2px solid ${qr.brandColor || 'var(--line)'}`,
            borderRadius: 20,
            padding: 24,
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)'
          }}
        >
          {qr.logoUrl && (
            <div style={{ width: 56, height: 56, margin: '0 auto 10px', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', background: 'var(--paper-elevated)' }}>
              <img src={qr.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', margin: 0 }} />
            </div>
          )}
          <strong style={{ fontSize: 20, display: 'block', color: qr.brandColor || 'inherit', letterSpacing: '-0.02em' }}>
            {qr.restaurantName}
          </strong>
          {qr.welcomeTagline && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
              {qr.welcomeTagline}
            </p>
          )}

          <div
            style={{
              display: 'inline-block',
              margin: '12px auto 8px',
              padding: '4px 16px',
              borderRadius: 20,
              background: 'var(--soft-green)',
              color: qr.brandColor || 'var(--green)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.04em'
            }}
          >
            {formatTableLabel(qr.tableLabel)}
          </div>

          <div style={{ position: 'relative', width: 'min(240px, 100%)', margin: '8px auto' }}>
            <img
              src={qr.qrCode}
              alt={`QR code for ${qr.restaurantName}, ${formatTableLabel(qr.tableLabel)}`}
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12 }}
            />
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>
            📱 Scan with camera to view menu & order
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            No app download required · Direct table service
          </div>
        </div>

        <div className="muted" style={{ overflowWrap: 'anywhere', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
          {qr.url}
        </div>
        <div className="toolbar" style={{ justifyContent: 'center', marginTop: 17, gap: 10 }}>
          <a className="btn secondary" href={qr.qrCode} download={qrFilename}>
            Download PNG ({qr.brandColor ? 'Custom Theme' : 'Standard'})
          </a>
          <button
            className="btn"
            style={{ background: qr.brandColor || undefined, borderColor: qr.brandColor || undefined }}
            onClick={() => window.print()}
          >
            🖨️ Print table sign
          </button>
        </div>
      </Modal>
    )}
  </>;
}
