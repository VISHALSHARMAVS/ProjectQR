import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { ProductShowcase } from '../components/ProductShowcase';
import { TaglineReveal } from '../components/TaglineReveal';

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: 'Does our restaurant need expensive POS hardware to use ProjectQR?',
    answer: 'No hardware purchase is required. You can print acrylic QR stands for each dining table and your staff can use any existing tablet, smartphone, or kitchen display monitor through a standard web browser.'
  },
  {
    question: 'How does the UPI auto confirmation work for busy rush hours?',
    answer: 'When guests pay with Google Pay, PhonePe, Paytm, or CRED, the payment gateway webhook verifies the transaction in milliseconds. The order ticket automatically updates to paid with a joyful register chime so your waiters never have to inspect customer phone screens.'
  },
  {
    question: 'Can friends sitting at the same table order together or split bills?',
    answer: 'Yes. The first guest to scan becomes the table host and generates an automatic 4 digit table PIN. Friends who enter the PIN join the shared table cart and bill. Walk in strangers or solo diners who do not have the PIN are isolated onto their own separate bill.'
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
    answer: 'Your kitchen chef or floor captain can tap the 86 toggle on any dish. It reflects across all customer table QR menus within 50 milliseconds via real time web sockets, preventing guests from ordering sold out food.'
  }
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="app-shell" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* Top Floating Navigation */}
      <AppHeader
        action={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <ThemeToggle variant="compact" />
            <Link className="btn secondary small" to="/demo">
              Live demo
            </Link>
            <Link className="btn secondary small" to="/login">
              Sign in
            </Link>
            <Link className="btn small" to="/register">
              Start free trial
            </Link>
          </div>
        }
      />

      <main>
        {/* Above the Fold: Hero Section (B5) */}
        <section className="page-wrap" style={{ paddingTop: 'clamp(48px, 8vw, 84px)', paddingBottom: 64 }}>
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', marginBottom: 16 }}>
              <span
                className="pill"
                style={{
                  background: 'var(--soft-green)',
                  color: 'var(--green-dark)',
                  border: '1px solid var(--line)',
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                Table side QR ordering and restaurant operating system
              </span>
            </div>

            <h1
              className="heading-1 hero-heading-gradient"
              style={{
                margin: '0 0 16px',
                fontSize: 'clamp(36px, 6vw, 56px)',
                lineHeight: 1.05,
                letterSpacing: '-0.035em'
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
              Guests scan their table QR, order together with 4 digit PIN protection, and auto confirm UPI payments. Your kitchen prepares tickets immediately while your staff stays focused on hospitality.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Link to="/demo" className="btn" style={{ minHeight: 44, padding: '10px 22px', fontSize: 15 }}>
                Explore interactive demo <span aria-hidden="true">→</span>
              </Link>
              <Link to="/register" className="btn secondary" style={{ minHeight: 44, padding: '10px 20px', fontSize: 15 }}>
                Start free trial
              </Link>
            </div>

            {/* Proof Signal (A2 #4) */}
            <div style={{ marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
              <span style={{ color: '#f59e0b', fontSize: 14 }}>★★★★★</span>
              <span>Designed for independent dine-in restaurants, cafes & bars · Zero upfront hardware · 14-day free trial</span>
            </div>
          </div>

          {/* Hero Visual: System Preview (B5 Layout) */}
          <div
            className="surface"
            style={{
              marginTop: 48,
              borderRadius: 20,
              padding: 16,
              background: 'var(--paper)',
              boxShadow: 'var(--shadow)',
              border: '1px solid var(--line)'
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 16,
                padding: 12
              }}
            >
              {/* Card 1: Guest Table Screen */}
              <div style={{ background: 'var(--paper-elevated)', borderRadius: 14, padding: 18, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="pill green" style={{ fontSize: 11 }}>📱 Guest Experience</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>Table 4 · PIN Active</span>
                </div>
                <strong style={{ fontSize: 16, display: 'block', marginBottom: 6, color: 'var(--ink)' }}>1 Tap UPI Auto Confirm</strong>
                <p className="muted" style={{ fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                  Guests scan, order dishes together, and pay using Google Pay or PhonePe. Payment settles automatically in seconds.
                </p>
                <div style={{ background: 'var(--paper)', borderRadius: 10, padding: 10, border: '1px solid var(--line)', fontSize: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--ink)' }}>
                  <span>✓ Dal Makhani, 2x Garlic Naan</span>
                  <strong style={{ color: 'var(--green)' }}>₹480 · Paid</strong>
                </div>
              </div>

              {/* Card 2: Kitchen KDS Preparation */}
              <div style={{ background: 'var(--paper-elevated)', borderRadius: 14, padding: 18, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="pill orange" style={{ fontSize: 11 }}>🍳 Kitchen KDS</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>Ticket #104 · Cooking</span>
                </div>
                <strong style={{ fontSize: 16, display: 'block', marginBottom: 6, color: 'var(--ink)' }}>Real Time Cooking Queue</strong>
                <p className="muted" style={{ fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                  Orders appear instantly with acoustic chimes and dish notes. Chefs mark food accepted, preparing, and ready.
                </p>
                <div style={{ background: 'var(--paper)', borderRadius: 10, padding: 10, border: '1px solid var(--line)', fontSize: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--ink)' }}>
                  <span>Table 4 · Special Note: Mild spice</span>
                  <span className="pill orange" style={{ fontSize: 11 }}>4 min in kitchen</span>
                </div>
              </div>

              {/* Card 3: Manager Incident Recovery & Google Booster */}
              <div style={{ background: 'var(--paper-elevated)', borderRadius: 14, padding: 18, border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="pill" style={{ fontSize: 11 }}>⭐ Table Side Recovery</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>Psychology Survey</span>
                </div>
                <strong style={{ fontSize: 16, display: 'block', marginBottom: 6, color: 'var(--ink)' }}>Google 5 Star Booster</strong>
                <p className="muted" style={{ fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
                  Delighted guests are boosted straight to Google Maps. Unhappy tables trigger instant manager chimes for table side recovery.
                </p>
                <div style={{ background: 'var(--paper)', borderRadius: 10, padding: 10, border: '1px solid var(--line)', fontSize: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--ink)' }}>
                  <span>Table 2 rated 5 stars</span>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>Posted to Google ✓</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Problem to Solution (A2 #6) */}
        <section style={{ background: 'var(--paper)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '64px 0' }}>
          <div className="page-wrap">
            <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', marginBottom: 40 }}>
              <span className="eyebrow" style={{ color: 'var(--orange)' }}>The dining room bottleneck</span>
              <h2 className="heading-3" style={{ margin: '8px 0 12px' }}>
                Traditional billing wastes 18 minutes per table
              </h2>
              <p className="muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
                Waiters spend half their shifts walking back and forth to print bills, verify payment screens, and punch orders into desktop terminals while guests wait.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div className="surface comparison-card-old">
                <span style={{ fontSize: 24, display: 'block', marginBottom: 12 }}>❌</span>
                <strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>The Old Paper Way</strong>
                <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.8 }}>
                  <li>Guests wait 10 minutes just to request the bill</li>
                  <li>Staff squint at tiny phone screens to check UPI confirmations</li>
                  <li>4% average revenue loss from manual voids and cash skimming</li>
                  <li>Unhappy diners leave without saying a word and post 1 star on Google</li>
                </ul>
              </div>

              <div className="surface comparison-card-new">
                <span style={{ fontSize: 24, display: 'block', marginBottom: 12 }}>✅</span>
                <strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>The ProjectQR Way</strong>
                <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.8 }}>
                  <li>Guests scan, order, and pay instantly from any phone browser</li>
                  <li>Webhook soundbox listener auto confirms UPI payments in real time</li>
                  <li>Role gated permissions shield revenue and menu pricing from unauthorized edits</li>
                  <li>Peak End micro survey converts 5 star diners into public Google reviews</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Live Product Showcase */}
        <ProductShowcase />

        {/* Section 3: Benefits (A2 #7 & A5) */}
        <section className="page-wrap" style={{ padding: '72px 0' }}>
          <div style={{ maxWidth: 640, marginBottom: 44 }}>
            <span className="eyebrow" style={{ color: 'var(--green)' }}>Outcome driven results</span>
            <h2 className="heading-3" style={{ margin: '8px 0 12px' }}>
              Built for speed, accuracy, and hospitality
            </h2>
            <p className="muted" style={{ fontSize: 15, margin: 0 }}>
              Four core advantages designed specifically for busy Indian restaurants and cafes.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            <div className="surface" style={{ padding: 22, borderRadius: 16 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>⚡</div>
              <strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>Zero verification queues</strong>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Guests pay with Google Pay, PhonePe, or Paytm and auto confirm without waiting for staff. Turn tables 15 minutes faster on weekend dinner rushes.
              </p>
            </div>

            <div className="surface" style={{ padding: 22, borderRadius: 16 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🛡️</div>
              <strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>Stop internal revenue leakage</strong>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Owner configured power toggles ensure waiters cannot edit menu prices, void orders after taking cash, or view total daily sales numbers.
              </p>
            </div>

            <div className="surface" style={{ padding: 22, borderRadius: 16 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>⭐</div>
              <strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>1 tap Google Maps rating booster</strong>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                15 second post meal psychology survey routes happy diners straight to your Google review link while alerting managers to table side issues.
              </p>
            </div>

            <div className="surface" style={{ padding: 22, borderRadius: 16 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🔒</div>
              <strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>4 digit table PIN defense</strong>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                Hosts share a 4 digit PIN with dining companions so friends share the bill while solo walk in strangers remain isolated on their own check.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: How It Works in 3 Steps (A2 #8) */}
        <section style={{ background: 'var(--paper)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '64px 0' }}>
          <div className="page-wrap">
            <div style={{ maxWidth: 640, margin: '0 auto 40px', textAlign: 'center' }}>
              <span className="eyebrow">Simple three step flow</span>
              <h2 className="heading-3" style={{ margin: '8px 0 10px' }}>
                How your restaurant operates with ProjectQR
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              <div className="surface" style={{ padding: 24, borderRadius: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)', display: 'block', marginBottom: 8 }}>STEP 01</span>
                <strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>Guest scans table QR stand</strong>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  Diner sits at Table 4 and scans the QR stand with their smartphone camera. No app download or account creation needed.
                </p>
              </div>

              <div className="surface" style={{ padding: 24, borderRadius: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)', display: 'block', marginBottom: 8 }}>STEP 02</span>
                <strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>Select dishes and auto pay via UPI</strong>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  Guests browse real time menu items, add spice instructions, and pay via any UPI app. Webhook verifies payment in 2 seconds.
                </p>
              </div>

              <div className="surface" style={{ padding: 24, borderRadius: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)', display: 'block', marginBottom: 8 }}>STEP 03</span>
                <strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>Kitchen prepares and waiter serves</strong>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  Kitchen display sounds an alert chime with table number and ticket items. Waiter delivers fresh food to the table.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Mandatory Tagline Reveal Section (B11) */}
        <TaglineReveal />

        {/* Section 6: Social Proof & Testimonials (A2 #9 & B8) */}
        <section style={{ background: 'var(--paper)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '64px 0' }}>
          <div className="page-wrap">
            <div style={{ maxWidth: 640, marginBottom: 36 }}>
              <span className="eyebrow" style={{ color: 'var(--orange)' }}>Real restaurateur experiences</span>
              <h2 className="heading-3" style={{ margin: '8px 0 10px' }}>
                Trusted by high volume dining rooms
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div className="surface" style={{ padding: 24, borderRadius: 16 }}>
                <div style={{ color: 'var(--orange)', fontSize: 15, marginBottom: 10 }}>★★★★★</div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', margin: '0 0 14px' }}>
                  "We cut our table turnaround time from 44 minutes to 29 minutes during Friday dinner rush. Our floor captains now focus on guest hospitality instead of delivering paper bills."
                </p>
                <strong style={{ fontSize: 13, display: 'block', color: 'var(--ink)' }}>Rajesh Singhania</strong>
                <span className="muted" style={{ fontSize: 12 }}>Founder, The Clay Oven Bistro · Bangalore</span>
              </div>

              <div className="surface" style={{ padding: 24, borderRadius: 16 }}>
                <div style={{ color: 'var(--orange)', fontSize: 15, marginBottom: 10 }}>★★★★★</div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', margin: '0 0 14px' }}>
                  "The table side complaint recovery saved us at least 18 bad Google reviews in our first month. The manager gets a chime before the guest even asks for the check."
                </p>
                <strong style={{ fontSize: 13, display: 'block', color: 'var(--ink)' }}>Ananya Deshmukh</strong>
                <span className="muted" style={{ fontSize: 12 }}>Operations Director, Spice and Hearth · Pune</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: FAQ (A2 #10, Plain Q&A for AEO) */}
        <section className="page-wrap" style={{ padding: '72px 0', maxWidth: 760 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span className="eyebrow">Frequently asked questions</span>
            <h2 className="heading-3" style={{ margin: '8px 0 10px' }}>
              Everything you need to know
            </h2>
            <p className="muted" style={{ fontSize: 14 }}>
              Clear answers on setup, security, hardware, and pricing.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="surface"
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
            ))}
          </div>
        </section>

        {/* Section 8: Risk Reversal & Final CTA (A2 #11 & #12) */}
        <section className="landing-cta-banner" style={{ padding: '72px 0', textAlign: 'center' }}>
          <div className="page-wrap" style={{ maxWidth: 680 }}>
            <h2
              className="heading-2"
              style={{
                color: 'var(--ink-on-dark, #ffffff)',
                margin: '0 0 14px',
                fontSize: 'clamp(30px, 5vw, 44px)'
              }}
            >
              Start serving faster tables today
            </h2>
            <p style={{ color: 'var(--muted-on-dark, #dcfce7)', fontSize: 16, lineHeight: 1.6, margin: '0 auto 28px', maxWidth: 540 }}>
              Turn your dining tables into seamless checkouts in under 10 minutes. No specialized hardware required.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link
                to="/demo"
                className="btn"
                style={{
                  background: 'var(--cta-btn-bg, #ffffff)',
                  color: 'var(--cta-btn-color, #12372c)',
                  minHeight: 46,
                  padding: '10px 24px',
                  fontSize: 15,
                  fontWeight: 700
                }}
              >
                Explore interactive demo <span aria-hidden="true">→</span>
              </Link>
              <Link
                to="/register"
                className="btn secondary"
                style={{
                  background: 'transparent',
                  borderColor: 'rgba(255, 255, 255, 0.4)',
                  color: '#ffffff',
                  minHeight: 46,
                  padding: '10px 24px',
                  fontSize: 15,
                  fontWeight: 600
                }}
              >
                Start 14-day free trial
              </Link>
            </div>
            <div style={{ marginTop: 20, fontSize: 12, color: 'var(--accent-green, #86efac)' }}>
              No credit card required · Free 14 day trial · Cancel anytime
            </div>
          </div>
        </section>
      </main>

      {/* Semantic Footer (B10) */}
      <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--paper-elevated)', padding: '40px 0' }}>
        <div className="page-wrap" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
          <div>
            <strong style={{ fontSize: 15, color: 'var(--ink)' }}>ProjectQR</strong>
            <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>
              Table side ordering, UPI auto settlement, and restaurant operations.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 13, alignItems: 'center' }}>
            <Link to="/demo" style={{ color: 'var(--green)', fontWeight: 600 }}>Live demo</Link>
            <Link to="/register" style={{ color: 'var(--green)', fontWeight: 600 }}>Get started</Link>
            <Link to="/login" className="muted">Sign in</Link>
            <span className="muted">© {new Date().getFullYear()} ProjectQR. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
