import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Brand } from '../components/ui';
import { useStaff } from '../hooks/useStaff';

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const staff = useStaff();
  const mutation = useMutation({
    mutationFn: async () => mode === 'register'
      ? api.post('/auth/register', { restaurantName, ownerName, email, password })
      : api.post('/auth/login', { email, password }),
    onSuccess: async () => {
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['staff', 'me'] });
      navigate(searchParams.get('next') || '/dashboard', { replace: true });
    },
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'Could not sign in. Try again.')
  });
  if (staff.data) return <Navigate to="/dashboard" replace />;
  const isRegister = mode === 'register';

  return <main className="auth-shell">
    <aside className="auth-aside"><Link to="/"><Brand light /></Link><div><span className="eyebrow" style={{ color: '#c5d5c6' }}>A calmer service, one table at a time</span><h1>Good food.<br />Fewer waits.</h1><p>Bring your menu, tables and kitchen orders together in one simple place.</p></div><small style={{ color: '#c5d5c6' }}>Built for independent restaurants and cafés.</small></aside>
    <section className="auth-panel"><div className="auth-card surface">
      <span className="eyebrow">Restaurant workspace</span>
      <h2>{isRegister ? 'Create your restaurant' : 'Welcome back'}</h2>
      <p className="muted" style={{ margin: '0 0 22px', fontSize: 13 }}>{isRegister ? 'Start with a menu, a table and your first order.' : 'Sign in to manage your menu and orders.'}</p>
      <form className="form-grid" onSubmit={(event) => { event.preventDefault(); setError(''); mutation.mutate(); }}>
        {isRegister && <>
          <div className="field"><label htmlFor="restaurantName">Restaurant name</label><input className="input" id="restaurantName" required minLength={2} maxLength={120} value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} placeholder="The Green Fork" /></div>
          <div className="field"><label htmlFor="ownerName">Your name</label><input className="input" id="ownerName" required minLength={2} maxLength={100} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Aarav Sharma" /></div>
        </>}
        <div className="field"><label htmlFor="email">Email address</label><input className="input" id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@restaurant.com" /></div>
        <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={isRegister ? 10 : 1} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? 'At least 10 characters' : 'Your password'} /></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn full" disabled={mutation.isPending}>{mutation.isPending ? 'Please wait…' : isRegister ? 'Create restaurant' : 'Sign in'}</button>
      </form>
      <p className="muted" style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 12 }}>{isRegister ? 'Already set up?' : 'New to ProjectQR?'}{' '}<Link to={isRegister ? '/login' : '/register'} style={{ color: 'var(--green)', fontWeight: 700 }}>{isRegister ? 'Sign in' : 'Create a restaurant'}</Link></p>
    </div></section>
  </main>;
}
