import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { EmptyState, ErrorPanel, Loading, Modal, StatusPill } from '../../components/ui';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { api } from '../../lib/api';
import { playKitchenChime, playWaiterCallAlert } from '../../lib/audio';
import { elapsedSince, formatTableLabel, money } from '../../lib/format';
import type { LiveTableInfo, TableLiveState } from '../../types';

interface LiveStatusResponse {
  tables: LiveTableInfo[];
}

const statusConfig: Record<TableLiveState, { label: string; bg: string; border: string; text: string; badge: string; icon: string }> = {
  VACANT: {
    label: 'Vacant',
    bg: '#ffffff',
    border: 'var(--line)',
    text: 'var(--muted)',
    badge: 'gray',
    icon: '⚪'
  },
  SEATED: {
    label: 'Seated / Browsing',
    bg: '#f0fdf4',
    border: '#86efac',
    text: '#15803d',
    badge: '',
    icon: '🟢'
  },
  PREPARING: {
    label: 'Cooking / In Kitchen',
    bg: '#fffbeb',
    border: '#fcd34d',
    text: '#b45309',
    badge: 'orange',
    icon: '🍳'
  },
  READY: {
    label: 'Food Ready',
    bg: '#ecfdf5',
    border: '#6ee7b7',
    text: '#047857',
    badge: '',
    icon: '🛎️'
  },
  HELP_NEEDED: {
    label: 'Help Needed',
    bg: '#fff7ed',
    border: '#fb923c',
    text: '#c2410c',
    badge: 'orange',
    icon: '🙋'
  },
  BILL_REQUESTED: {
    label: 'Bill Requested',
    bg: '#fdf2f8',
    border: '#f472b6',
    text: '#be185d',
    badge: 'red',
    icon: '🧾'
  }
};

export default function FloorMapPage() {
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<LiveTableInfo | null>(null);
  const [filterState, setFilterState] = useState<string>('ALL');

  const onNewOrder = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['floor-map'] });
    playKitchenChime();
  }, [queryClient]);

  const onServiceRequest = useCallback((req: unknown) => {
    const data = req as { type?: string };
    if (data.type === 'WAITER' || data.type === 'BILL') {
      playWaiterCallAlert();
    } else {
      playKitchenChime();
    }
    void queryClient.invalidateQueries({ queryKey: ['floor-map'] });
  }, [queryClient]);

  useOrderSocket(true, onNewOrder, onServiceRequest);

  const query = useQuery({
    queryKey: ['floor-map'],
    queryFn: () => api.get<LiveStatusResponse>('/tables/live-status'),
    refetchInterval: 12_000
  });

  const resolveRequest = useMutation({
    mutationFn: (id: string) => api.patch(`/restaurant/service-requests/${id}/resolve`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['floor-map'] });
      setSelectedTable(null);
    }
  });

  if (query.isLoading) return <Loading label="Loading live floor map…" />;
  if (query.error || !query.data) {
    return <ErrorPanel message="Failed to load floor map." retry={() => void query.refetch()} />;
  }

  const tables = query.data.tables;

  const counts = {
    total: tables.length,
    active: tables.filter((t) => t.state !== 'VACANT').length,
    help: tables.filter((t) => ['HELP_NEEDED', 'BILL_REQUESTED'].includes(t.state)).length,
    preparing: tables.filter((t) => ['PREPARING', 'READY'].includes(t.state)).length
  };

  const filteredTables = filterState === 'ALL'
    ? tables
    : filterState === 'OCCUPIED'
      ? tables.filter((t) => t.state !== 'VACANT')
      : filterState === 'ATTENTION'
        ? tables.filter((t) => ['HELP_NEEDED', 'BILL_REQUESTED'].includes(t.state))
        : tables.filter((t) => t.state === filterState);

  return (
    <>
      <div className="heading-row">
        <div>
          <span className="eyebrow">Real-Time Dining Room</span>
          <h1>Floor Map & Table Status</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
            Live status of every table in your dining room. Tap a table to view tickets and requests.
          </p>
        </div>
        <div className="toolbar">
          <button className="btn secondary small" onClick={() => void query.refetch()}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Responsive Floor Summary Banner */}
      <div
        className="surface"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          padding: 16,
          marginBottom: 20
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Total Tables</span>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{counts.total}</div>
        </div>
        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
          <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Occupied</span>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: '#15803d' }}>{counts.active}</div>
        </div>
        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
          <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>In Kitchen</span>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: '#b45309' }}>{counts.preparing}</div>
        </div>
        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
          <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Needs Attention</span>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: counts.help > 0 ? '#ea580c' : 'inherit' }}>
            {counts.help > 0 ? `🚨 ${counts.help}` : '0'}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 14 }}>
        {[
          { key: 'ALL', label: 'All Tables' },
          { key: 'OCCUPIED', label: 'Occupied' },
          { key: 'ATTENTION', label: 'Attention Needed 🚨' },
          { key: 'VACANT', label: 'Vacant' }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`btn small ${filterState === tab.key ? '' : 'secondary'}`}
            style={{ borderRadius: 20, whiteSpace: 'nowrap' }}
            onClick={() => setFilterState(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Responsive Floor Map Table Grid */}
      {filteredTables.length === 0 ? (
        <div className="surface" style={{ padding: 28 }}>
          <EmptyState title="No tables found" description="No tables match your selected filter." />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16
          }}
        >
          {filteredTables.map((table) => {
            const cfg = statusConfig[table.state];
            const hasAttention = ['HELP_NEEDED', 'BILL_REQUESTED'].includes(table.state);

            return (
              <div
                key={table.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedTable(table)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSelectedTable(table); }}
                className="surface floor-table-card"
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: `2px solid ${cfg.border}`,
                  background: cfg.bg,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: hasAttention ? '0 8px 24px rgba(234, 88, 12, 0.22)' : '0 2px 8px rgba(0,0,0,0.04)',
                  animation: hasAttention ? 'pulse 2s infinite ease-in-out' : undefined
                }}
              >
                {/* Header: Table label & Status Icon */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <strong style={{ fontSize: 18, color: '#1c1917' }}>
                    {formatTableLabel(table.label)}
                  </strong>
                  <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                </div>

                {/* Status Badge */}
                <div style={{ marginBottom: 12 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background: cfg.border,
                      color: cfg.text
                    }}
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Assistance alert preview */}
                {table.pendingRequest && (
                  <div
                    style={{
                      background: '#ffedd5',
                      border: '1px solid #fdba74',
                      borderRadius: 8,
                      padding: '6px 8px',
                      fontSize: 12,
                      color: '#9a3412',
                      marginBottom: 10,
                      fontWeight: 650
                    }}
                  >
                    {table.pendingRequest.type === 'BILL' ? '🧾 Bill Requested' : `🙋 ${table.pendingRequest.type}`}
                  </div>
                )}

                {/* Orders / Bill info */}
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {table.orders.length > 0 ? `${table.orders.length} active order${table.orders.length > 1 ? 's' : ''}` : 'Available'}
                  </span>
                  {table.totalBillPaise > 0 && (
                    <strong style={{ fontSize: 13, color: '#1c1917' }}>
                      {money(table.totalBillPaise)}
                    </strong>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Table Inspection Modal */}
      {selectedTable && (
        <Modal
          title={`${formatTableLabel(selectedTable.label)} Details`}
          onClose={() => setSelectedTable(null)}
          width={500}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: 12, border: '1px solid var(--line)' }}>
              <div>
                <span className="eyebrow">Table Status</span>
                <div style={{ fontWeight: 750, fontSize: 16, marginTop: 2, color: statusConfig[selectedTable.state].text }}>
                  {statusConfig[selectedTable.state].icon} {statusConfig[selectedTable.state].label}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="eyebrow">Active Bill</span>
                <div style={{ fontWeight: 800, fontSize: 18, marginTop: 2 }}>
                  {money(selectedTable.totalBillPaise)}
                </div>
              </div>
            </div>
          </div>

          {/* Pending Assistance Request Action */}
          {selectedTable.pendingRequest && (
            <div style={{ padding: 14, background: '#fff7ed', border: '1.5px solid #fdba74', borderRadius: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#9a3412', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🚨 Guest Request: {selectedTable.pendingRequest.type}
                  </strong>
                  {selectedTable.pendingRequest.notes && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7c2d12' }}>
                      Note: {selectedTable.pendingRequest.notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn small"
                  style={{ background: '#ea580c', borderColor: '#c2410c' }}
                  disabled={resolveRequest.isPending}
                  onClick={() => resolveRequest.mutate(selectedTable.pendingRequest!.id)}
                >
                  ✓ Mark Done
                </button>
              </div>
            </div>
          )}

          {/* Active Orders on this Table */}
          <div>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>
              Active Orders ({selectedTable.orders.length})
            </span>
            {selectedTable.orders.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No active orders for this table.</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {selectedTable.orders.map((ord) => (
                  <div key={ord.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong>{ord.orderNumber}</strong>
                      <StatusPill status={ord.status} />
                    </div>
                    <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 13 }}>
                      {ord.items.map((i, idx) => (
                        <li key={idx}>
                          {i.quantity} × {i.name} ({money(i.subtotalPaise)})
                        </li>
                      ))}
                    </ul>
                    <div style={{ textAlign: 'right', marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                      Total: <strong>{money(ord.totalPaise)}</strong> · {elapsedSince(ord.createdAt, Date.now())}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="toolbar" style={{ justifyContent: 'end', marginTop: 20 }}>
            <button type="button" className="btn secondary" onClick={() => setSelectedTable(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
