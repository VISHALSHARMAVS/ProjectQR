import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand, Modal } from './ui';
import { ThemeToggle } from './ThemeToggle';

export function SiteFooter() {
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | 'settlement' | null>(null);

  return (
    <>
      <footer className="site-footer">
        <div className="page-wrap">
          {/* Main Footer Grid */}
          <div className="site-footer-grid">
            {/* Column 1: Brand & Operational Identity */}
            <div className="site-footer-brand-col">
              <Link to="/" style={{ textDecoration: 'none', width: 'fit-content' }}>
                <Brand />
              </Link>
              <p className="site-footer-desc">
                Table-side QR ordering, real-time kitchen orchestration, and instant UPI soundbox auto-settlement for independent restaurants and cafés.
              </p>
              
              {/* Live Operational Status Pulse */}
              <div className="site-footer-status" title="Direct UPI payment gateway webhook is active">
                <span className="status-dot-pulse" aria-hidden="true" />
                <span>Direct UPI Settlement · Active</span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Runs in any mobile browser · Zero proprietary hardware required
              </div>
            </div>

            {/* Column 2: Platform Capabilities */}
            <div>
              <h4 className="site-footer-heading">Platform</h4>
              <ul className="site-footer-links">
                <li>
                  <Link to="/demo" className="site-footer-link">
                    Interactive Demo
                  </Link>
                </li>
                <li>
                  <Link to="/demo" className="site-footer-link">
                    Guest QR Menu & Cart
                  </Link>
                </li>
                <li>
                  <Link to="/demo" className="site-footer-link">
                    Kitchen KDS Queue
                  </Link>
                </li>
                <li>
                  <Link to="/demo" className="site-footer-link">
                    Dining Room Floor Map
                  </Link>
                </li>
                <li>
                  <Link to="/demo" className="site-footer-link">
                    4-Digit Table PIN Defense
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Hospitality Formats */}
            <div>
              <h4 className="site-footer-heading">Hospitality</h4>
              <ul className="site-footer-links">
                <li>
                  <span className="site-footer-text-item">Independent Dine-In</span>
                </li>
                <li>
                  <span className="site-footer-text-item">Cafés & Bakeries</span>
                </li>
                <li>
                  <span className="site-footer-text-item">Bars, Pubs & Taprooms</span>
                </li>
                <li>
                  <span className="site-footer-text-item">High-Volume Dining Halls</span>
                </li>
                <li>
                  <span className="site-footer-text-item">QSR & Counter Service</span>
                </li>
              </ul>
            </div>

            {/* Column 4: Access & Guarantees */}
            <div>
              <h4 className="site-footer-heading">Get Started</h4>
              <ul className="site-footer-links">
                <li>
                  <Link to="/register" className="site-footer-link highlight">
                    Start 14-Day Free Trial →
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="site-footer-link">
                    Restaurant Workspace Sign In
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    className="site-footer-link"
                    onClick={() => setLegalModal('settlement')}
                  >
                    Direct Settlement Guarantee
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="site-footer-link"
                    onClick={() => setLegalModal('privacy')}
                  >
                    Data Privacy Guarantee
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Colophon Bar */}
          <div className="site-footer-bottom">
            <div>
              <span>© {new Date().getFullYear()} ProjectQR. Built for Indian hospitality.</span>
            </div>

            <div className="site-footer-legal-links">
              <button
                type="button"
                className="site-footer-legal-btn"
                onClick={() => setLegalModal('privacy')}
              >
                Privacy Policy
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className="site-footer-legal-btn"
                onClick={() => setLegalModal('terms')}
              >
                Terms of Service
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className="site-footer-legal-btn"
                onClick={() => setLegalModal('settlement')}
              >
                0% Commission Policy
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="pill" style={{ fontSize: 11, background: 'var(--paper)', border: '1px solid var(--line)' }}>
                🇮🇳 Direct UPI (INR)
              </span>
              <ThemeToggle variant="compact" />
            </div>
          </div>
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      {legalModal === 'privacy' && (
        <Modal
          title="Privacy & Data Protection Policy"
          onClose={() => setLegalModal(null)}
          width={640}
        >
          <div style={{ padding: '12px 4px', fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>1. Zero Diner Data Monetization</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              ProjectQR never harvests, resells, or shares diner phone numbers, email addresses, or eating habits with advertisers or third-party marketing brokers.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>2. Direct UPI Routing</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              Payment transactions route directly through National Payments Corporation of India (NPCI) approved UPI channels (Google Pay, PhonePe, Paytm, CRED) directly into the restaurant's merchant VPA. We never store debit or credit card details.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>3. Multi-Tenant Cryptographic Isolation</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              All restaurant data—including menus, customer cart sessions, kitchen tickets, staff profiles, and sales records—is strictly partitioned by restaurant ID to prevent unauthorized data crossover.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>4. Data Ownership & Deletion</h4>
            <p className="muted" style={{ margin: 0 }}>
              Restaurants own 100% of their operational data. You can export or request complete purging of your account records at any time.
            </p>
          </div>
        </Modal>
      )}

      {/* Terms of Service Modal */}
      {legalModal === 'terms' && (
        <Modal
          title="Terms of Service & Usage"
          onClose={() => setLegalModal(null)}
          width={640}
        >
          <div style={{ padding: '12px 4px', fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>1. Hospitality Platform Scope</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              ProjectQR delivers cloud-based digital QR ordering, real-time kitchen display screens (KDS), table PIN defense, and payment verification tools for dine-in restaurants, cafés, and taprooms.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>2. Zero Platform Transaction Commission</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              ProjectQR charges zero percent (0%) transaction fees on orders. 100% of the funds settled by diners arrive directly in the restaurant's designated bank account.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>3. 14-Day Free Evaluation</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              New restaurant accounts receive a 14-day fully featured trial. No credit card is required to begin. Accounts can be discontinued at any time without exit fees or penalties.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>4. Hardware Independence</h4>
            <p className="muted" style={{ margin: 0 }}>
              The software operates on standard modern web browsers on Android, iOS, Windows, and macOS devices. Restaurants are not locked into proprietary terminal leases.
            </p>
          </div>
        </Modal>
      )}

      {/* Settlement Guarantee Modal */}
      {legalModal === 'settlement' && (
        <Modal
          title="Direct UPI Settlement Guarantee"
          onClose={() => setLegalModal(null)}
          width={640}
        >
          <div style={{ padding: '12px 4px', fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>1. Instant Direct Payouts</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              When a guest scans and pays at Table 4, the UPI transfer is credited directly into your restaurant's merchant account via your existing bank VPA. ProjectQR is not an escrow holder and never holds your funds.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>2. No Payout Cycle Delays</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              Unlike food delivery aggregators that retain restaurant revenues for 7 to 14 days, your money arrives immediately on every completed transaction.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>3. Real-Time Webhook Verification</h4>
            <p className="muted" style={{ margin: 0 }}>
              Our webhook listener instantly verifies receipt of funds, sounds an acoustic chime on your kitchen screen, and marks the table order as paid in real time.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
