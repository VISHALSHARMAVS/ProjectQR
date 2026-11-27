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
  identifier?: string;
  password?: string;
  code?: string;
}

interface OtpResponse {
  message: string;
  expiresInSeconds?: number;
  mockOtp?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_LETTER_AND_DIGIT = /^(?=.*[a-zA-Z])(?=.*\d).{10,72}$/;

export default function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' }) {
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot
  const [showPassword, setShowPassword] = useState(false);
  const [awaitingVerify, setAwaitingVerify] = useState(false);
  const [mockOtpHint, setMockOtpHint] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
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
  const isForgot = mode === 'forgot';

  if (prevMode !== mode) {
    setPrevMode(mode);
    setError('');
    setFieldErrors({});
    setSuccessMessage('');
    setAwaitingVerify(false);
    setCode('');
    setMockOtpHint('');
    setResendCooldown(0);
  }

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const loginMutation = useMutation({
    mutationFn: () =>
      api.post<StaffIdentity>('/auth/login', {
        identifier: identifier.trim(),
        password
      }),
    onSuccess: async (data) => {
      setError('');
      setFieldErrors({});
      setSuccessMessage('Signed in! Redirecting to your dashboard…');
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
      setError(cause instanceof ApiError ? cause.message : 'Could not sign in. Please try again.');
    }
  });

  const registerRequestMutation = useMutation({
    mutationFn: () =>
      api.post<OtpResponse>('/auth/register-request', {
        restaurantName: restaurantName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        password,
        website
      }),
    onSuccess: (resp) => {
      setError('');
      setFieldErrors({});
      setAwaitingVerify(true);
      setResendCooldown(60);
      setMockOtpHint(resp.mockOtp ?? '');
      if (resp.mockOtp) setCode(resp.mockOtp);
    },
    onError: (cause: Error) => {
      setError(cause instanceof ApiError ? cause.message : 'Could not send verification email. Please try again.');
    }
  });

  const registerVerifyMutation = useMutation({
    mutationFn: () =>
      api.post<StaffIdentity>('/auth/register-verify', {
        email: email.trim(),
        code: code.trim()
      }),
    onSuccess: async (data) => {
      setError('');
      setFieldErrors({});
      setSuccessMessage('Email verified & restaurant created! Redirecting…');
      if (data?.user && data?.restaurant) {
        queryClient.setQueryData(['staff', 'me'], data);
      }
      await queryClient.invalidateQueries({ queryKey: ['staff', 'me'] });
      redirectTimerRef.current = window.setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 650);
    },
    onError: (cause: Error) => {
      setError(cause instanceof ApiError ? cause.message : 'Could not verify code. Please try again.');
    }
  });

  const forgotRequestMutation = useMutation({
    mutationFn: () =>
      api.post<OtpResponse>('/auth/forgot-password', {
        identifier: identifier.trim(),
        website
      }),
    onSuccess: (resp) => {
      setError('');
      setFieldErrors({});
      setAwaitingVerify(true);
      setResendCooldown(60);
      setMockOtpHint(resp.mockOtp ?? '');
      if (resp.mockOtp) setCode(resp.mockOtp);
    },
    onError: (cause: Error) => {
      setError(cause instanceof ApiError ? cause.message : 'Could not send reset code. Please try again.');
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () =>
      api.post<{ success: boolean; message: string }>('/auth/reset-password', {
        identifier: identifier.trim(),
        code: code.trim(),
        newPassword: password
      }),
    onSuccess: (resp) => {
      setError('');
      setFieldErrors({});
      setSuccessMessage(resp.message || 'Password updated! Redirecting to sign in…');
      redirectTimerRef.current = window.setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1200);
    },
    onError: (cause: Error) => {
      setError(cause instanceof ApiError ? cause.message : 'Could not reset password. Please check the code and try again.');
    }
  });

  if (staff.data && !successMessage) return <Navigate to="/dashboard" replace />;

  const isPending =
    loginMutation.isPending ||
    registerRequestMutation.isPending ||
    registerVerifyMutation.isPending ||
    forgotRequestMutation.isPending ||
    resetPasswordMutation.isPending;

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (isRegister && !awaitingVerify) {
      if (restaurantName.trim().length < 2) next.restaurantName = 'Enter your restaurant name (at least 2 characters).';
      else if (restaurantName.trim().length > 120) next.restaurantName = 'Restaurant name must be 120 characters or fewer.';

      if (ownerName.trim().length < 2) next.ownerName = 'Enter your name (at least 2 characters).';
      else if (ownerName.trim().length > 100) next.ownerName = 'Your name must be 100 characters or fewer.';

      const trimmedEmail = email.trim();
      if (!trimmedEmail) next.email = 'Enter your email address.';
      else if (!EMAIL_REGEX.test(trimmedEmail)) next.email = 'Enter a valid email address.';

      if (!HAS_LETTER_AND_DIGIT.test(password)) {
        next.password = 'Use at least 10 characters with at least one letter and one number.';
      }
    } else if (isRegister && awaitingVerify) {
      if (!/^\d{6}$/.test(code.trim())) {
        next.code = 'Enter the 6-digit verification code sent to your email.';
      }
    } else if (isForgot && !awaitingVerify) {
      if (identifier.trim().length < 3) {
        next.identifier = 'Enter your registered email address or mobile number.';
      }
    } else if (isForgot && awaitingVerify) {
      if (!/^\d{6}$/.test(code.trim())) {
        next.code = 'Enter the 6-digit reset code.';
      }
      if (!HAS_LETTER_AND_DIGIT.test(password)) {
        next.password = 'New password must be at least 10 characters with a letter and a number.';
      }
    } else {
      if (identifier.trim().length < 3) next.identifier = 'Enter your email address or mobile number.';
      if (!password) next.password = 'Enter your password.';
    }

    return next;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || successMessage) return;
    setError('');
    const nextErrors = validate();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Please fix the highlighted fields below.');
      return;
    }

    if (isRegister) {
      if (awaitingVerify) registerVerifyMutation.mutate();
      else registerRequestMutation.mutate();
    } else if (isForgot) {
      if (awaitingVerify) resetPasswordMutation.mutate();
      else forgotRequestMutation.mutate();
    } else {
      loginMutation.mutate();
    }
  }

  const heading = isRegister
    ? awaitingVerify
      ? 'Verify your email'
      : 'Create your restaurant'
    : isForgot
      ? awaitingVerify
        ? 'Enter reset code'
        : 'Reset your password'
      : 'Welcome back';

  const subtitle = isRegister
    ? awaitingVerify
      ? `Enter the 6-digit code sent to ${email.trim()}.`
      : 'Start with a verified restaurant account, your menu, and tables.'
    : isForgot
      ? awaitingVerify
        ? `Enter the 6-digit code sent to ${identifier.trim()} and choose a new password.`
        : 'Enter your email or mobile number and we will send a 6-digit reset code.'
      : 'Sign in with your email or mobile number.';

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
          <h2>{heading}</h2>
          <p className="muted" style={{ margin: '0 0 22px', fontSize: 13 }}>
            {subtitle}
          </p>

          <form className="form-grid" noValidate onSubmit={handleSubmit}>
            {/* Invisible honeypot field for bot trapping */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              aria-hidden="true"
            />

            {isRegister && !awaitingVerify && (
              <>
                <div className="field">
                  <label htmlFor="restaurantName">Restaurant name</label>
                  <input
                    className={`input${fieldErrors.restaurantName ? ' is-invalid' : ''}`}
                    id="restaurantName"
                    required
                    minLength={2}
                    maxLength={120}
                    value={restaurantName}
                    onChange={(event) => {
                      setRestaurantName(event.target.value);
                      if (fieldErrors.restaurantName) setFieldErrors((prev) => ({ ...prev, restaurantName: undefined }));
                    }}
                    placeholder="The Green Fork"
                  />
                  {fieldErrors.restaurantName && <div className="field-error" role="alert">{fieldErrors.restaurantName}</div>}
                </div>
                <div className="field">
                  <label htmlFor="ownerName">Your name</label>
                  <input
                    className={`input${fieldErrors.ownerName ? ' is-invalid' : ''}`}
                    id="ownerName"
                    required
                    minLength={2}
                    maxLength={100}
                    value={ownerName}
                    onChange={(event) => {
                      setOwnerName(event.target.value);
                      if (fieldErrors.ownerName) setFieldErrors((prev) => ({ ...prev, ownerName: undefined }));
                    }}
                    placeholder="Aarav Sharma"
                  />
                  {fieldErrors.ownerName && <div className="field-error" role="alert">{fieldErrors.ownerName}</div>}
                </div>
                <div className="field">
                  <label htmlFor="email">Email address</label>
                  <input
                    className={`input${fieldErrors.email ? ' is-invalid' : ''}`}
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="you@restaurant.com"
                  />
                  {fieldErrors.email && <div className="field-error" role="alert">{fieldErrors.email}</div>}
                </div>
              </>
            )}

            {(!isRegister && !awaitingVerify) && (
              <div className="field">
                <label htmlFor="identifier">Email or mobile number</label>
                <input
                  className={`input${fieldErrors.identifier ? ' is-invalid' : ''}`}
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    if (fieldErrors.identifier) setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                  }}
                  placeholder="you@restaurant.com or 9876543210"
                />
                {fieldErrors.identifier && <div className="field-error" role="alert">{fieldErrors.identifier}</div>}
              </div>
            )}

            {awaitingVerify && (
              <div className="field">
                <label htmlFor="otp-code">6-digit verification code</label>
                <input
                  className={`input${fieldErrors.code ? ' is-invalid' : ''}`}
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                    if (fieldErrors.code) setFieldErrors((prev) => ({ ...prev, code: undefined }));
                  }}
                  placeholder="123456"
                  style={{ letterSpacing: 6, fontWeight: 700, textAlign: 'center', fontSize: 18 }}
                  autoFocus
                />
                {mockOtpHint && (
                  <span className="muted" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                    Dev mode OTP: <strong>{mockOtpHint}</strong>
                  </span>
                )}
                {fieldErrors.code && <div className="field-error" role="alert">{fieldErrors.code}</div>}
              </div>
            )}

            {((!awaitingVerify && !isForgot) || (isForgot && awaitingVerify)) && (
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="password">{isForgot ? 'New password' : 'Password'}</label>
                  {!isRegister && !isForgot && (
                    <Link to="/forgot-password" style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    className={`input${fieldErrors.password ? ' is-invalid' : ''}`}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isRegister || isForgot ? 'new-password' : 'current-password'}
                    required
                    minLength={isRegister || isForgot ? 10 : 1}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder={isRegister || isForgot ? '10+ chars with a letter & number' : 'Your password'}
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
                {fieldErrors.password && <div className="field-error" role="alert">{fieldErrors.password}</div>}
              </div>
            )}

            {error && <div className="form-error" role="alert">{error}</div>}
            {successMessage && <div className="notice success" role="status">{successMessage}</div>}

            <button className="btn full" type="submit" disabled={isPending || Boolean(successMessage)}>
              {isPending && <span className="btn-spinner" aria-hidden="true" />}
              {isPending
                ? 'Please wait…'
                : successMessage
                  ? 'Redirecting…'
                  : isRegister
                    ? awaitingVerify
                      ? 'Verify & create restaurant'
                      : 'Send verification code'
                    : isForgot
                      ? awaitingVerify
                        ? 'Reset password'
                        : 'Send reset code'
                      : 'Sign in'}
            </button>

            {awaitingVerify && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => {
                    setAwaitingVerify(false);
                    setCode('');
                    setError('');
                  }}
                >
                  ← Edit details
                </button>
                <button
                  type="button"
                  className="btn ghost small"
                  disabled={resendCooldown > 0 || isPending}
                  onClick={() => {
                    if (isRegister) registerRequestMutation.mutate();
                    else if (isForgot) forgotRequestMutation.mutate();
                  }}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            )}
          </form>

          <p className="muted" style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 13 }}>
            {isRegister ? 'Already set up?' : isForgot ? 'Remembered your password?' : 'New to Mesa?'}{' '}
            <Link to={isRegister || isForgot ? '/login' : '/register'} style={{ color: 'var(--green)', fontWeight: 700 }}>
              {isRegister || isForgot ? 'Sign in' : 'Create a restaurant'}
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
