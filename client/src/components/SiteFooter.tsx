import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand, Modal } from './ui';
import { ThemeToggle } from './ThemeToggle';
import { ScrollReveal } from './ScrollReveal';

export function SiteFooter() {
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | 'settlement' | null>(null);

  return (
    <>
      <footer className="site-footer">
        <div className="page-wrap">
          <ScrollReveal>
            {/* Top Trust Pill Strip */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 28,
              marginBottom: 36,
              borderBottom: '1px solid var(--line)'
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', maxWidth: '100%' }}>
              <span className="pill" style={{ background: 'var(--paper)', border: '1px solid var(--line)', fontSize: 12, padding: '6px 12px', whiteSpace: 'normal', lineHeight: 1.4 }}>
                💳 <strong>0% Commission</strong> · Direct UPI settlement
              </span>
              <span className="pill" style={{ background: 'var(--paper)', border: '1px solid var(--line)', fontSize: 12, padding: '6px 12px', whiteSpace: 'normal', lineHeight: 1.4 }}>
                ⚡ <strong>Zero app download</strong> · Browser native
              </span>
              <span className="pill" style={{ background: 'var(--paper)', border: '1px solid var(--line)', fontSize: 12, padding: '6px 12px', whiteSpace: 'normal', lineHeight: 1.4 }}>
                🔒 <strong>Table PIN defense</strong> · Separate bill safety
              </span>
              <span className="pill" style={{ background: 'var(--paper)', border: '1px solid var(--line)', fontSize: 12, padding: '6px 12px', whiteSpace: 'normal', lineHeight: 1.4 }}>
                📱 <strong>Hardware independent</strong> · Any phone or tablet
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              14 day unrestricted trial · Cancel anytime
            </div>
          </div>

          {/* Main Footer Grid */}
          <div className="site-footer-grid">
            {/* Column 1: Brand & Operational Identity */}
            <div className="site-footer-brand-col">
              <Link to="/" style={{ textDecoration: 'none', width: 'fit-content' }}>
                <Brand showTagline />
              </Link>
              <p className="site-footer-desc">
                Table side QR ordering, real time kitchen orchestration, and instant UPI soundbox auto settlement for independent restaurants and cafes.
              </p>
              
              {/* Live Operational Status Pulse */}
              <div className="site-footer-status" title="Direct UPI payment gateway webhook is active">
                <span className="status-dot-pulse" aria-hidden="true" />
                <span>Direct UPI settlement · Active</span>
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
                    Interactive demo
                  </Link>
                </li>
                <li>
                  <Link to="/demo" className="site-footer-link">
                    Guest QR menu and cart
                  </Link>
                </li>
                <li>
                  <Link to="/demo" className="site-footer-link">
                    Kitchen KDS queue
                  </Link>
                </li>
                <li>
                  <Link to="/demo" className="site-footer-link">
                    Dining room floor map
                  </Link>
                </li>
                <li>
                  <Link to="/demo" className="site-footer-link">
                    Four digit table PIN defense
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Hospitality Formats */}
            <div>
              <h4 className="site-footer-heading">Hospitality</h4>
              <ul className="site-footer-links">
                <li>
                  <span className="site-footer-text-item">Independent dine in</span>
                </li>
                <li>
                  <span className="site-footer-text-item">Cafes and bakeries</span>
                </li>
                <li>
                  <span className="site-footer-text-item">Bars, pubs and taprooms</span>
                </li>
                <li>
                  <span className="site-footer-text-item">High volume dining halls</span>
                </li>
                <li>
                  <span className="site-footer-text-item">QSR and counter service</span>
                </li>
              </ul>
            </div>

            {/* Column 4: Access & Guarantees */}
            <div>
              <h4 className="site-footer-heading">Get started</h4>
              <ul className="site-footer-links">
                <li>
                  <Link to="/register" className="site-footer-link highlight">
                    Start 14 day free trial →
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="site-footer-link">
                    Restaurant workspace sign in
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    className="site-footer-link"
                    onClick={() => setLegalModal('settlement')}
                  >
                    Direct settlement guarantee
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="site-footer-link"
                    onClick={() => setLegalModal('privacy')}
                  >
                    Data privacy guarantee
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Colophon Bar */}
          <div className="site-footer-bottom">
            <div>
              <span>© {new Date().getFullYear()} Mesa · The Table Operating System. Built for Indian hospitality.</span>
            </div>

            <div className="site-footer-legal-links">
              <button
                type="button"
                className="site-footer-legal-btn"
                onClick={() => setLegalModal('privacy')}
              >
                Privacy policy
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className="site-footer-legal-btn"
                onClick={() => setLegalModal('terms')}
              >
                Terms of service
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className="site-footer-legal-btn"
                onClick={() => setLegalModal('settlement')}
              >
                Zero percent commission policy
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="pill" style={{ fontSize: 11, background: 'var(--paper)', border: '1px solid var(--line)' }}>
                🇮🇳 Direct UPI (INR)
              </span>
              <ThemeToggle variant="compact" />
            </div>
          </div>
        </ScrollReveal>
      </div>
    </footer>

      {/* Privacy Policy Modal */}
      {legalModal === 'privacy' && (
        <Modal
          title="Privacy and Data Protection Policy"
          onClose={() => setLegalModal(null)}
          width={640}
        >
          <div style={{ padding: '12px 4px', fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>1. Zero Diner Data Monetization</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              Mesa never harvests, resells, or shares diner phone numbers, email addresses, or eating habits with advertisers or third party marketing brokers.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>2. Direct UPI Routing</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              Payment transactions route directly through National Payments Corporation of India approved UPI channels including Google Pay, PhonePe, Paytm, and CRED directly into the restaurant merchant VPA. We never store debit or credit card details.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>3. Multi Tenant Cryptographic Isolation</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              All restaurant data including menus, customer cart sessions, kitchen tickets, staff profiles, and sales records is strictly partitioned by restaurant ID to prevent unauthorized data crossover.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>4. Data Ownership and Deletion</h4>
            <p className="muted" style={{ margin: 0 }}>
              Restaurants own 100 percent of their operational data. You can export or request complete purging of your account records at any time.
            </p>
          </div>
        </Modal>
      )}

      {/* Terms of Service Modal */}
      {legalModal === 'terms' && (
        <Modal
          title="Terms of Service and Usage"
          onClose={() => setLegalModal(null)}
          width={640}
        >
          <div style={{ padding: '12px 4px', fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>1. Hospitality Platform Scope</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              Mesa delivers cloud based digital QR ordering, real time kitchen display screens, table PIN defense, and payment verification tools for dine in restaurants, cafes, and taprooms.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>2. Zero Platform Transaction Commission</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              Mesa charges zero percent transaction fees on orders. 100 percent of the funds settled by diners arrive directly in the restaurant designated bank account.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>3. 14 Day Free Evaluation</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              New restaurant accounts receive a 14 day fully featured trial. No credit card is required to begin. Accounts can be discontinued at any time without exit fees or penalties.
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
              When a guest scans and pays at Table 4, the UPI transfer is credited directly into your restaurant merchant account via your existing bank VPA. Mesa is not an escrow holder and never holds your funds.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>2. No Payout Cycle Delays</h4>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              Unlike food delivery aggregators that retain restaurant revenues for 7 to 14 days, your money arrives immediately on every completed transaction.
            </p>

            <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>3. Real Time Webhook Verification</h4>
            <p className="muted" style={{ margin: 0 }}>
              Our webhook listener instantly verifies receipt of funds, sounds an acoustic chime on your kitchen screen, and marks the table order as paid in real time.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
