import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Brand } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { useStaff } from '../hooks/useStaff';

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <main className="auth-shell">
      <aside className="auth-aside">
        <Link to="/"><Brand light /></Link>
        <div>
          <span className="eyebrow" style={{ color: '#c5d5c6' }}>A calmer service, one table at a time</span>
          <h1>Good food.<br />Fewer waits.</h1>
          <p>Bring your menu, tables and kitchen orders together in one simple place.</p>
          <div style={{ marginTop: 24 }}>
            <Link
              to="/demo"
              className="btn small"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                backdropFilter: 'blur(4px)'
              }}
            >
              Explore interactive demo →
            </Link>
          </div>
        </div>
        <small style={{ color: '#c5d5c6' }}>Built for independent restaurants and cafés.</small>
      </aside>

      <section className="auth-panel">
        <div className="auth-card surface">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <Link to="/" style={{ display: 'inline-flex', textDecoration: 'none' }}>
              <Brand />
            </Link>
            <ThemeToggle variant="compact" />
          </div>

          <span className="eyebrow">Restaurant workspace</span>
          <h2>{isRegister ? 'Create your restaurant' : 'Welcome back'}</h2>
          <p className="muted" style={{ margin: '0 0 22px', fontSize: 13 }}>
            {isRegister ? 'Start with a menu, a table and your first order.' : 'Sign in to manage your menu and orders.'}
          </p>

          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
              mutation.mutate();
            }}
          >
            {isRegister && (
              <>
                <div className="field">
                  <label htmlFor="restaurantName">Restaurant name</label>
                  <input
                    className="input"
                    id="restaurantName"
                    required
                    minLength={2}
                    maxLength={120}
                    value={restaurantName}
                    onChange={(event) => setRestaurantName(event.target.value)}
                    placeholder="The Green Fork"
                  />
                </div>
                <div className="field">
                  <label htmlFor="ownerName">Your name</label>
                  <input
                    className="input"
                    id="ownerName"
                    required
                    minLength={2}
                    maxLength={100}
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    placeholder="Aarav Sharma"
                  />
                </div>
              </>
            )}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                className="input"
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@restaurant.com"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  minLength={isRegister ? 10 : 1}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isRegister ? 'At least 10 characters' : 'Your password'}
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    padding: '6px',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div className="form-error" role="alert">{error}</div>}

            <button className="btn full" disabled={mutation.isPending}>
              {mutation.isPending && <span className="btn-spinner" aria-hidden="true" />}
              {mutation.isPending ? 'Please wait…' : isRegister ? 'Create restaurant' : 'Sign in'}
            </button>
          </form>

          <p className="muted" style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 13 }}>
            {isRegister ? 'Already set up?' : 'New to Mesa?'}{' '}
            <Link to={isRegister ? '/login' : '/register'} style={{ color: 'var(--green)', fontWeight: 700 }}>
              {isRegister ? 'Sign in' : 'Create a restaurant'}
            </Link>
          </p>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)', textAlign: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>Evaluating Mesa?</span>{' '}
            <Link to="/demo" style={{ color: 'var(--green)', fontWeight: 600, fontSize: 13 }}>
              Explore the interactive demo →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
