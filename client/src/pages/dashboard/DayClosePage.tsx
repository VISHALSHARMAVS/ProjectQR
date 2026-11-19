import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { formatTableLabel, money } from '../../lib/format';
import { EmptyState, ErrorPanel, Loading } from '../../components/ui';
import { printOrderReceipt, printZReport } from '../../lib/printer';
import { useStaff } from '../../hooks/useStaff';
import type { DayCloseReport, OrderRecord } from '../../types';

export default function DayClosePage() {
  const staff = useStaff();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const query = useQuery({
    queryKey: ['day-close-report', selectedDate],
    queryFn: () => api.get<{ report: DayCloseReport }>(`/restaurant/day-close?date=${selectedDate}`),
    refetchInterval: 30_000
  });

  const setOffsetDate = (days: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    setSelectedDate(cur.toISOString().slice(0, 10));
  };

  if (query.isLoading) return <Loading label="Calculating daily register metrics…" />;
  if (query.error || !query.data) {
    return (
      <ErrorPanel
        message={query.error instanceof ApiError ? query.error.message : 'Daily register report could not be loaded.'}
        retry={() => void query.refetch()}
      />
    );
  }

  const { report } = query.data;
  const isToday = selectedDate === new Date().toISOString().slice(0, 10);
  const restaurantName = staff.data?.restaurant?.name || report.restaurantName || 'Restaurant';

  return (
    <>
      <div className="heading-row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span className="eyebrow">Daily Register Audit & Reconciliation</span>
          <h1>Day Close / Z-Report</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Reconcile physical cash drawer, digital UPI, and card payments against settled orders for the day.
          </p>
        </div>
        <div className="toolbar" style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => setOffsetDate(-1)}
              title="Previous Day"
            >
              ← Prev
            </button>
            <input
              type="date"
              className="input"
              style={{ width: 145, padding: '6px 8px' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button
              type="button"
              className={`btn small ${isToday ? 'ghost' : 'secondary'}`}
              onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
              disabled={isToday}
            >
              Today
            </button>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => setOffsetDate(1)}
              title="Next Day"
            >
              Next →
            </button>
          </div>
          <button
            type="button"
            className="btn small"
            onClick={() => printZReport(report)}
            title="Print 80mm Cashier Day-Close Z-Report slip"
          >
            🖨️ Print 80mm Z-Report
          </button>
        </div>
      </div>

      {/* Primary Financial Reconciliation Cards */}
      <section className="stat-grid" style={{ marginTop: 20 }}>
        <article className="stat-card surface">
          <div className="eyebrow">Net Revenue Collected</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{money(report.netSalesPaise)}</div>
          <div className="stat-caption">
            Gross: {money(report.grossSalesPaise)} · Discounts: -{money(report.totalDiscountsPaise)}
          </div>
        </article>

        <article className="stat-card surface" style={{ borderLeft: '4px solid #16a34a' }}>
          <div className="eyebrow">💵 Cash in Drawer</div>
          <div className="stat-value">{money(report.tenders.cashPaise)}</div>
          <div className="stat-caption">Physical notes and coins to balance in register</div>
        </article>

        <article className="stat-card surface" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="eyebrow">📱 UPI / QR Digital</div>
          <div className="stat-value">{money(report.tenders.upiPaise)}</div>
          <div className="stat-caption">PhonePe, GPay, Paytm soundbox bank credits</div>
        </article>

        <article className="stat-card surface" style={{ borderLeft: '4px solid #9333ea' }}>
          <div className="eyebrow">💳 Card Swipes</div>
          <div className="stat-value">{money(report.tenders.cardPaise)}</div>
          <div className="stat-caption">Debit/Credit POS card terminal settlement slips</div>
        </article>
      </section>

      {/* Tax Audit & Operational Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 20 }}>
        {/* Tax Audit Breakdown */}
        <section className="surface" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, margin: 0 }}>🧾 GST Tax Breakdown</h3>
            <span className="pill gray" style={{ fontSize: 11 }}>Rate: {report.gstPercentage}%</span>
          </div>
          {report.gstin ? (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              Restaurant GSTIN: <strong style={{ color: 'var(--ink)' }}>{report.gstin}</strong>
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
              <span className="muted">Net Taxable Subtotal</span>
              <strong>{money(report.taxableAmountPaise)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">CGST ({(report.gstPercentage / 2).toFixed(1)}%)</span>
              <span>{money(report.cgstPaise)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">SGST ({(report.gstPercentage / 2).toFixed(1)}%)</span>
              <span>{money(report.sgstPaise)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line)', fontWeight: 700, fontSize: 14 }}>
              <span>Total Tax Collected</span>
              <span style={{ color: 'var(--ink)' }}>{money(report.cgstPaise + report.sgstPaise)}</span>
            </div>
          </div>
        </section>

        {/* Operational Statistics */}
        <section className="surface" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, margin: 0 }}>📊 Operations & Volume</h3>
            <span className="pill gray" style={{ fontSize: 11 }}>Date: {report.date}</span>
          </div>

          <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
              <span className="muted">Total Settled / Paid Orders</span>
              <strong style={{ color: '#15803d' }}>{report.orderCounts.paidOrders} orders</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Average Ticket Value (AOV)</span>
              <strong>{money(report.orderCounts.averageOrderValuePaise)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Total Dishes / Portions Sold</span>
              <span>{report.orderCounts.totalItemsSold} items</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Void / Rejected Orders</span>
              <span style={{ color: report.orderCounts.rejectedOrders > 0 ? '#b91c1c' : 'inherit' }}>
                {report.orderCounts.rejectedOrders}
              </span>
            </div>
            {report.orderCounts.unpaidOrders > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line)', color: '#b45309', fontWeight: 600 }}>
                <span>⚠ Open / Unpaid Tables</span>
                <span>{report.orderCounts.unpaidOrders} ({money(report.tenders.unpaidPaise)})</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Transaction Register Table */}
      <div className="heading-row" style={{ marginTop: 32, marginBottom: 12 }}>
        <div>
          <span className="eyebrow">Order Ledger</span>
          <h2>All Transactions ({report.settledOrders.length})</h2>
        </div>
      </div>

      <section className="surface table-wrap" style={{ padding: '4px 0' }}>
        {report.settledOrders.length === 0 ? (
          <EmptyState
            title="No transactions for this date"
            description="Orders settled on this date will appear in the register ledger."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Time</th>
                <th>Table</th>
                <th>Status / Mode</th>
                <th style={{ textAlign: 'right' }}>Gross</th>
                <th style={{ textAlign: 'right' }}>Discount</th>
                <th style={{ textAlign: 'right' }}>Net Paid</th>
                <th style={{ textAlign: 'right' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {report.settledOrders.map((order) => {
                const timeStr = order.settledAt
                  ? new Date(order.settledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <tr key={order.id}>
                    <td><strong>{order.orderNumber}</strong></td>
                    <td className="muted" style={{ fontSize: 12 }}>{timeStr}</td>
                    <td>{formatTableLabel(order.tableLabel)}</td>
                    <td>
                      {order.paymentStatus === 'PAID' ? (
                        <span className="pill green" style={{ fontSize: 11 }}>
                          ✓ {order.paymentMethod || 'PAID'}
                        </span>
                      ) : (
                        <span className="pill yellow" style={{ fontSize: 11 }}>
                          UNPAID
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{money(order.totalPaise)}</td>
                    <td style={{ textAlign: 'right', color: order.discountPaise > 0 ? '#b91c1c' : 'inherit' }}>
                      {order.discountPaise > 0 ? `-${money(order.discountPaise)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {money(order.finalPaidPaise)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => {
                          const orderRecord: OrderRecord = {
                            id: order.id,
                            orderNumber: order.orderNumber,
                            table: { label: order.tableLabel },
                            items: [],
                            status: 'DELIVERED',
                            statusHistory: [],
                            subtotalPaise: order.totalPaise,
                            totalPaise: order.totalPaise,
                            paymentStatus: order.paymentStatus as 'PAID' | 'UNPAID',
                            paymentMethod: order.paymentMethod,
                            discountPaise: order.discountPaise,
                            finalPaidPaise: order.finalPaidPaise,
                            settledAt: order.settledAt,
                            notes: '',
                            rejectionReason: '',
                            createdAt: order.createdAt,
                            updatedAt: order.settledAt || order.createdAt
                          };
                          printOrderReceipt(orderRecord, restaurantName, 'BILL', report.gstin, report.gstPercentage);
                        }}
                        title="Reprint Bill Receipt"
                      >
                        🧾 Bill
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
