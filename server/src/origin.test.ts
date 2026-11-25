import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from './app.js';
import { resolvePublicAppUrl } from './routes/restaurant.js';

describe('isAllowedOrigin policy', () => {
  it('allows requests without origin header (mobile apps, server-to-server, curl)', () => {
    expect(isAllowedOrigin(undefined, 'trymesa.onrender.com')).toBe(true);
  });

  it('allows same-origin requests where origin host matches server host', () => {
    expect(isAllowedOrigin('https://trymesa.onrender.com', 'trymesa.onrender.com')).toBe(true);
    expect(isAllowedOrigin('http://custom-domain.com:3000', 'custom-domain.com:3000')).toBe(true);
  });

  it('allows official onrender domains for trymesa and projectqr', () => {
    expect(isAllowedOrigin('https://trymesa.onrender.com', 'api.trymesa.com')).toBe(true);
    expect(isAllowedOrigin('https://projectqr-preview.onrender.com', 'trymesa.onrender.com')).toBe(true);
    expect(isAllowedOrigin('https://mesa-preview.onrender.com', 'trymesa.onrender.com')).toBe(true);
    expect(isAllowedOrigin('https://mesa-live.onrender.com', 'trymesa.onrender.com')).toBe(true);
  });

  it('blocks untrusted third party origins when not matching server host', () => {
    expect(isAllowedOrigin('https://evil-phishing.com', 'trymesa.onrender.com')).toBe(false);
    expect(isAllowedOrigin('https://randomservice.onrender.com', 'trymesa.onrender.com')).toBe(false);
  });
});

describe('resolvePublicAppUrl', () => {
  it('resolves trymesa host correctly', () => {
    const mockReq = {
      get: (header: string) => header === 'host' ? 'trymesa.onrender.com' : undefined,
      secure: true
    } as any;
    expect(resolvePublicAppUrl(mockReq)).toBe('https://trymesa.onrender.com');
  });

  it('maps legacy projectqr-preview host to trymesa', () => {
    const mockReq = {
      get: (header: string) => header === 'host' ? 'projectqr-preview.onrender.com' : undefined,
      secure: true
    } as any;
    expect(resolvePublicAppUrl(mockReq)).toBe('https://trymesa.onrender.com');
  });
});
