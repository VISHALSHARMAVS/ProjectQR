import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { elapsedSince } from '../../lib/format';
import { EmptyState, Loading, Modal } from '../../components/ui';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { playComplaintAlertChime } from '../../lib/audio';
import type { DishLeaderboardItem, ReviewRecord, ReviewSummary } from '../../types';

interface ReviewsResponse {
  reviews: ReviewRecord[];
  summary: ReviewSummary;
  dishLeaderboard: DishLeaderboardItem[];
}

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'ALL' | 'UNRESOLVED' | 'POSITIVE' | 'CRITICAL'>('ALL');
  const [resolvingReview, setResolvingReview] = useState<ReviewRecord | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolveError, setResolveError] = useState('');
  const [liveBanner, setLiveBanner] = useState<{ tableLabel: string; rating: number; comment?: string } | null>(null);

  const query = useQuery({
    queryKey: ['restaurant-reviews'],
    queryFn: () => api.get<ReviewsResponse>('/restaurant/reviews'),
    refetchInterval: 15_000
  });

  useOrderSocket(
    true,
    undefined,
    undefined,
    undefined,
    undefined,
    (alertPayload: unknown) => {
      const data = alertPayload as { tableLabel?: string; rating?: number; comment?: string } | undefined;
      playComplaintAlertChime();
      if (data?.tableLabel) {
        setLiveBanner({
          tableLabel: data.tableLabel,
          rating: data.rating ?? 1,
          comment: data.comment
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['restaurant-reviews'] });
    }
  );

  const resolveMutation = useMutation({
    mutationFn: async ({ reviewId, note }: { reviewId: string; note: string }) => {
      return api.patch<{ success: boolean; review: ReviewRecord }>(`/restaurant/reviews/${reviewId}/resolve`, {
        resolutionNote: note
      });
    },
    onSuccess: () => {
      setResolvingReview(null);
      setResolutionNote('');
      setResolveError('');
      void queryClient.invalidateQueries({ queryKey: ['restaurant-reviews'] });
    },
    onError: (err: unknown) => {
      setResolveError(err instanceof ApiError ? err.message : 'Could not resolve review.');
    }
  });

  if (query.isLoading) return <Loading label="Loading customer reviews & feedback…" />;
  if (query.error || !query.data) {
    return (
      <main className="dashboard-content">
        <div className="form-error">Could not load reviews. Please refresh.</div>
      </main>
    );
  }

  const { reviews, summary, dishLeaderboard } = query.data;

  const filteredReviews = reviews.filter((r) => {
    if (filter === 'UNRESOLVED') return !r.resolved && r.rating <= 3;
    if (filter === 'POSITIVE') return r.rating >= 4;
    if (filter === 'CRITICAL') return r.rating <= 2;
    return true;
  });

  const unresolvedCount = summary.unresolvedComplaints;

  return (
    <main className="dashboard-content">
      <header className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <span className="eyebrow">Customer Experience & Recovery</span>
          <h1 style={{ margin: '4px 0 6px', fontSize: 26, letterSpacing: '-.03em' }}>
            Reviews & Dining Feedback
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Rooted in behavioral psychology: instant table-side recovery for unhappy guests + 1-tap Google Maps booster for delighted diners.
          </p>
        </div>
      </header>

      {/* Live Manager Alert Banner */}
      {liveBanner && (
        <div
          style={{
            marginBottom: 20,
            padding: 16,
            background: 'var(--soft-orange)',
            border: '1px solid var(--red)',
            borderRadius: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 6px 20px rgba(239, 68, 68, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>🚨</span>
            <div>
              <strong style={{ color: 'var(--red)', fontSize: 15, display: 'block' }}>
                Instant Table Alert: {liveBanner.tableLabel} ({liveBanner.rating}★ Rating)
              </strong>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--ink)' }}>
                Guest needs manager attention table-side before departure!{' '}
                {liveBanner.comment ? `"${liveBanner.comment}"` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn small"
            style={{ background: 'var(--red)', color: '#fff', whiteSpace: 'nowrap' }}
            onClick={() => setLiveBanner(null)}
          >
            Dismiss Alert
          </button>
        </div>
      )}

      {/* Summary KPI Grid */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
          marginBottom: 24
        }}
      >
        <div className="surface" style={{ padding: 18, borderRadius: 12 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Average Dining Score
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b' }}>
              {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : '—'}
            </span>
            <span style={{ fontSize: 16, color: '#f59e0b' }}>★</span>
            <span className="muted" style={{ fontSize: 12 }}>
              ({summary.totalReviews} {summary.totalReviews === 1 ? 'rating' : 'ratings'})
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>
            {summary.sentimentCounts.POSITIVE} delighted guests
          </div>
        </div>

        <div className="surface" style={{ padding: 18, borderRadius: 12 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Google Maps Booster
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#2563eb' }}>
              {summary.googleClicks}
            </span>
            <span className="muted" style={{ fontSize: 12 }}>
              Google Reviews ({summary.googleClickConversionRate}% conversion)
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
            Automated redirect for 4-5 star diners
          </div>
        </div>

        <div
          className="surface"
          style={{
            padding: 18,
            borderRadius: 12,
            border: unresolvedCount > 0 ? '1.5px solid #f87171' : undefined,
            background: unresolvedCount > 0 ? '#fffaf0' : undefined
          }}
        >
          <span className="muted" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Table Recovery Needed
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: unresolvedCount > 0 ? '#dc2626' : '#16a34a'
              }}
            >
              {unresolvedCount}
            </span>
            <span className="muted" style={{ fontSize: 12 }}>
              {unresolvedCount === 1 ? 'incident' : 'incidents'}
            </span>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              fontWeight: 650,
              color: unresolvedCount > 0 ? '#b91c1c' : '#15803d'
            }}
          >
            {unresolvedCount > 0 ? '⚠️ Action needed table-side' : '✓ All complaints resolved'}
          </div>
        </div>

        <div className="surface" style={{ padding: 18, borderRadius: 12 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Sentiment Breakdown
          </span>
          <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', margin: '10px 0 8px', background: '#f1f5f9' }}>
            {summary.totalReviews > 0 ? (
              <>
                <div
                  style={{
                    width: `${(summary.sentimentCounts.POSITIVE / summary.totalReviews) * 100}%`,
                    background: '#22c55e'
                  }}
                  title={`Positive: ${summary.sentimentCounts.POSITIVE}`}
                />
                <div
                  style={{
                    width: `${(summary.sentimentCounts.NEUTRAL / summary.totalReviews) * 100}%`,
                    background: '#f59e0b'
                  }}
                  title={`Neutral: ${summary.sentimentCounts.NEUTRAL}`}
                />
                <div
                  style={{
                    width: `${(summary.sentimentCounts.NEGATIVE / summary.totalReviews) * 100}%`,
                    background: '#ef4444'
                  }}
                  title={`Negative: ${summary.sentimentCounts.NEGATIVE}`}
                />
              </>
            ) : (
              <div style={{ width: '100%', background: '#cbd5e1' }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
            <span>🟢 {summary.sentimentCounts.POSITIVE}</span>
            <span>🟡 {summary.sentimentCounts.NEUTRAL}</span>
            <span>🔴 {summary.sentimentCounts.NEGATIVE}</span>
          </div>
        </div>
      </section>

      {/* Dish Quality Leaderboard (Yumpingo Chef Diagnostics) */}
      {dishLeaderboard.length > 0 && (
        <section className="surface" style={{ padding: 20, borderRadius: 12, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 17, margin: 0, letterSpacing: '-.02em' }}>
                Dish Quality Leaderboard
              </h2>
              <span className="muted" style={{ fontSize: 12 }}>
                Real-time feedback on food taste & kitchen consistency
              </span>
            </div>
            <span className="pill green" style={{ fontSize: 11, fontWeight: 700 }}>
              KITCHEN DIAGNOSTICS
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12
            }}
          >
            {dishLeaderboard.map((item) => (
              <div
                key={item.dishName}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'var(--paper-elevated)',
                  border: item.satisfactionRate < 70 && item.thumbsDown > 0 ? '1.5px solid var(--red)' : '1px solid var(--line)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{item.dishName}</strong>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 750,
                      color: item.satisfactionRate >= 80 ? '#16a34a' : item.satisfactionRate >= 60 ? '#d97706' : '#dc2626'
                    }}
                  >
                    {item.satisfactionRate}% 👍
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b' }}>
                  <span>👍 {item.thumbsUp} likes</span>
                  <span>👎 {item.thumbsDown} dislikes</span>
                  <span>({item.totalVotes} votes)</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn small ${filter === 'ALL' ? '' : 'secondary'}`}
          onClick={() => setFilter('ALL')}
        >
          All Reviews ({reviews.length})
        </button>
        <button
          type="button"
          className={`btn small ${filter === 'UNRESOLVED' ? '' : 'secondary'}`}
          onClick={() => setFilter('UNRESOLVED')}
          style={unresolvedCount > 0 ? { borderColor: '#ef4444', color: filter === 'UNRESOLVED' ? undefined : '#b91c1c' } : {}}
        >
          🚨 Needs Resolution ({unresolvedCount})
        </button>
        <button
          type="button"
          className={`btn small ${filter === 'POSITIVE' ? '' : 'secondary'}`}
          onClick={() => setFilter('POSITIVE')}
        >
          ⭐ 4 & 5 Stars ({summary.sentimentCounts.POSITIVE})
        </button>
        <button
          type="button"
          className={`btn small ${filter === 'CRITICAL' ? '' : 'secondary'}`}
          onClick={() => setFilter('CRITICAL')}
        >
          👎 Critical (1-2 Stars)
        </button>
      </div>

      {/* Reviews Feed */}
      {filteredReviews.length === 0 ? (
        <EmptyState
          title="No reviews match this filter"
          description="Customer reviews stream in automatically when diners pay or finish their visit."
        />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {filteredReviews.map((r) => {
            const isNegative = r.rating <= 2;
            const isNeutral = r.rating === 3;
            return (
              <article
                key={r.id}
                className="surface"
                style={{
                  padding: 18,
                  borderRadius: 12,
                  borderLeft: isNegative ? '4px solid #dc2626' : isNeutral ? '4px solid #f59e0b' : '4px solid #16a34a'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18, color: '#f59e0b', letterSpacing: 2 }}>
                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                      </span>
                      <strong style={{ fontSize: 14, color: 'var(--ink)' }}>
                        {r.tableLabel || 'Table'}
                      </strong>
                      {r.customerName && (
                        <span className="muted" style={{ fontSize: 13 }}>
                          · {r.customerName}
                        </span>
                      )}
                    </div>
                    <span className="muted" style={{ fontSize: 11 }}>
                      {elapsedSince(r.createdAt)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {r.googleReviewClicked && (
                      <span className="pill" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: 11, fontWeight: 700 }}>
                        ⭐ Google Maps Review
                      </span>
                    )}
                    <span
                      className={`pill ${r.sentiment === 'POSITIVE' ? 'green' : r.sentiment === 'NEGATIVE' ? 'red' : 'orange'}`}
                      style={{ fontSize: 11 }}
                    >
                      {r.sentiment}
                    </span>
                  </div>
                </div>

                {/* Root Cause Diagnostic Tags */}
                {r.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0 10px' }}>
                    {r.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 12,
                          background: 'var(--soft-orange)',
                          color: 'var(--red)',
                          fontWeight: 650,
                          border: '1px solid var(--line)'
                        }}
                      >
                        ⚠️ {tag.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Dish Ratings */}
                {r.dishRatings.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 10px' }}>
                    {r.dishRatings.map((dish, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: dish.liked ? '#f0fdf4' : '#fef2f2',
                          color: dish.liked ? '#166534' : '#991b1b',
                          border: dish.liked ? '1px solid #bbf7d0' : '1px solid #fecaca',
                          fontWeight: 600
                        }}
                      >
                        {dish.liked ? '👍' : '👎'} {dish.dishName}
                      </span>
                    ))}
                  </div>
                )}

                {/* Customer Comment */}
                {r.comment && (
                  <p
                    style={{
                      margin: '8px 0 12px',
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'var(--ink)',
                      background: 'var(--paper-elevated)',
                      border: '1px solid var(--line)',
                      padding: '10px 14px',
                      borderRadius: 8
                    }}
                  >
                    "{r.comment}"
                  </p>
                )}

                {/* Resolution Status & Workflow */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  {r.resolved ? (
                    <div style={{ fontSize: 12, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>✓</span>
                      <span>
                        Resolved by <strong>{r.resolvedBy?.name || 'Staff'}</strong>: "{r.resolutionNote || 'Attended table-side'}"
                      </span>
                    </div>
                  ) : r.rating <= 3 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 650 }}>
                        🚨 Unresolved Guest Incident
                      </span>
                      <button
                        type="button"
                        className="btn small"
                        style={{ background: '#b91c1c', color: '#fff', fontSize: 12 }}
                        onClick={() => {
                          setResolvingReview(r);
                          setResolutionNote('');
                          setResolveError('');
                        }}
                      >
                        Log Table-Side Recovery
                      </button>
                    </div>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>
                      No recovery required for positive dining experience.
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Resolution Modal */}
      {resolvingReview && (
        <Modal
          title={`Resolve Incident: ${resolvingReview.tableLabel || 'Table'}`}
          onClose={() => setResolvingReview(null)}
          width={480}
        >
          <div style={{ padding: '8px 0 16px' }}>
            <p className="muted" style={{ fontSize: 13, margin: '0 0 14px' }}>
              Record what action was taken to recover this diner's experience (e.g. table apology, complimentary dessert, chef visit).
            </p>

            <div className="field">
              <label htmlFor="resolve-note" style={{ fontSize: 12, fontWeight: 600 }}>
                Manager Resolution Note
              </label>
              <textarea
                id="resolve-note"
                className="textarea"
                rows={3}
                placeholder="e.g. Visited Table 4, apologized for delayed main course, waived beverage charges. Customer was appreciative and satisfied."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
            </div>

            {resolveError && (
              <div className="form-error" style={{ marginBottom: 12, fontSize: 12 }}>
                {resolveError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setResolvingReview(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#15803d', color: '#fff' }}
                disabled={resolveMutation.isPending || !resolutionNote.trim()}
                onClick={() =>
                  resolveMutation.mutate({
                    reviewId: resolvingReview.id,
                    note: resolutionNote.trim()
                  })
                }
              >
                {resolveMutation.isPending ? 'Saving…' : 'Mark Incident Resolved ✓'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
