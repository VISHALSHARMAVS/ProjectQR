import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { ApiError, api } from '../../lib/api';
import { Loading } from '../../components/ui';
import { formatTableLabel } from '../../lib/format';
import type { RestaurantInfo } from '../../types';

interface TableLanding { restaurant: RestaurantInfo; table: { id: string; label: string } }
interface OtpResponse { message: string; expiresInSeconds: number; mockOtp?: string }
interface VerifiedSession {
  sessionId: string;
  customer: { id: string; name: string };
  restaurant: RestaurantInfo;
  table: { id: string; label: string };
  expiresAt: string;
  tableMismatch?: {
    currentTable: { id: string; label: string };
    scannedTable: { id: string; label: string; token: string };
  } | null;
}

export default function VerifyPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tableQuery = useQuery({ queryKey: ['public-table', token], queryFn: () => api.get<TableLanding>(`/public/tables/${encodeURIComponent(token)}`), retry: false });
  const sessionQuery = useQuery({ queryKey: ['customer-session', token], queryFn: () => api.get<VerifiedSession>(`/customer/session?token=${encodeURIComponent(token)}`), retry: false });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [mockOtp, setMockOtp] = useState('');
  const [error, setError] = useState('');

  const quickJoinMutation = useMutation({
    mutationFn: () => api.post<VerifiedSession>('/customer/quick-join', { token, name: name.trim() }),
    onSuccess: (response) => {
      setError('');
      queryClient.setQueryData(['customer-session', token], response);
      navigate(`/order/${encodeURIComponent(token)}/menu`, { replace: true });
    },
    onError: (cause) => setError(cause instanceof ApiError ? cause.message : 'Could not join table.')
  });

  const switchTableMutation = useMutation({
    mutationFn: () => api.post<VerifiedSession>('/customer/switch-table', { token }),
    onSuccess: (response) => {
      setError('');
      queryClient.setQueryData(['customer-session', token], response);
      navigate(`/order/${encodeURIComponent(token)}/menu`, { replace: true });
    },
    onError: (cause) => setError(cause instanceof ApiError ? cause.message : 'Could not switch table.')
  });

  const requestMutation = useMutation({
    mutationFn: () => api.post<OtpResponse>('/customer/request-otp', { token, name: name.trim(), phone }),
    onSuccess: (response) => {
      setError('');
      setMockOtp(response.mockOtp ?? '');
      if (response.mockOtp) setCode(response.mockOtp);
    }
  });
  const verifyMutation = useMutation({
    mutationFn: () => api.post<VerifiedSession>('/customer/verify-otp', { token, name: name.trim(), phone, code }),
    onSuccess: (response) => { setError(''); localStorage.removeItem(`projectqr-cart:${token}`); queryClient.setQueryData(['customer-session', token], response); navigate(`/order/${encodeURIComponent(token)}/menu`, { replace: true }); },
    onError: (cause) => setError(cause instanceof ApiError ? cause.message : 'That code could not be verified.')
  });
  if (sessionQuery.data && !sessionQuery.data.tableMismatch) return <Navigate to={`/order/${encodeURIComponent(token)}/menu`} replace />;
  if (tableQuery.isLoading) return <div className="customer-wrap"><Loading label="Loading restaurant…" /></div>;
  if (tableQuery.error || !tableQuery.data) return <main className="customer-wrap customer-page"><div className="form-error" style={{ marginTop: 32 }}>This table link is unavailable. Ask a team member for help.</div><Link className="btn secondary" style={{ marginTop: 13 }} to="/">Back to home</Link></main>;
  const { restaurant, table } = tableQuery.data;
  const isStrictOtp = Boolean(restaurant.requireCustomerOtp);
  const requested = requestMutation.isSuccess;
  const brandStyle = restaurant.brandColor ? ({
    '--green': restaurant.brandColor,
    '--green-dark': restaurant.brandColor
  } as CSSProperties) : undefined;
  const isPending = quickJoinMutation.isPending || requestMutation.isPending || verifyMutation.isPending || switchTableMutation.isPending;

  return <main className="customer-wrap customer-page" style={brandStyle}>
    <header className="customer-header">
      <div className="restaurant-logo">{restaurant.logoUrl ? <img src={restaurant.logoUrl} alt="" /> : restaurant.name.slice(0, 1).toUpperCase()}</div>
      <div>
        <h1>{restaurant.name}</h1>
        <p>{formatTableLabel(table.label)}</p>
      </div>
    </header>
    <section className="customer-intro">
      <span className="eyebrow">Welcome</span>
      <h2>Who’s joining<br />us today?</h2>
      <p>
        {isStrictOtp
          ? `Enter your mobile number to verify your session at ${formatTableLabel(table.label)}.`
          : `Enter your name to browse the menu and order together with everyone at ${formatTableLabel(table.label)}.`}
      </p>
    </section>

    {isStrictOtp && (
      <div className="notice" style={{ marginBottom: 16 }}>
        📱 Phone verification required by {restaurant.name} before placing orders.
      </div>
    )}

    <section className="customer-card surface">
      {sessionQuery.data?.tableMismatch && (
        <div style={{ marginBottom: 16, padding: 14, background: '#f0fdf4', borderRadius: 12, border: '1.5px solid #86efac' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>🪑</span>
            <strong style={{ fontSize: 14, color: '#166534' }}>Switch Dining Table?</strong>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#14532d', lineHeight: 1.4 }}>
            You are active at <strong>{formatTableLabel(sessionQuery.data.tableMismatch.currentTable.label)}</strong>. Click below to move your session to <strong>{formatTableLabel(table.label)}</strong>.
          </p>
          <button
            type="button"
            className="btn full"
            onClick={() => switchTableMutation.mutate()}
            disabled={switchTableMutation.isPending}
          >
            {switchTableMutation.isPending ? 'Switching table…' : `✓ Switch to ${formatTableLabel(table.label)}`}
          </button>
        </div>
      )}

      {sessionQuery.error instanceof ApiError && sessionQuery.error.code === 'CUSTOMER_SESSION_TABLE_MISMATCH' && (
        <div className="notice" style={{ marginBottom: 14 }}>
          You were seated at a different table. Enter your name below to start your session at {formatTableLabel(table.label)}.
        </div>
      )}

      {!isStrictOtp ? (
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            if (name.trim().length >= 2) quickJoinMutation.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="quick-name">Your Name</label>
            <input
              className="input"
              id="quick-name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul, Priya, Alex"
              autoFocus
            />
            <span className="muted" style={{ fontSize: 11 }}>
              Your name will appear next to items you add to the shared table cart.
            </span>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
          {quickJoinMutation.error && !error && (
            <div className="form-error" role="alert">
              {quickJoinMutation.error instanceof ApiError ? quickJoinMutation.error.message : 'Could not join table. Please try again.'}
            </div>
          )}

          <button className="btn full" disabled={isPending || name.trim().length < 2}>
            {quickJoinMutation.isPending && <span className="btn-spinner" aria-hidden="true" />}
            {quickJoinMutation.isPending ? 'Joining Table…' : `Join ${formatTableLabel(table.label)} Menu →`}
          </button>
        </form>
      ) : (
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            if (!requested) requestMutation.mutate();
            else verifyMutation.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="customer-name">Your name</label>
            <input
              className="input"
              id="customer-name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (requested) { requestMutation.reset(); setCode(''); setMockOtp(''); }
              }}
              placeholder="Name for the order"
            />
          </div>

          <div className="field">
            <label htmlFor="customer-phone">Phone number</label>
            <input
              className="input"
              id="customer-phone"
              type="tel"
              autoComplete="tel"
              required
              minLength={8}
              maxLength={25}
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                if (requested) { requestMutation.reset(); setCode(''); setMockOtp(''); }
              }}
              placeholder="98765 43210"
            />
            <span className="muted" style={{ fontSize: 11 }}>We’ll send an SMS code to verify your phone.</span>
          </div>

          {requested && <>
            {mockOtp && <div className="notice success" role="status"><strong>Demo / Preview OTP Mode</strong><br />Your verification code is <strong>{mockOtp}</strong> (auto-filled below).</div>}
            <div className="field">
              <label htmlFor="otp-code">Six-digit code</label>
              <input
                className="input"
                id="otp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
              />
            </div>
            <button className="btn ghost small" type="button" onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending}>Send a new code</button>
          </>}

          {error && <div className="form-error" role="alert">{error}</div>}
          {(requestMutation.error || verifyMutation.error) && !error && (
            <div className="form-error" role="alert">
              {(requestMutation.error ?? verifyMutation.error) instanceof ApiError ? (requestMutation.error ?? verifyMutation.error as ApiError).message : 'Something went wrong. Please try again.'}
            </div>
          )}

          <button className="btn full" disabled={isPending}>
            {isPending && <span className="btn-spinner" aria-hidden="true" />}
            {isPending ? 'Please wait…' : requested ? 'Verify and view menu' : 'Send verification code'}
          </button>
        </form>
      )}
    </section>
  </main>;
}
