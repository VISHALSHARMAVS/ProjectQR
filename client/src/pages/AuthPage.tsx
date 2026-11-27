import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Brand } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { useStaff, type StaffIdentity } from '../hooks/useStaff';

interface FieldErrors {
  restaurantName?: string;
  ownerName?: string;
  email?: string;
  password?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [prevMode, setPrevMode] = useState(mode);
  const redirectTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const staff = useStaff();
  const isRegister = mode === 'register';

  if (prevMode !== mode) {
    setPrevMode(mode);
    setError('');
    setFieldErrors({});
    setSuccessMessage('');
  }

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const mutation = useMutation({
    mutationFn: async () => isRegister
      ? api.post<StaffIdentity>('/auth/register', {
          restaurantName: restaurantName.trim(),
          ownerName: ownerName.trim(),
          email: email.trim(),
          password
        })
      : api.post<StaffIdentity>('/auth/login', {
          email: email.trim(),
          password
        }),
    onSuccess: async (data) => {
      setError('');
      setFieldErrors({});
      setSuccessMessage(
        isRegister
          ? 'Restaurant account created! Redirecting to your dashboard…'
          : 'Signed in! Redirecting to your dashboard…'
      );
      if (data?.user && data?.restaurant) {
        queryClient.setQueryData(['staff', 'me'], data);
      }
      await queryClient.invalidateQueries({ queryKey: ['staff', 'me'] });
      const target = searchParams.get('next') || '/dashboard';
      redirectTimerRef.current = window.setTimeout(() => {
        navigate(target, { replace: true });
      }, 650);
    },
    onError: (cause: Error) => {
      setSuccessMessage('');
      setError(
        cause instanceof ApiError
          ? cause.message
          : isRegister
            ? 'Could not create your restaurant account. Please try again.'
            : 'Could not sign in. Please try again.'
      );
    }
  });

  if (staff.data && !successMessage) return <Navigate to="/dashboard" replace />;

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (isRegister) {
      if (restaurantName.trim().length < 2) {
        next.restaurantName = 'Enter your restaurant name (at least 2 characters).';
      } else if (restaurantName.trim().length > 120) {
        next.restaurantName = 'Restaurant name must be 120 characters or fewer.';
      }
      if (ownerName.trim().length < 2) {
        next.ownerName = 'Enter your name (at least 2 characters).';
      } else if (ownerName.trim().length > 100) {
        next.ownerName = 'Your name must be 100 characters or fewer.';
      }
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      next.email = 'Enter your email address.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      next.email = 'Enter a valid email address.';
    }
    if (!password) {
      next.password = isRegister ? 'Create a password (at least 10 characters).' : 'Enter your password.';
    } else if (isRegister && password.length < 10) {
      next.password = 'Password must be at least 10 characters.';
    }
    return next;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending || successMessage) return;
    setError('');
    const nextErrors = validate();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Please fix the highlighted fields below.');
      return;
    }
    mutation.mutate();
  }

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

          <form className="form-grid" noValidate onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <div className="field">
                  <label htmlFor="restaurantName">Restaurant name</label>
                  <input
                    className={`input${fieldErrors.restaurantName ? ' is-invalid' : ''}`}
                    id="restaurantName"
                    required
                    minLength={2}
                    maxLength={120}
                    aria-invalid={Boolean(fieldErrors.restaurantName)}
                    aria-describedby={fieldErrors.restaurantName ? 'restaurantName-error' : undefined}
                    value={restaurantName}
                    onChange={(event) => {
                      setRestaurantName(event.target.value);
                      if (fieldErrors.restaurantName) setFieldErrors((prev) => ({ ...prev, restaurantName: undefined }));
                    }}
                    placeholder="The Green Fork"
                  />
                  {fieldErrors.restaurantName && (
                    <div id="restaurantName-error" className="field-error" role="alert">
                      {fieldErrors.restaurantName}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="ownerName">Your name</label>
                  <input
                    className={`input${fieldErrors.ownerName ? ' is-invalid' : ''}`}
                    id="ownerName"
                    required
                    minLength={2}
                    maxLength={100}
                    aria-invalid={Boolean(fieldErrors.ownerName)}
                    aria-describedby={fieldErrors.ownerName ? 'ownerName-error' : undefined}
                    value={ownerName}
                    onChange={(event) => {
                      setOwnerName(event.target.value);
                      if (fieldErrors.ownerName) setFieldErrors((prev) => ({ ...prev, ownerName: undefined }));
                    }}
                    placeholder="Aarav Sharma"
                  />
                  {fieldErrors.ownerName && (
                    <div id="ownerName-error" className="field-error" role="alert">
                      {fieldErrors.ownerName}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                className={`input${fieldErrors.email ? ' is-invalid' : ''}`}
                id="email"
                type="email"
                autoComplete="email"
                required
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="you@restaurant.com"
              />
              {fieldErrors.email && (
                <div id="email-error" className="field-error" role="alert">
                  {fieldErrors.email}
                </div>
              )}
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className={`input${fieldErrors.password ? ' is-invalid' : ''}`}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  minLength={isRegister ? 10 : 1}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
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
              {fieldErrors.password && (
                <div id="password-error" className="field-error" role="alert">
                  {fieldErrors.password}
                </div>
              )}
            </div>

            {error && <div className="form-error" role="alert">{error}</div>}
            {successMessage && <div className="notice success" role="status">{successMessage}</div>}

            <button className="btn full" type="submit" disabled={mutation.isPending || Boolean(successMessage)}>
              {mutation.isPending && <span className="btn-spinner" aria-hidden="true" />}
              {mutation.isPending
                ? 'Please wait…'
                : successMessage
                  ? 'Redirecting…'
                  : isRegister
                    ? 'Create restaurant'
                    : 'Sign in'}
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
