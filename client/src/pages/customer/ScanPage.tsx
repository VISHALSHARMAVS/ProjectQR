import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { api, ApiError } from '../../lib/api';
import { Loading } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';
import { formatTableLabel } from '../../lib/format';
import type { RestaurantInfo } from '../../types';

interface TableLanding { restaurant: RestaurantInfo; table: { id: string; label: string; hasActiveParty?: boolean } }
interface VerifiedSession {
  sessionId: string;
  customer: { id: string; name: string };
  restaurant: RestaurantInfo;
  table: { id: string; label: string; pin?: string | null };
  tab?: { id: string; label: string; isHost: boolean; isSeparateTab: boolean } | null;
  tableMismatch?: {
    currentTable: { id: string; label: string };
    scannedTable: { id: string; label: string; token: string };
  } | null;
}

export default function ScanPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['public-table', token], queryFn: () => api.get<TableLanding>(`/public/tables/${encodeURIComponent(token)}`), retry: false });
  const sessionQuery = useQuery({ queryKey: ['customer-session', token], queryFn: () => api.get<VerifiedSession>(`/customer/session?token=${encodeURIComponent(token)}`), retry: false });

  const switchTable = useMutation({
    mutationFn: (targetToken: string) => api.post<VerifiedSession>('/customer/switch-table', { token: targetToken }),
    onSuccess: (data) => {
      queryClient.setQueryData(['customer-session', token], data);
      navigate(`/order/${encodeURIComponent(token)}/menu`, { replace: true });
    }
  });

  if (sessionQuery.data && !sessionQuery.data.tableMismatch) return <Navigate to={`/order/${encodeURIComponent(token)}/menu`} replace />;
  if (query.isLoading) return <div className="customer-wrap"><Loading label="Finding your table…" /></div>;
  if (query.error) {
    const message = query.error instanceof ApiError ? query.error.message : 'This QR code could not be opened.';
    return <main className="customer-wrap customer-page"><div className="customer-intro"><span className="eyebrow">ProjectQR</span><h2>This table link is unavailable.</h2><p>{message} Please ask a team member for help.</p></div><Link to="/" className="btn secondary">Back to home</Link></main>;
  }
  if (!query.data) return <Navigate to="/" replace />;
  const { restaurant, table } = query.data;
  const brandStyle = restaurant.brandColor ? ({
    '--green': restaurant.brandColor,
    '--green-dark': restaurant.brandColor
  } as CSSProperties) : undefined;

  return <main className="customer-wrap customer-page" style={brandStyle}>
    {restaurant.bannerUrl && (
      <div style={{ width: '100%', maxHeight: 180, overflow: 'hidden', borderRadius: 16, marginBottom: 18 }}>
        <img src={restaurant.bannerUrl} alt={`${restaurant.name} banner`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )}
    <header className="customer-header">
      <div className="customer-header-brand">
        <div className="restaurant-logo">{restaurant.logoUrl ? <img src={restaurant.logoUrl} alt="" /> : restaurant.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <h1>{restaurant.name}</h1>
          <p>{formatTableLabel(table.label)}</p>
        </div>
      </div>
      <ThemeToggle variant="compact" />
    </header>
    <section className="customer-intro">
      <span className="eyebrow">{restaurant.welcomeTagline ? 'Welcome' : 'Welcome in'}</span>
      <h2>{restaurant.welcomeTagline || <>Make yourself<br />comfortable.</>}</h2>
      <p>{restaurant.description || 'Browse the menu and order whenever you’re ready. Your team will take it from here.'}</p>
    </section>
    <section className="customer-card surface">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16 }}>
        <div>
          <div className="eyebrow">Your table</div>
          <strong style={{ display: 'block', marginTop: 4, fontSize: 21 }}>{formatTableLabel(table.label)}</strong>
        </div>
        <span className="pill">Dine in</span>
      </div>

      {sessionQuery.data?.tableMismatch ? (
        <div style={{ marginBottom: 16, padding: 14, background: 'var(--soft-green)', borderRadius: 12, border: '1px solid var(--green)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>🪑</span>
            <strong style={{ fontSize: 14, color: 'var(--green)' }}>Switch Dining Table?</strong>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>
            You were previously active at <strong>{formatTableLabel(sessionQuery.data.tableMismatch.currentTable.label)}</strong>. Would you like to move your session to <strong>{formatTableLabel(table.label)}</strong>?
          </p>
          <button
            type="button"
            className="btn full"
            onClick={() => switchTable.mutate(token)}
            disabled={switchTable.isPending}
          >
            {switchTable.isPending ? 'Switching table…' : `✓ Switch to ${formatTableLabel(table.label)}`}
          </button>
        </div>
      ) : (
        <Link className="btn full" to={`/order/${encodeURIComponent(token)}/verify`}>Continue to the menu <span aria-hidden="true">→</span></Link>
      )}

      <p className="muted" style={{ margin: '12px 0 0', fontSize: 11, textAlign: 'center' }}>
        {restaurant.requireCustomerOtp
          ? 'We’ll ask you to verify a phone number before ordering.'
          : 'Instant dine-in ordering · No app or OTP required.'}
      </p>
    </section>
  </main>;
}
