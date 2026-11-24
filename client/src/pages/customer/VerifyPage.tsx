import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { ApiError, api } from '../../lib/api';
import { Loading } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';
import { formatTableLabel } from '../../lib/format';
import type { CustomerTabInfo, RestaurantInfo } from '../../types';

interface TableLanding {
  restaurant: RestaurantInfo;
  table: { id: string; label: string; hasActiveParty?: boolean };
}
interface OtpResponse { message: string; expiresInSeconds: number; mockOtp?: string }
interface VerifiedSession {
  sessionId: string;
  customer: { id: string; name: string };
  restaurant: RestaurantInfo;
  table: { id: string; label: string; pin?: string | null };
  tab?: CustomerTabInfo;
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
  const [pin, setPin] = useState('');
  const [joinMode, setJoinMode] = useState<'join' | 'separate'>('join');
  const [error, setError] = useState('');

  const quickJoinMutation = useMutation({
    mutationFn: () => api.post<VerifiedSession>('/customer/quick-join', {
      token,
      name: name.trim(),
      pin: joinMode === 'join' && tableQuery.data?.table.hasActiveParty ? pin.trim() : undefined,
      separateTab: joinMode === 'separate' && tableQuery.data?.table.hasActiveParty
    }),
    onSuccess: (response) => {
      setError('');
      queryClient.setQueryData(['customer-session', token], response);
      navigate(`/order/${encodeURIComponent(token)}/menu`, { replace: true });
    },
    onError: (cause) => setError(cause instanceof ApiError ? cause.message : 'Could not join table.')
  });

  const switchTableMutation = useMutation({
    mutationFn: () => api.post<VerifiedSession>('/customer/switch-table', {
      token,
      pin: joinMode === 'join' && tableQuery.data?.table.hasActiveParty ? pin.trim() : undefined,
      separateTab: joinMode === 'separate' && tableQuery.data?.table.hasActiveParty
    }),
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
    mutationFn: () => api.post<VerifiedSession>('/customer/verify-otp', {
      token,
      name: name.trim(),
      phone,
      code,
      pin: joinMode === 'join' && tableQuery.data?.table.hasActiveParty ? pin.trim() : undefined,
      separateTab: joinMode === 'separate' && tableQuery.data?.table.hasActiveParty
    }),
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
  const requiresPin = Boolean(table.hasActiveParty && joinMode === 'join');
  const isPinReady = !requiresPin || pin.trim().length === 4;

  return <main className="customer-wrap customer-page" style={brandStyle}>
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
        <div style={{ marginBottom: 16, padding: 14, background: 'var(--soft-green)', borderRadius: 12, border: '1.5px solid var(--green)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>🪑</span>
            <strong style={{ fontSize: 14, color: 'var(--green)' }}>Switch Dining Table?</strong>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>
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
            if (name.trim().length >= 2 && isPinReady) quickJoinMutation.mutate();
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
              Your name will appear next to items you add to the {joinMode === 'separate' ? 'bill' : 'table cart'}.
            </span>
          </div>

          {table.hasActiveParty && (
            <div style={{ background: 'var(--paper-elevated)', borderRadius: 12, padding: 12, border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>👥</span> Someone is already dining at {formatTableLabel(table.label)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => { setJoinMode('join'); setError(''); }}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: joinMode === 'join' ? '2px solid var(--green)' : '1px solid var(--line)',
                    background: joinMode === 'join' ? 'var(--soft-green)' : 'var(--paper)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 16 }}>👥</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: joinMode === 'join' ? 'var(--green)' : 'var(--ink)' }}>Join Party</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Needs 4-digit PIN</div>
                </button>
                <button
                  type="button"
                  onClick={() => { setJoinMode('separate'); setError(''); }}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: joinMode === 'separate' ? '2px solid var(--green)' : '1px solid var(--line)',
                    background: joinMode === 'separate' ? 'var(--soft-green)' : 'var(--paper)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 16 }}>👤</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: joinMode === 'separate' ? 'var(--green)' : 'var(--ink)' }}>Separate Bill</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Solo / private tab</div>
                </button>
              </div>

              {joinMode === 'join' ? (
                <div className="field">
                  <label htmlFor="quick-table-pin" style={{ fontSize: 12, fontWeight: 600 }}>Enter 4-Digit Table PIN</label>
                  <input
                    id="quick-table-pin"
                    className="input"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="e.g. 4821"
                    style={{ letterSpacing: 6, fontWeight: 800, fontSize: 18, textAlign: 'center' }}
                    required
                  />
                  <span className="muted" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                    Ask the friend at this table for the PIN on their phone.
                  </span>
                </div>
              ) : (
                <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: 'var(--ink)' }}>
                  ✓ <strong>Separate Tab:</strong> Your orders and bill will be kept completely separate from other guests at this table.
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="form-error" role="alert">
              <div>{error}</div>
              {joinMode === 'join' && (
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ marginTop: 6, textDecoration: 'underline', color: 'inherit', padding: 0 }}
                  onClick={() => { setJoinMode('separate'); setError(''); }}
                >
                  👉 Dining solo? Start a Separate Bill instead
                </button>
              )}
            </div>
          )}
          {quickJoinMutation.error && !error && (
            <div className="form-error" role="alert">
              {quickJoinMutation.error instanceof ApiError ? quickJoinMutation.error.message : 'Could not join table. Please try again.'}
            </div>
          )}

          <button className="btn full" disabled={isPending || name.trim().length < 2 || !isPinReady}>
            {quickJoinMutation.isPending && <span className="btn-spinner" aria-hidden="true" />}
            {quickJoinMutation.isPending
              ? 'Joining Table…'
              : table.hasActiveParty
                ? joinMode === 'join'
                  ? 'Join Party Cart →'
                  : 'Start Separate Bill →'
                : `Join ${formatTableLabel(table.label)} Menu →`}
          </button>
        </form>
      ) : (
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            if (!requested) requestMutation.mutate();
            else if (isPinReady) verifyMutation.mutate();
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

          {table.hasActiveParty && (
            <div style={{ background: 'var(--paper-elevated)', borderRadius: 12, padding: 12, border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>👥</span> Someone is already dining at {formatTableLabel(table.label)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => { setJoinMode('join'); setError(''); }}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: joinMode === 'join' ? '2px solid var(--green)' : '1px solid var(--line)',
                    background: joinMode === 'join' ? 'var(--soft-green)' : 'var(--paper)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 16 }}>👥</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: joinMode === 'join' ? 'var(--green)' : 'var(--ink)' }}>Join Party</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Needs 4-digit PIN</div>
                </button>
                <button
                  type="button"
                  onClick={() => { setJoinMode('separate'); setError(''); }}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: joinMode === 'separate' ? '2px solid var(--green)' : '1px solid var(--line)',
                    background: joinMode === 'separate' ? 'var(--soft-green)' : 'var(--paper)',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 16 }}>👤</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: joinMode === 'separate' ? 'var(--green)' : 'var(--ink)' }}>Separate Bill</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Solo / private tab</div>
                </button>
              </div>

              {joinMode === 'join' ? (
                <div className="field">
                  <label htmlFor="otp-table-pin" style={{ fontSize: 12, fontWeight: 600 }}>Enter 4-Digit Table PIN</label>
                  <input
                    id="otp-table-pin"
                    className="input"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="e.g. 4821"
                    style={{ letterSpacing: 6, fontWeight: 800, fontSize: 18, textAlign: 'center' }}
                    required
                  />
                  <span className="muted" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                    Ask the friend at this table for the PIN on their phone.
                  </span>
                </div>
              ) : (
                <div style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: 'var(--ink)' }}>
                  ✓ <strong>Separate Tab:</strong> Your orders and bill will be kept completely separate from other guests at this table.
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="form-error" role="alert">
              <div>{error}</div>
              {joinMode === 'join' && (
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ marginTop: 6, textDecoration: 'underline', color: 'inherit', padding: 0 }}
                  onClick={() => { setJoinMode('separate'); setError(''); }}
                >
                  👉 Dining solo? Start a Separate Bill instead
                </button>
              )}
            </div>
          )}
          {(requestMutation.error || verifyMutation.error) && !error && (
            <div className="form-error" role="alert">
              {(requestMutation.error ?? verifyMutation.error) instanceof ApiError ? (requestMutation.error ?? verifyMutation.error as ApiError).message : 'Something went wrong. Please try again.'}
            </div>
          )}

          <button className="btn full" disabled={isPending || (requested && !isPinReady)}>
            {isPending && <span className="btn-spinner" aria-hidden="true" />}
            {isPending
              ? 'Please wait…'
              : requested
                ? table.hasActiveParty
                  ? joinMode === 'join'
                    ? 'Verify & Join Table Cart'
                    : 'Verify & Start Separate Bill'
                  : 'Verify and view menu'
                : 'Send verification code'}
          </button>
        </form>
      )}
    </section>
  </main>;
}
