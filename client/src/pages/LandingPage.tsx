import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { ProductShowcase } from '../components/ProductShowcase';
import { TaglineReveal } from '../components/TaglineReveal';
import { SiteFooter } from '../components/SiteFooter';
import { ScrollReveal } from '../components/ScrollReveal';

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: 'Does our restaurant need expensive POS hardware to use Mesa?',
    answer: 'No hardware purchase is required. You can print QR stands for each dining table and your staff can use any existing tablet, smartphone, or kitchen display monitor through a standard web browser.'
  },
  {
    question: 'How does direct UPI settlement work for busy rush hours?',
    answer: 'Guest payments route directly to your restaurant merchant UPI VPA with zero platform commission. Transactions are verified in real time, and tickets automatically update to paid status with an acoustic chime so your team never has to inspect customer phone screens.'
  },
  {
    question: 'Can friends sitting at the same table order together or split bills?',
    answer: 'Yes. The first guest to scan generates a four-digit table PIN. Companions who enter the PIN join the shared table cart and bill. Walk-in guests or separate parties who do not have the PIN remain securely isolated on their own separate tab.'
  },
  {
    question: 'Can I restrict staff from viewing daily revenue and sales margins?',
    answer: 'Yes. The owner dashboard includes strict role-based permissions. Floor staff and runners only see table statuses and punch orders. Total daily sales, gross margins, and business ledgers are restricted exclusively to owners and managers.'
  },
  {
    question: 'How does table-side guest feedback work?',
    answer: 'At the end of their meal, guests can share immediate dining feedback on their dishes and service. If a guest notes an issue, an instant alert notifies the manager to resolve it table-side before departure. Diners can also easily view your Google Maps listing to share their experience.'
  },
  {
    question: 'What happens when an item runs out of stock during dinner service?',
    answer: 'Your kitchen chef or floor captain can tap the out-of-stock toggle on any dish. It reflects immediately across customer table QR menus via real-time websockets, preventing guests from ordering sold-out items.'
  }
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="landing-glass-shell" style={{ color: 'var(--ink)' }}>
      {/* Floating Header */}
      <header className="landing-floating-header">
        <nav className="landing-floating-nav" aria-label="Main navigation">
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            <Brand />
          </Link>
          <div className="landing-nav-links">
            <Link to="/demo" className="landing-nav-link">
              Live demo
            </Link>
            <a href="#workflow" className="landing-nav-link">
              Workflow
            </a>
            <a href="#showcase" className="landing-nav-link">
              Showcase
            </a>
            <a href="#benefits" className="landing-nav-link">
              Benefits
            </a>
            <a href="#how-it-works" className="landing-nav-link">
              How it works
            </a>
            <a href="#faq" className="landing-nav-link">
              FAQ
            </a>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <ThemeToggle variant="compact" />
            <Link className="btn secondary small landing-header-signin" to="/login">
              Sign in
            </Link>
            <Link className="btn small" to="/register" style={{ whiteSpace: 'nowrap' }}>
              <span className="desktop-only-text">Start free trial</span>
              <span className="mobile-only-text">Try free</span>
            </Link>
          </div>
        </nav>
      </header>

      <main id="main-content" style={{ position: 'relative', zIndex: 1 }}>
        {/* Above the Fold: Hero Section */}
        <section className="page-wrap" style={{ paddingTop: 'clamp(40px, 6vw, 72px)', paddingBottom: 64 }}>
          <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <span
                className="pill green"
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.4
                }}
              >
                Restaurant Operating System
              </span>
            </div>

            <h1
              className="heading-1 hero-heading-gradient"
              style={{
                margin: '0 0 16px',
                fontSize: 'clamp(32px, 6vw, 54px)',
                lineHeight: 1.15,
                letterSpacing: '-0.035em',
                overflowWrap: 'break-word',
                wordBreak: 'break-word'
              }}
            >
              The table operating system for independent restaurants
            </h1>

            <p
              className="body-2"
              style={{
                maxWidth: 620,
                margin: '0 auto 28px',
                fontSize: 16,
                lineHeight: 1.6,
                color: 'var(--muted)'
              }}
            >
              Guests scan their table QR, order together with 4-digit PIN protection, and pay directly via UPI. Orders route instantly to kitchen displays—zero app downloads, 0% platform commission, and no proprietary hardware.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Link to="/demo" className="btn" style={{ minHeight: 44, padding: '10px 22px', fontSize: 15, fontWeight: 600 }}>
                Explore interactive demo <span aria-hidden="true">→</span>
              </Link>
              <Link to="/register" className="btn secondary" style={{ minHeight: 44, padding: '10px 20px', fontSize: 15, fontWeight: 600 }}>
                Start 14-day free trial
              </Link>
            </div>

            {/* Proof Signal */}
            <div
              style={{
                marginTop: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 13,
                color: 'var(--muted)',
                flexWrap: 'wrap',
                maxWidth: '100%',
                lineHeight: 1.5,
                textAlign: 'center'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Designed for dine-in restaurants, cafes, and bars · Zero proprietary hardware · 14-day free trial</span>
            </div>
          </div>

          {/* Hero Visual: Connected Operational System Preview */}
          <ScrollReveal delay={120}>
            <div
              className="glass-surface"
              style={{
                marginTop: 48,
                borderRadius: 20,
                padding: 18
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 16,
                  padding: 4
                }}
              >
                {/* Card 1: Guest Table Screen */}
                <div className="glass-card" style={{ borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span className="pill green" style={{ fontSize: 11, fontWeight: 600 }}>Guest Experience</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>Table 4 · PIN Active</span>
                  </div>
                  <strong style={{ fontSize: 15, display: 'block', marginBottom: 6, color: 'var(--ink)' }}>Table QR & Direct UPI</strong>
                  <p className="muted" style={{ fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                    Guests scan the table QR code, browse live dishes, and pay directly via any UPI app with instant settlement.
                  </p>
                  <div style={{ background: 'var(--paper-elevated)', borderRadius: 8, padding: 10, border: '1px solid var(--line)', fontSize: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--ink)' }}>
                    <span>Dal Makhani, 2x Garlic Naan</span>
                    <strong style={{ color: 'var(--green)' }}>₹480 · Paid</strong>
                  </div>
                </div>

                {/* Card 2: Kitchen KDS Preparation */}
                <div className="glass-card" style={{ borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span className="pill orange" style={{ fontSize: 11, fontWeight: 600 }}>Kitchen Display</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--orange)' }}>Ticket 104 · Cooking</span>
                  </div>
                  <strong style={{ fontSize: 15, display: 'block', marginBottom: 6, color: 'var(--ink)' }}>Live Preparation Queue</strong>
                  <p className="muted" style={{ fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                    Orders appear immediately on kitchen screens with audio cues, customer notes, and prep timers.
                  </p>
                  <div style={{ background: 'var(--paper-elevated)', borderRadius: 8, padding: 10, border: '1px solid var(--line)', fontSize: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--ink)' }}>
                    <span>Table 4 · Note: Mild spice</span>
                    <span className="pill orange" style={{ fontSize: 11 }}>4m in prep</span>
                  </div>
                </div>

                {/* Card 3: Dining Room Floor Control */}
                <div className="glass-card" style={{ borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span className="pill" style={{ fontSize: 11, fontWeight: 600 }}>Floor Control</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>8 Tables Active</span>
                  </div>
                  <strong style={{ fontSize: 15, display: 'block', marginBottom: 6, color: 'var(--ink)' }}>Table Turnover & Monitoring</strong>
                  <p className="muted" style={{ fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                    Track dining room capacity, occupied tables, and active bills in real time while sales data stays protected.
                  </p>
                  <div style={{ background: 'var(--paper-elevated)', borderRadius: 8, padding: 10, border: '1px solid var(--line)', fontSize: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--ink)' }}>
                    <span>Dining Room Status</span>
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>6 of 8 Occupied</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* Section 2: Problem to Solution */}
        <section id="workflow" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '64px 0', position: 'relative' }}>
          <div className="page-wrap">
            <ScrollReveal>
              <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', marginBottom: 40 }}>
                <span className="pill" style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, display: 'inline-block' }}>Operational Challenges</span>
                <h2 className="heading-3" style={{ margin: '8px 0 12px' }}>
                  Operational bottlenecks that slow down dining rooms
                </h2>
                <p className="muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
                  Manual order-taking, paper ticket delays, and payment confusion create friction for guests and staff during peak dining hours.
                </p>
              </div>
            </ScrollReveal>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <ScrollReveal delay={80}>
                <div className="comparison-card-old" style={{ height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span className="pill" style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)', borderColor: 'var(--red)' }}>Traditional Operations</span>
                  </div>
                  <strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>The manual paper workflow</strong>
                  <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.8 }}>
                    <li>Guests wait repeatedly for staff to bring physical menus, write orders, and split checks</li>
                    <li>Waiters interrupt service to manually inspect customer phone screens for UPI confirmations</li>
                    <li>Handwritten tickets are vulnerable to kitchen misplacement, illegible notes, and delay</li>
                    <li>Disappointed diners leave quietly without staff ever knowing about a dining room issue</li>
                  </ul>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={160}>
                <div className="comparison-card-new" style={{ height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span className="pill green" style={{ fontSize: 11, fontWeight: 600 }}>Mesa Workflow</span>
                  </div>
                  <strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>The connected table system</strong>
                  <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.8 }}>
                    <li>Guests scan their table QR code, browse live dish availability, and place orders directly</li>
                    <li>Direct UPI settlement verifies payments automatically with acoustic alerts and instant receipts</li>
                    <li>Kitchen display screens organize prep queues by station with accurate order timers</li>
                    <li>Table-side dining feedback alerts floor managers to guest concerns before diners depart</li>
                  </ul>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Section: Live Product Showcase */}
        <section id="showcase">
          <ProductShowcase />
        </section>

        {/* Section 3: Benefits */}
        <section id="benefits" className="page-wrap" style={{ padding: '72px 0' }}>
          <ScrollReveal>
            <div style={{ maxWidth: 640, marginBottom: 44 }}>
              <span className="pill green" style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, display: 'inline-block' }}>Operational Benefits</span>
              <h2 className="heading-3" style={{ margin: '8px 0 12px' }}>
                Engineered for speed, accuracy, and dining room control
              </h2>
              <p className="muted" style={{ fontSize: 15, margin: 0 }}>
                Four operational advantages designed specifically for busy dine-in restaurants, cafes, and bars.
              </p>
            </div>
          </ScrollReveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            {[
              {
                title: 'Direct UPI settlement',
                desc: 'Guests pay instantly with Google Pay, PhonePe, or Paytm with immediate verification. Funds route directly to your merchant account with zero platform commission.'
              },
              {
                title: 'Role-gated security',
                desc: 'Control staff privileges so floor servers cannot alter menu prices, void orders after accepting cash, or view total daily sales numbers.'
              },
              {
                title: 'Table-side guest feedback',
                desc: 'Diners can leave immediate dish and service feedback before leaving, alerting managers to table-side concerns while providing easy access to your Google Maps listing.'
              },
              {
                title: 'Four-digit table PIN defense',
                desc: 'The host generates a 4-digit PIN so dining companions share the table cart, while walk-in strangers and separate parties remain on their own independent bill.'
              }
            ].map((b, idx) => (
              <ScrollReveal key={idx} delay={idx * 80}>
                <div className="glass-card" style={{ padding: 22, borderRadius: 16, height: '100%' }}>
                  <strong style={{ fontSize: 15, display: 'block', marginBottom: 8, color: 'var(--ink)' }}>{b.title}</strong>
                  <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    {b.desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Section 4: How It Works */}
        <section id="how-it-works" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '64px 0' }}>
          <div className="page-wrap">
            <ScrollReveal>
              <div style={{ maxWidth: 640, margin: '0 auto 40px', textAlign: 'center' }}>
                <span className="pill" style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, display: 'inline-block' }}>System Flow</span>
                <h2 className="heading-3" style={{ margin: '8px 0 10px' }}>
                  How Mesa operates during dinner service
                </h2>
                <p className="muted" style={{ fontSize: 15, margin: 0 }}>
                  A connected workflow from table scan to kitchen preparation and final settlement.
                </p>
              </div>
            </ScrollReveal>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {[
                {
                  title: 'Print & place table QR stands',
                  desc: 'Generate durable QR stands for each dining table. No proprietary terminals or table hardware required.'
                },
                {
                  title: 'Guests scan, join PIN & order',
                  desc: 'Diners open the menu in any mobile browser, join the shared table tab with a 4-digit PIN, and place items with custom notes.'
                },
                {
                  title: 'Kitchen prepares via live KDS',
                  desc: 'Incoming tickets chime on kitchen screens, displaying table number, preparation timer, and specific item instructions.'
                },
                {
                  title: 'Direct settlement & floor turnover',
                  desc: 'Guests settle directly via UPI with zero commission. Waiters serve fresh food and managers track turnover on any screen.'
                }
              ].map((s, idx) => (
                <ScrollReveal key={idx} delay={idx * 80}>
                  <div className="glass-card" style={{ padding: 22, borderRadius: 16, height: '100%' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Phase {idx + 1}
                    </div>
                    <strong style={{ fontSize: 15, display: 'block', marginBottom: 8, color: 'var(--ink)' }}>{s.title}</strong>
                    <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                      {s.desc}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5: Mandatory Tagline Reveal Section */}
        <TaglineReveal />

        {/* Section 6: Core Architecture & Operational Guarantees */}
        <section style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '64px 0' }}>
          <div className="page-wrap">
            <ScrollReveal>
              <div style={{ maxWidth: 640, marginBottom: 36 }}>
                <span className="pill green" style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, display: 'inline-block' }}>Platform Standards</span>
                <h2 className="heading-3" style={{ margin: '8px 0 10px' }}>
                  Core guarantees built into the system
                </h2>
                <p className="muted" style={{ fontSize: 15, margin: 0 }}>
                  Every component is engineered around restaurant privacy, operational reliability, and transparent financial settlement.
                </p>
              </div>
            </ScrollReveal>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {[
                {
                  title: 'Direct UPI settlement · 0% platform fee',
                  desc: 'Guest payments route straight to your restaurant merchant UPI VPA. Mesa never acts as an intermediary, holds your payouts, or deducts transaction fees.'
                },
                {
                  title: 'Zero app download or guest signup',
                  desc: 'Diners open the menu instantly in any standard mobile browser. No mandatory app installations, OTP verifications, or guest login hurdles.'
                },
                {
                  title: 'Strict multi-tenant data isolation',
                  desc: 'Menus, active tickets, table PIN sessions, and daily ledgers are segregated by tenant ID. Staff accounts are gated by granular role-based permissions.'
                },
                {
                  title: 'Complete hardware independence',
                  desc: 'Runs on existing Android tablets, iPads, desktop PCs, kitchen monitors, and smartphones. No proprietary terminal leases or proprietary dongles required.'
                }
              ].map((g, idx) => (
                <ScrollReveal key={idx} delay={idx * 80}>
                  <div className="glass-card" style={{ padding: 24, borderRadius: 16, height: '100%' }}>
                    <strong style={{ fontSize: 15, display: 'block', marginBottom: 6, color: 'var(--ink)' }}>{g.title}</strong>
                    <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                      {g.desc}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Section 7: FAQ (Plain Q&A for AEO) */}
        <section id="faq" className="page-wrap" style={{ padding: '72px 0', maxWidth: 760 }}>
          <ScrollReveal>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <span className="pill" style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, display: 'inline-block' }}>Answers</span>
              <h2 className="heading-3" style={{ margin: '8px 0 10px' }}>
                Frequently asked questions
              </h2>
              <p className="muted" style={{ fontSize: 14 }}>
                Clear answers on setup, security, hardware, and operations.
              </p>
            </div>
          </ScrollReveal>

          <div style={{ display: 'grid', gap: 12 }}>
            {faqs.map((faq, idx) => (
              <ScrollReveal key={idx} delay={idx * 50}>
                <div
                  className="glass-card"
                  style={{
                    borderRadius: 14,
                    padding: '16px 20px',
                    cursor: 'pointer',
                    border: openFaq === idx ? '1px solid var(--green)' : '1px solid var(--line)'
                  }}
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 15, color: 'var(--ink)' }}>{faq.question}</strong>
                    <span style={{ fontSize: 16, color: 'var(--muted)' }}>{openFaq === idx ? '−' : '+'}</span>
                  </div>
                  {openFaq === idx && (
                    <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--muted)' }}>
                      {faq.answer}
                    </p>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Section 8: Risk Reversal & Final CTA (A2 #11 & #12) — Floating Glass Showcase Card */}
        <section className="page-wrap" style={{ padding: '40px 0 64px' }}>
          <ScrollReveal>
            <div className="landing-cta-glass-card">
              <h2
                className="heading-2"
                style={{
                  color: '#ffffff',
                  margin: '0 0 14px',
                  fontSize: 'clamp(28px, 4.5vw, 42px)',
                  letterSpacing: '-0.03em'
                }}
              >
                Start serving faster tables today
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 16, lineHeight: 1.6, margin: '0 auto 28px', maxWidth: 540 }}>
                Turn your dining tables into seamless checkouts in under 10 minutes. No specialized hardware required.
              </p>
              <div className="landing-cta-actions" style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Link
                  to="/demo"
                  className="btn"
                  style={{
                    background: '#ffffff',
                    color: '#12372c',
                    minHeight: 46,
                    padding: '10px 24px',
                    fontSize: 15,
                    fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)'
                  }}
                >
                  Explore interactive demo <span aria-hidden="true">→</span>
                </Link>
                <Link
                  to="/register"
                  className="btn secondary"
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    borderColor: 'rgba(255, 255, 255, 0.4)',
                    color: '#ffffff',
                    minHeight: 46,
                    padding: '10px 24px',
                    fontSize: 15,
                    fontWeight: 600,
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  Start 14 day free trial
                </Link>
              </div>
              <div style={{ marginTop: 22, fontSize: 13, color: '#86efac', fontWeight: 500, maxWidth: '100%', lineHeight: 1.5 }}>
                No credit card required · Free 14 day trial · Cancel anytime
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      {/* Semantic Site Footer with Glass Depth & Trust Strip */}
      <SiteFooter />
    </div>
  );
}
