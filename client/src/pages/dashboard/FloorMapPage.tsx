import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorPanel, Loading, Modal, StatusPill } from '../../components/ui';
import { ManualOrderModal } from '../../components/ManualOrderModal';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { api } from '../../lib/api';
import { playComplaintAlertChime, playKitchenChime, playPaymentSuccessChime, playWaiterCallAlert } from '../../lib/audio';
import { elapsedSince, formatTableLabel, money } from '../../lib/format';
import type { LiveTableInfo, TableLiveState } from '../../types';

interface LiveStatusResponse {
  tables: LiveTableInfo[];
}

const statusConfig: Record<TableLiveState, { label: string; bg: string; border: string; text: string; badge: string; icon: string }> = {
  VACANT: {
    label: 'Vacant',
    bg: 'var(--paper)',
    border: 'var(--line)',
    text: 'var(--muted)',
    badge: 'gray',
    icon: '⚪'
  },
  NEEDS_CLEARING: {
    label: 'Needs Clearing',
    bg: 'var(--soft-orange)',
    border: 'var(--orange)',
    text: 'var(--orange)',
    badge: 'orange',
    icon: '🧹'
  },
  SEATED: {
    label: 'Seated / Browsing',
    bg: 'var(--soft-green)',
    border: 'var(--green)',
    text: 'var(--green)',
    badge: '',
    icon: '🟢'
  },
  PREPARING: {
    label: 'Cooking / In Kitchen',
    bg: 'var(--soft-orange)',
    border: 'var(--orange)',
    text: 'var(--orange)',
    badge: 'orange',
    icon: '🍳'
  },
  READY: {
    label: 'Food Ready',
    bg: 'var(--soft-green)',
    border: 'var(--green)',
    text: 'var(--green)',
    badge: '',
    icon: '🛎️'
  },
  HELP_NEEDED: {
    label: 'Help Needed',
    bg: 'var(--soft-orange)',
    border: 'var(--red)',
    text: 'var(--red)',
    badge: 'orange',
    icon: '🙋'
  },
  BILL_REQUESTED: {
    label: 'Bill Requested',
    bg: 'var(--soft-orange)',
    border: 'var(--red)',
    text: 'var(--red)',
    badge: 'red',
    icon: '🧾'
  }
};

export default function FloorMapPage() {
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<LiveTableInfo | null>(null);
  const [punchOrderTableId, setPunchOrderTableId] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<string>('ALL');
  const [reviewAlertToast, setReviewAlertToast] = useState<{ tableLabel: string; rating: number; comment?: string } | null>(null);
  const [paymentSettledToast, setPaymentSettledToast] = useState<{ tableLabel?: string; finalPaidPaise?: number } | null>(null);

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

  const onReviewAlert = useCallback((payload: unknown) => {
    const data = payload as { tableLabel?: string; rating?: number; comment?: string };
    playComplaintAlertChime();
    setReviewAlertToast({
      tableLabel: data.tableLabel || 'Table',
      rating: data.rating || 1,
      comment: data.comment
    });
    void queryClient.invalidateQueries({ queryKey: ['floor-map'] });
  }, [queryClient]);

  const onOrderSettled = useCallback((payload: unknown) => {
    const data = payload as { tableLabel?: string; finalPaidPaise?: number; autoConfirmed?: boolean };
    playPaymentSuccessChime();
    setPaymentSettledToast({
      tableLabel: data.tableLabel,
      finalPaidPaise: data.finalPaidPaise
    });
    setTimeout(() => setPaymentSettledToast(null), 6000);
    void queryClient.invalidateQueries({ queryKey: ['floor-map'] });
  }, [queryClient]);

  useOrderSocket(true, onNewOrder, onServiceRequest, undefined, onOrderSettled, onReviewAlert);

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

  const vacateTable = useMutation({
    mutationFn: (tableId: string) => api.post(`/tables/${encodeURIComponent(tableId)}/vacate`, {}),
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
    active: tables.filter((t) => !['VACANT', 'NEEDS_CLEARING'].includes(t.state)).length,
    clearing: tables.filter((t) => t.state === 'NEEDS_CLEARING').length,
    help: tables.filter((t) => ['HELP_NEEDED', 'BILL_REQUESTED'].includes(t.state)).length,
    preparing: tables.filter((t) => ['PREPARING', 'READY'].includes(t.state)).length
  };

  const filteredTables = filterState === 'ALL'
    ? tables
    : filterState === 'OCCUPIED'
      ? tables.filter((t) => !['VACANT', 'NEEDS_CLEARING'].includes(t.state))
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
        <div className="toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn small"
            style={{ background: '#16a34a', borderColor: '#15803d', color: 'white', fontWeight: 700 }}
            onClick={() => setPunchOrderTableId('')}
            title="Take walk-in order"
          >
            ➕ Punch New Order
          </button>
          <Link className="btn secondary small" to="/dashboard/tables">
            ➕ Add Table & QR
          </Link>
          <button className="btn secondary small" onClick={() => void query.refetch()}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Real-time Review Complaint Alert Banner */}
      {reviewAlertToast && (
        <div
          style={{
            margin: '16px 0',
            padding: '14px 18px',
            background: 'var(--soft-orange)',
            border: '1px solid var(--red)',
            borderRadius: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.18)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🚨</span>
            <div>
              <strong style={{ color: 'var(--red)', fontSize: 14, display: 'block' }}>
                Table-Side Alert: {reviewAlertToast.tableLabel} ({reviewAlertToast.rating}★ Rating)
              </strong>
              <span style={{ fontSize: 12, color: 'var(--ink)' }}>
                Guest needs immediate manager attention before leaving! {reviewAlertToast.comment ? `"${reviewAlertToast.comment}"` : ''}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link to="/dashboard/reviews" className="btn small" style={{ background: 'var(--red)', color: '#fff', fontSize: 12 }}>
              View & Recover →
            </Link>
            <button
              type="button"
              className="icon-button"
              onClick={() => setReviewAlertToast(null)}
              aria-label="Dismiss alert"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Real-time UPI Auto-Confirm Settlement Toast */}
      {paymentSettledToast && (
        <div
          style={{
            margin: '16px 0',
            padding: '12px 16px',
            background: 'var(--soft-green)',
            border: '1px solid var(--green)',
            borderRadius: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>💰</span>
            <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 650 }}>
              Payment Settled: {paymentSettledToast.tableLabel || 'Table'} · {paymentSettledToast.finalPaidPaise ? money(paymentSettledToast.finalPaidPaise) : 'Paid'} (UPI Auto-Confirmed)
            </span>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPaymentSettledToast(null)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

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
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: 'var(--green)' }}>{counts.active}</div>
        </div>
        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
          <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Needs Clearing</span>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: counts.clearing > 0 ? 'var(--orange)' : 'inherit' }}>
            {counts.clearing > 0 ? `🧹 ${counts.clearing}` : '0'}
          </div>
        </div>
        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
          <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>In Kitchen</span>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: 'var(--orange)' }}>{counts.preparing}</div>
        </div>
        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--line)' }}>
          <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Needs Attention</span>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: counts.help > 0 ? 'var(--orange)' : 'inherit' }}>
            {counts.help > 0 ? `🚨 ${counts.help}` : '0'}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 14 }}>
        {[
          { key: 'ALL', label: 'All Tables' },
          { key: 'OCCUPIED', label: 'Occupied' },
          { key: 'NEEDS_CLEARING', label: `Needs Clearing 🧹${counts.clearing > 0 ? ` (${counts.clearing})` : ''}` },
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
                  <strong style={{ fontSize: 18, color: 'var(--ink)' }}>
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
                      background: cfg.bg,
                      color: cfg.text,
                      border: `1px solid ${cfg.border}`
                    }}
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Assistance alert preview */}
                {table.pendingRequest && (
                  <div
                    style={{
                      background: 'var(--soft-orange)',
                      border: '1px solid var(--orange)',
                      borderRadius: 8,
                      padding: '6px 8px',
                      fontSize: 12,
                      color: 'var(--orange)',
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
                    <strong style={{ fontSize: 13, color: 'var(--ink)' }}>
                      {money(table.totalBillPaise)}
                    </strong>
                  )}
                </div>

                {/* 1-Tap Quick Action when Needs Clearing */}
                {table.state === 'NEEDS_CLEARING' && (
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                    <button
                      type="button"
                      className="btn full small"
                      style={{
                        background: 'var(--orange)',
                        borderColor: 'transparent',
                        color: 'white',
                        fontWeight: 750,
                        fontSize: 11,
                        padding: '6px 8px',
                        boxShadow: '0 2px 6px rgba(234, 88, 12, 0.2)'
                      }}
                      disabled={vacateTable.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        vacateTable.mutate(table.id);
                      }}
                    >
                      {vacateTable.isPending ? 'Clearing…' : '🧹 Clear & Mark Vacant'}
                    </button>
                  </div>
                )}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--paper-elevated)', borderRadius: 12, border: '1px solid var(--line)' }}>
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

          {/* Table Clearing / Reset Action */}
          {selectedTable.state !== 'VACANT' && (
            <div style={{ padding: 14, background: selectedTable.state === 'NEEDS_CLEARING' ? 'var(--soft-orange)' : 'var(--paper-elevated)', border: `1.5px solid ${selectedTable.state === 'NEEDS_CLEARING' ? 'var(--orange)' : 'var(--line)'}`, borderRadius: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <strong style={{ color: selectedTable.state === 'NEEDS_CLEARING' ? 'var(--orange)' : 'var(--ink)', display: 'block', fontSize: 13 }}>
                    {selectedTable.state === 'NEEDS_CLEARING' ? '🧹 Table Awaiting Cleaning & Cutlery' : 'Reset Table for Next Guests'}
                  </strong>
                  <span style={{ fontSize: 11, color: selectedTable.state === 'NEEDS_CLEARING' ? 'var(--orange)' : 'var(--muted)', display: 'block', marginTop: 2 }}>
                    Marks table Vacant, revokes guest phone sessions, and clears table cart.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn small"
                  style={{ background: 'var(--orange)', borderColor: 'transparent', color: 'white', fontWeight: 750, whiteSpace: 'nowrap' }}
                  disabled={vacateTable.isPending}
                  onClick={() => vacateTable.mutate(selectedTable.id)}
                >
                  {vacateTable.isPending ? 'Clearing…' : '🧹 Clear & Mark Vacant'}
                </button>
              </div>
            </div>
          )}

          {/* Pending Assistance Request Action */}
          {selectedTable.pendingRequest && (
            <div style={{ padding: 14, background: 'var(--soft-orange)', border: '1px solid var(--orange)', borderRadius: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: '1 1 180px' }}>
                  <strong style={{ color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🚨 Guest Request: {selectedTable.pendingRequest.type}
                  </strong>
                  {selectedTable.pendingRequest.notes && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink)' }}>
                      Note: {selectedTable.pendingRequest.notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn small"
                  style={{ background: 'var(--orange)', borderColor: 'transparent' }}
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

          <div className="toolbar" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 20, flexWrap: 'wrap', gap: 10 }}>
            <button
              type="button"
              className="btn small"
              style={{ background: '#16a34a', borderColor: '#15803d', color: 'white', fontWeight: 700 }}
              onClick={() => {
                const id = selectedTable.id;
                setSelectedTable(null);
                setPunchOrderTableId(id);
              }}
            >
              ➕ Punch Order for {formatTableLabel(selectedTable.label)}
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedTable.orders.length > 0 && (
                <Link className="btn secondary small" to="/dashboard/orders">
                  View & Settle in Orders →
                </Link>
              )}
              <button type="button" className="btn secondary" onClick={() => setSelectedTable(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manual Waiter Punch-in Modal */}
      {punchOrderTableId !== null && (
        <ManualOrderModal
          initialTableId={punchOrderTableId || undefined}
          onClose={() => setPunchOrderTableId(null)}
          onOrderCreated={() => {
            void queryClient.invalidateQueries({ queryKey: ['floor-tables'] });
            void queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
          }}
        />
      )}
    </>
  );
}
