import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api } from '../../lib/api';
import { Loading } from '../../components/ui';
import type { RestaurantInfo } from '../../types';

interface TableLanding { restaurant: RestaurantInfo; table: { id: string; label: string } }
interface OtpResponse { message: string; expiresInSeconds: number; mockOtp?: string }
interface VerifiedSession { sessionId: string; customer: { id: string; name: string }; restaurant: RestaurantInfo; table: { id: string; label: string }; expiresAt: string }

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
  const requestMutation = useMutation({
    mutationFn: () => api.post<OtpResponse>('/customer/request-otp', { token, name, phone }),
    onSuccess: (response) => { setError(''); setMockOtp(response.mockOtp ?? ''); }
  });
  const verifyMutation = useMutation({
    mutationFn: () => api.post<VerifiedSession>('/customer/verify-otp', { token, name, phone, code }),
    onSuccess: (response) => { setError(''); localStorage.removeItem(`projectqr-cart:${token}`); queryClient.setQueryData(['customer-session', token], response); navigate(`/order/${encodeURIComponent(token)}/menu`, { replace: true }); },
    onError: (cause) => setError(cause instanceof ApiError ? cause.message : 'That code could not be verified.')
  });
  if (sessionQuery.data) return <Navigate to={`/order/${encodeURIComponent(token)}/menu`} replace />;
  if (tableQuery.isLoading) return <div className="customer-wrap"><Loading label="Loading restaurant…" /></div>;
  if (tableQuery.error || !tableQuery.data) return <main className="customer-wrap customer-page"><div className="form-error" style={{ marginTop: 32 }}>This table link is unavailable. Ask a team member for help.</div><Link className="btn secondary" style={{ marginTop: 13 }} to="/">Back to home</Link></main>;
  const { restaurant, table } = tableQuery.data;
  const requested = requestMutation.isSuccess;
  return <main className="customer-wrap customer-page">
    <header className="customer-header"><div className="restaurant-logo">{restaurant.logoUrl ? <img src={restaurant.logoUrl} alt="" /> : restaurant.name.slice(0, 1).toUpperCase()}</div><div><h1>{restaurant.name}</h1><p>Table {table.label}</p></div></header>
    <section className="customer-intro"><span className="eyebrow">A quick check</span><h2>Who’s joining<br />us today?</h2><p>We’ll use your phone number to keep this table’s order updates together. No account needed.</p></section>
    <section className="customer-card surface"><form className="form-grid" onSubmit={(event) => { event.preventDefault(); setError(''); if (!requested) requestMutation.mutate(); else verifyMutation.mutate(); }}>
      <div className="field"><label htmlFor="customer-name">Your name</label><input className="input" id="customer-name" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(event) => { setName(event.target.value); if (requested) { requestMutation.reset(); setCode(''); setMockOtp(''); } }} placeholder="Name for the order" /></div>
      {sessionQuery.error instanceof ApiError && sessionQuery.error.code === 'CUSTOMER_SESSION_TABLE_MISMATCH' && <div className="notice">You’re signed in for another table. Verify again to start a visit here.</div>}
      <div className="field"><label htmlFor="customer-phone">Phone number</label><input className="input" id="customer-phone" type="tel" autoComplete="tel" required minLength={8} maxLength={25} value={phone} onChange={(event) => { setPhone(event.target.value); if (requested) { requestMutation.reset(); setCode(''); setMockOtp(''); } }} placeholder="98765 43210" /><span className="muted" style={{ fontSize: 11 }}>A one-time code will be sent to verify your number.</span></div>
      {requested && <>
        {mockOtp && <div className="notice success" role="status"><strong>Development OTP mode</strong><br />Your test verification code is <strong>{mockOtp}</strong>.</div>}
        <div className="field"><label htmlFor="otp-code">Six-digit code</label><input className="input" id="otp-code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></div>
        <button className="btn ghost small" type="button" onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending}>Send a new code</button>
      </>}
      {error && <div className="form-error" role="alert">{error}</div>}
      {(requestMutation.error || verifyMutation.error) && !error && <div className="form-error" role="alert">{(requestMutation.error ?? verifyMutation.error) instanceof ApiError ? (requestMutation.error ?? verifyMutation.error as ApiError).message : 'Something went wrong. Please try again.'}</div>}
      <button className="btn full" disabled={requestMutation.isPending || verifyMutation.isPending}>{requestMutation.isPending || verifyMutation.isPending ? 'Please wait…' : requested ? 'Verify and view menu' : 'Send verification code'}</button>
    </form></section>
  </main>;
}
