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
    answer: 'No hardware purchase is required. You can print acrylic QR stands for each dining table and your staff can use any existing tablet, smartphone, or kitchen display monitor through a standard web browser.'
  },
  {
    question: 'How does the UPI auto confirmation work for busy rush hours?',
    answer: 'When guests pay with Google Pay, PhonePe, Paytm, or CRED, the payment gateway webhook verifies the transaction automatically. The order ticket updates to paid in real time with an acoustic chime so your waiters never have to inspect customer phone screens.'
  },
  {
    question: 'Can friends sitting at the same table order together or split bills?',
    answer: 'Yes. The first guest to scan becomes the table host and generates an automatic four digit table PIN. Friends who enter the PIN join the shared table cart and bill. Walk in strangers or solo diners who do not have the PIN are isolated onto their own separate bill.'
  },
  {
    question: 'Can I restrict waiters from viewing daily revenue and sales margins?',
    answer: 'Yes. The owner dashboard includes strict role permissions. Waiters only see floor map table states and punch order screens. Total daily revenue, profit numbers, and the register ledger remain completely shielded to the owner and general manager.'
  },
  {
    question: 'How does the review system help prevent negative Google reviews?',
    answer: 'When a diner completes their meal, they get a 15 second behavioral micro survey. Diners giving 5 stars are routed with one tap to your Google Maps listing. Diners giving 1 to 3 stars trigger an instant acoustic alert on the manager device so complaints are recovered table side before the guest departs.'
  },
  {
    question: 'What happens when an item runs out of stock during dinner service?',
    answer: 'Your kitchen chef or floor captain can tap the 86 toggle on any dish. It reflects immediately across customer table QR menus via real time websockets, preventing guests from ordering sold out food.'
  }
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="landing-glass-shell" style={{ color: 'var(--ink)' }}>
      {/* Ambient background glow orbs for glass depth */}
      <div className="landing-ambient-glow landing-glow-top" aria-hidden="true" />
      <div className="landing-ambient-glow landing-glow-mid" aria-hidden="true" />
      <div className="landing-ambient-glow landing-glow-bottom" aria-hidden="true" />

      {/* Floating Centered Header (SKILL.md B7 & B3) */}
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
        {/* Above the Fold: Hero Section (B5) */}
        <section className="page-wrap" style={{ paddingTop: 'clamp(40px, 6vw, 72px)', paddingBottom: 64 }}>
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', maxWidth: '100%', marginBottom: 16 }}>
              <span
                className="pill"
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  maxWidth: '100%',
                  textAlign: 'center',
                  whiteSpace: 'normal',
                  lineHeight: 1.4
                }}
              >
                Table side QR ordering and restaurant operating system
              </span>
            </div>

            <h1
              className="heading-1 hero-heading-gradient"
              style={{
                margin: '0 0 16px',
                fontSize: 'clamp(28px, 6.5vw, 56px)',
                lineHeight: 1.15,
                letterSpacing: '-0.035em',
                overflowWrap: 'break-word',
                wordBreak: 'break-word'
              }}
            >
              Turn every dining table into an instant checkout
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
              Guests scan their table QR, order together with four digit PIN protection, and auto confirm UPI payments. Your kitchen prepares tickets immediately while your staff stays focused on hospitality.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Link to="/demo" className="btn" style={{ minHeight: 44, padding: '10px 22px', fontSize: 15, fontWeight: 600 }}>
                Explore interactive demo <span aria-hidden="true">→</span>
              </Link>
              <Link to="/register" className="btn secondary" style={{ minHeight: 44, padding: '10px 20px', fontSize: 15, fontWeight: 600 }}>
                Start free trial
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
              <span style={{ color: 'var(--green)', fontSize: 14, fontWeight: 700 }}>✓</span>
              <span>Built for independent dine in restaurants, cafes and bars · Zero upfront hardware · 14 day free trial</span>
            </div>
          </div>

          {/* Hero Visual: System Preview (B5 & B3 Nested Radius with Glass Depth) */}
          <ScrollReveal delay={120}>
            <div
              className="glass-surface"
              style={{
                marginTop: 48,
                borderRadius: 20,
                padding: 16
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
                    <span className="pill green" style={{ fontSize: 11 }}>📱 Guest experience</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>Table 4 · PIN active</span>
                  </div>
                  <strong style={{ fontSize: 16, display: 'block', marginBottom: 6, color: 'var(--ink)' }}>One tap UPI auto confirm</strong>
                  <p className="muted" style={{ fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                    Guests scan, order dishes together, and pay using Google Pay or PhonePe. Payment settles automatically in seconds.
                  </p>
                  <div style={{ background: 'var(--paper)', borderRadius: 8, padding: 10, border: '1px solid var(--line)', fontSize: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--ink)' }}>
                    <span>✓ Dal Makhani, 2x Garlic Naan</span>
                    <strong style={{ color: 'var(--green)' }}>₹480 · Paid</strong>
                  </div>
                </div>

                {/* Card 2: Kitchen KDS Preparation */}
                <div className="glass-card" style={{ borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span className="pill orange" style={{ fontSize: 11 }}>🍳 Kitchen KDS</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>Ticket 104 · Cooking</span>
                  </div>
                  <strong style={{ fontSize: 16, display: 'block', marginBottom: 6, color: 'var(--ink)' }}>Real time cooking queue</strong>
                  <p className="muted" style={{ fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                    Orders appear instantly with acoustic chimes and dish notes. Chefs mark food accepted, preparing, and ready.
                  </p>
                  <div style={{ background: 'var(--paper)', borderRadius: 8, padding: 10, border: '1px solid var(--line)', fontSize: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--ink)' }}>
                    <span>Table 4 · Special note: Mild spice</span>
                    <span className="pill orange" style={{ fontSize: 11 }}>4 min in kitchen</span>
                  </div>
                </div>

                {/* Card 3: Manager Incident Recovery & Google Booster */}
                <div className="glass-card" style={{ borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span className="pill" style={{ fontSize: 11 }}>⭐ Table side recovery</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>Diner survey</span>
                  </div>
                  <strong style={{ fontSize: 16, display: 'block', marginBottom: 6, color: 'var(--ink)' }}>Google review booster</strong>
                  <p className="muted" style={{ fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                    Delighted guests are boosted straight to Google Maps. Unhappy tables trigger instant manager chimes for table side recovery.
                  </p>
                  <div style={{ background: 'var(--paper)', borderRadius: 8, padding: 10, border: '1px solid var(--line)', fontSize: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--ink)' }}>
                    <span>Table 2 rated 5 stars</span>
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>Posted to Google ✓</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* Section 2: Problem to Solution (A2 #6) */}
        <section id="workflow" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '64px 0', position: 'relative' }}>
          <div className="page-wrap">
            <ScrollReveal>
              <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', marginBottom: 40 }}>
                <span className="eyebrow" style={{ color: 'var(--orange)' }}>The dining room bottleneck</span>
                <h2 className="heading-3" style={{ margin: '8px 0 12px' }}>
                  Manual service workflows slow down busy dining rooms
                </h2>
                <p className="muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
                  Waiters spend valuable floor time printing paper bills, running card machines, and manually verifying UPI payment screens while other tables wait for service.
                </p>
              </div>
            </ScrollReveal>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <ScrollReveal delay={80}>
                <div className="glass-card comparison-card-old" style={{ borderRadius: 16, height: '100%' }}>
                  <span style={{ fontSize: 24, display: 'block', marginBottom: 12 }}>❌</span>
                  <strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>The manual paper workflow</strong>
                  <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.8 }}>
                    <li>Guests wait repeatedly for staff to bring paper menus, take orders, and deliver bills</li>
                    <li>Waiters must interrupt service to inspect customer phone screens for UPI messages</li>
                    <li>Prone to unauthorized bill voids, handwritten ticket errors, and manual tallying mistakes</li>
                    <li>Dissatisfied diners leave quietly and express their frustration in negative public reviews</li>
                  </ul>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={160}>
                <div className="glass-card comparison-card-new" style={{ borderRadius: 16, height: '100%' }}>
                  <span style={{ fontSize: 24, display: 'block', marginBottom: 12 }}>✅</span>
                  <strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>The Mesa architecture</strong>
                  <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.8 }}>
                    <li>Guests scan, browse live items, and settle the bill directly from their phone browser</li>
                    <li>Direct UPI webhook listener confirms payments automatically with real time audio chime</li>
                    <li>Role gated permissions restrict menu pricing, discount overrides, and sales ledgers</li>
                    <li>Table side micro survey flags unhappy diners for immediate on site manager resolution</li>
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

        {/* Section 3: Benefits (A2 #7 & A5) */}
        <section id="benefits" className="page-wrap" style={{ padding: '72px 0' }}>
          <ScrollReveal>
            <div style={{ maxWidth: 640, marginBottom: 44 }}>
              <span className="eyebrow" style={{ color: 'var(--green)' }}>Outcome driven results</span>
              <h2 className="heading-3" style={{ margin: '8px 0 12px' }}>
                Built for speed, accuracy, and hospitality
              </h2>
              <p className="muted" style={{ fontSize: 15, margin: 0 }}>
                Four core advantages designed specifically for busy Indian restaurants and cafes.
              </p>
            </div>
          </ScrollReveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            {[
              {
                icon: '⚡',
                title: 'Zero verification queues',
                desc: 'Guests pay with Google Pay, PhonePe, or Paytm and auto confirm without waiting for staff. Tables settle instantly as soon as diners finish their meal.'
              },
              {
                icon: '🛡️',
                title: 'Stop internal revenue leakage',
                desc: 'Owner configured power toggles ensure waiters cannot edit menu prices, void orders after taking cash, or view total daily sales numbers.'
              },
              {
                icon: '⭐',
                title: 'One tap Google review booster',
                desc: 'A short post meal psychology survey routes happy diners straight to your Google review link while alerting managers to table side issues.'
              },
              {
                icon: '🔒',
                title: 'Four digit table PIN defense',
                desc: 'Hosts share a four digit PIN with dining companions so friends share the bill while solo walk in strangers remain isolated on their own check.'
              }
            ].map((b, idx) => (
              <ScrollReveal key={idx} delay={idx * 80}>
                <div className="glass-card" style={{ padding: 22, borderRadius: 16, height: '100%' }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>{b.icon}</div>
                  <strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>{b.title}</strong>
                  <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    {b.desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Section 4: How It Works in 3 Steps (A2 #8) */}
        <section id="how-it-works" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '64px 0' }}>
          <div className="page-wrap">
            <ScrollReveal>
              <div style={{ maxWidth: 640, margin: '0 auto 40px', textAlign: 'center' }}>
                <span className="eyebrow">Simple three step flow</span>
                <h2 className="heading-3" style={{ margin: '8px 0 10px' }}>
                  How your restaurant operates with Mesa
                </h2>
              </div>
            </ScrollReveal>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {[
                {
                  step: 'Step 01',
                  title: 'Guest scans table QR stand',
                  desc: 'Diner sits at Table 4 and scans the QR stand with their smartphone camera. No app download or account creation needed.'
                },
                {
                  step: 'Step 02',
                  title: 'Select dishes and auto pay via UPI',
                  desc: 'Guests browse real time menu items, add dish notes, and pay via any UPI app. Webhook listener auto confirms payment in real time.'
                },
                {
                  step: 'Step 03',
                  title: 'Kitchen prepares and waiter serves',
                  desc: 'Kitchen display sounds an alert chime with table number and ticket items. Waiter delivers fresh food to the table.'
                }
              ].map((s, idx) => (
                <ScrollReveal key={idx} delay={idx * 100}>
                  <div className="glass-card" style={{ padding: 24, borderRadius: 16, height: '100%' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)', display: 'block', marginBottom: 8 }}>{s.step}</span>
                    <strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>{s.title}</strong>
                    <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                      {s.desc}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5: Mandatory Tagline Reveal Section (B11) */}
        <TaglineReveal />

        {/* Section 6: Core Architecture & Operational Guarantees */}
        <section style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '64px 0' }}>
          <div className="page-wrap">
            <ScrollReveal>
              <div style={{ maxWidth: 640, marginBottom: 36 }}>
                <span className="eyebrow" style={{ color: 'var(--green)' }}>Architectural integrity</span>
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
                  icon: '💳',
                  title: 'Direct UPI settlement · 0% platform fee',
                  desc: 'Guest payments route straight to your restaurant merchant UPI VPA. Mesa never acts as a middleman, holds your payouts, or deducts commission.'
                },
                {
                  icon: '⚡',
                  title: 'Zero app download or guest signup',
                  desc: 'Diners open the menu instantly in any standard mobile browser. No mandatory app installations, OTP verifications, or guest login hurdles.'
                },
                {
                  icon: '🛡️',
                  title: 'Strict multi tenant isolation',
                  desc: 'Menus, active tickets, table PIN sessions, and daily ledgers are segregated by tenant ID. Staff accounts are gated by granular role based permissions.'
                },
                {
                  icon: '🖥️',
                  title: 'Complete hardware independence',
                  desc: 'Runs on existing Android tablets, iPads, desktop PCs, kitchen monitors, and smartphones. No proprietary terminal leases or proprietary dongles required.'
                }
              ].map((g, idx) => (
                <ScrollReveal key={idx} delay={idx * 80}>
                  <div className="glass-card" style={{ padding: 24, borderRadius: 16, height: '100%' }}>
                    <div style={{ fontSize: 24, marginBottom: 12 }}>{g.icon}</div>
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

        {/* Section 7: FAQ (A2 #10, Plain Q&A for AEO) */}
        <section id="faq" className="page-wrap" style={{ padding: '72px 0', maxWidth: 760 }}>
          <ScrollReveal>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <span className="eyebrow">Frequently asked questions</span>
              <h2 className="heading-3" style={{ margin: '8px 0 10px' }}>
                Everything you need to know
              </h2>
              <p className="muted" style={{ fontSize: 14 }}>
                Clear answers on setup, security, hardware, and pricing.
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
