import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { EmptyState, ErrorPanel, Loading, Modal } from '../../components/ui';
import type { TableRecord } from '../../types';

interface TablesPayload { tables: TableRecord[] }
interface QrData { qrCode: string; url: string; restaurantName: string; tableLabel: string }

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
    <div className="heading-row"><div><span className="eyebrow">Your floor</span><h1>Tables & QR codes</h1><p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Every table has its own secure ordering link.</p></div></div>
    <form className="surface toolbar" style={{ padding: 16, marginBottom: 15 }} onSubmit={(event) => { event.preventDefault(); setError(''); create.mutate(); }}><div className="field" style={{ flex: 1, minWidth: 180 }}><label htmlFor="table-label">Table number or label</label><input className="input" id="table-label" required maxLength={40} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Patio 1" /></div><button className="btn" style={{ alignSelf: 'end' }} disabled={create.isPending}>{create.isPending ? 'Adding…' : 'Add table'}</button></form>
    {error && !editing && !deactivating && <div className="form-error" style={{ marginBottom: 13 }}>{error}</div>}
    <section className="surface table-wrap">{query.data.tables.length === 0 ? <EmptyState title="No tables yet" description="Add your first table, then download its QR code to place on the table." /> : <table className="data-table"><thead><tr><th>Table</th><th>Status</th><th>QR link</th><th /></tr></thead><tbody>{query.data.tables.map((table) => <tr key={table.id ?? table._id}><td><strong>{table.label}</strong></td><td><span className={`pill ${table.active ? '' : 'gray'}`}>{table.active ? 'Active' : 'Inactive'}</span></td><td><button className="btn secondary small" onClick={() => void getQr(table)} disabled={qrLoading}>View / download</button></td><td><div className="toolbar"><button className="btn secondary small" onClick={() => { setEditing(table); setEditLabel(table.label); setError(''); }}>Edit</button>{table.active ? <button className="btn ghost small" onClick={() => { setDeactivating(table); setError(''); }}>Deactivate</button> : <button className="btn ghost small" onClick={() => setActive.mutate({ table, active: true })}>Activate</button>}</div></td></tr>)}</tbody></table>}</section>
    {editing && <Modal title="Edit table" onClose={() => { setEditing(null); setError(''); }}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}><div className="field"><label htmlFor="edit-table-label">Table number or label</label><input className="input" id="edit-table-label" required maxLength={40} value={editLabel} onChange={(event) => setEditLabel(event.target.value)} /></div>{error && <div className="form-error">{error}</div>}<button className="btn full" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save table'}</button></form></Modal>}
    {deactivating && <Modal title="Deactivate this table?" onClose={() => { setDeactivating(null); setError(''); }}><p className="muted">New orders through {deactivating.label}’s QR code will stop. Existing orders will remain available to your team.</p>{error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}<div className="toolbar" style={{ justifyContent: 'end' }}><button className="btn secondary" onClick={() => setDeactivating(null)}>Cancel</button><button className="btn danger" onClick={() => deactivate.mutate(deactivating)} disabled={deactivate.isPending}>{deactivate.isPending ? 'Deactivating…' : 'Deactivate table'}</button></div></Modal>}
    {qr && <Modal title={`Table ${qr.tableLabel} QR code`} onClose={() => setQr(null)} width={570}><div className="qr-print-card"><strong>{qr.restaurantName}</strong><div style={{ color: 'var(--muted)', marginTop: 5 }}>Table {qr.tableLabel}</div><img src={qr.qrCode} alt={`QR code for ${qr.restaurantName}, table ${qr.tableLabel}`} /><div style={{ fontSize: 13, fontWeight: 650 }}>Scan to view menu and order</div></div><div className="muted" style={{ overflowWrap: 'anywhere', fontSize: 11, textAlign: 'center' }}>{qr.url}</div><div className="toolbar" style={{ justifyContent: 'center', marginTop: 17 }}><a className="btn secondary" href={qr.qrCode} download={qrFilename}>Download PNG</a><button className="btn" onClick={() => window.print()}>Print table sign</button></div></Modal>}
  </>;
}
