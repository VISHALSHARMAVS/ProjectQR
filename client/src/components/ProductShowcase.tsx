import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DietaryBadge } from './ui';

type ShowcaseTab = 'menu' | 'kitchen' | 'dashboard';

export function ProductShowcase() {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('menu');

  return (
    <section className="glass-surface" style={{ padding: '64px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <div className="page-wrap">
        <div style={{ maxWidth: 680, margin: '0 auto 36px', textAlign: 'center' }}>
          <span className="pill green" style={{ fontSize: 12, fontWeight: 600, display: 'inline-block', marginBottom: 12 }}>Platform Interfaces</span>
          <h2 className="heading-3" style={{ margin: '8px 0 12px' }}>
            Built for speed at every step of service
          </h2>
          <p className="muted" style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>
            Inspect the actual interfaces your guests, kitchen chefs, and floor managers use every day.
          </p>

          {/* Interactive Showcase Switcher */}
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--paper-elevated)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: 4,
              gap: 4,
              marginTop: 24,
              maxWidth: '100%',
              overflowX: 'auto'
            }}
          >
            <button
              type="button"
              className={`btn small ${activeTab === 'menu' ? '' : 'secondary'}`}
              onClick={() => setActiveTab('menu')}
              style={{ borderRadius: 8, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              <span>Customer QR Menu</span>
            </button>
            <button
              type="button"
              className={`btn small ${activeTab === 'kitchen' ? '' : 'secondary'}`}
              onClick={() => setActiveTab('kitchen')}
              style={{ borderRadius: 8, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>Kitchen Display (KDS)</span>
            </button>
            <button
              type="button"
              className={`btn small ${activeTab === 'dashboard' ? '' : 'secondary'}`}
              onClick={() => setActiveTab('dashboard')}
              style={{ borderRadius: 8, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span>Owner Operations</span>
            </button>
          </div>
        </div>

        {/* TAB 1: CUSTOMER MENU SHOWCASE */}
        {activeTab === 'menu' && (
          <div
            className="glass-card"
            style={{
              maxWidth: 720,
              margin: '0 auto',
              padding: '24px 20px',
              borderRadius: 20
            }}
          >
            {/* Mock Diner Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--line)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="restaurant-logo" style={{ color: 'var(--green)' }}>OT</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>The Olive Tree Bistro</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Table 4 · PIN: <strong>7712</strong> · UPI auto confirm
                  </div>
                </div>
              </div>
              <span className="pill orange" style={{ fontSize: 11, fontWeight: 600 }}>
                Dine in
              </span>
            </div>

            {/* Category Chips */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
              <span className="category-chip active">Wood fired mains</span>
              <span className="category-chip">Small plates</span>
              <span className="category-chip">Artisanal brews</span>
            </div>

            {/* Sample Dish Card 1 */}
            <article className="swiggy-card" style={{ marginTop: 12 }}>
              <div className="swiggy-card-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DietaryBadge type="VEG" />
                  <span className="swiggy-social-badge reordered">
                    <span className="meter" /> Highly reordered
                  </span>
                </div>
                <h4 className="swiggy-dish-title">Wild Mushroom Sourdough Pizza</h4>
                <div className="swiggy-dish-price">₹540.00</div>
                <p className="swiggy-dish-desc">
                  Shiitake, button and oyster mushrooms over San Marzano sauce and fior di latte mozzarella.
                </p>
              </div>
              <div className="swiggy-media-col">
                <div className="swiggy-img-wrap">
                  <img
                    src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=500&q=80"
                    alt="Wild Mushroom Pizza"
                    loading="lazy"
                  />
                </div>
                <div className="swiggy-btn-anchor">
                  <div className="swiggy-stepper">
                    <button type="button">−</button>
                    <span>1</span>
                    <button type="button">+</button>
                  </div>
                  <span className="swiggy-customisable-hint">Customisable</span>
                </div>
              </div>
            </article>

            {/* Sample Dish Card 2 */}
            <article className="swiggy-card">
              <div className="swiggy-card-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DietaryBadge type="NON_VEG" />
                  <span className="swiggy-social-badge winner" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    Bestseller
                  </span>
                </div>
                <h4 className="swiggy-dish-title">Smoked Chicken & Rosemary Flatbread</h4>
                <div className="swiggy-dish-price">₹580.00</div>
                <p className="swiggy-dish-desc">
                  Slow smoked pulled chicken breast, caramelized balsamic shallots and pecorino cheese.
                </p>
              </div>
              <div className="swiggy-media-col">
                <div className="swiggy-img-wrap">
                  <img
                    src="https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&fit=crop&w=500&q=80"
                    alt="Smoked Chicken Flatbread"
                    loading="lazy"
                  />
                </div>
                <div className="swiggy-btn-anchor">
                  <button type="button" className="swiggy-add-btn">Add +</button>
                </div>
              </div>
            </article>

            {/* Floating Cart Bar preview */}
            <div
              style={{
                marginTop: 16,
                background: 'var(--green)',
                color: 'white',
                padding: '12px 18px',
                borderRadius: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 8px 24px rgba(27, 77, 62, 0.3)'
              }}
            >
              <div>
                <strong style={{ fontSize: 14 }}>1 item · ₹540.00</strong>
                <div style={{ fontSize: 11, opacity: 0.9 }}>Shared with Table 4</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>View cart →</span>
            </div>
          </div>
        )}

        {/* TAB 2: KITCHEN DISPLAY SHOWCASE */}
        {activeTab === 'kitchen' && (
          <div
            className="glass-card"
            style={{
              maxWidth: 900,
              margin: '0 auto',
              padding: '24px 20px',
              borderRadius: 20
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span className="pill orange" style={{ fontSize: 11, fontWeight: 600, display: 'inline-block', marginBottom: 6 }}>Live Ticket Stream</span>
                <h3 className="heading-5" style={{ margin: '2px 0 0' }}>Kitchen Display System (KDS)</h3>
              </div>
              <span className="pill orange" style={{ fontSize: 12 }}>3 active orders</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              {/* Ticket 1 */}
              <div style={{ padding: 16, borderRadius: 12, border: '2px solid var(--orange)', background: 'var(--paper)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 15 }}>Ticket 104 · Table 4</strong>
                  <span className="pill orange" style={{ fontSize: 10 }}>COOKING</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  Guest: Ananya S. · 6 mins in kitchen
                </div>
                <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '8px 0', margin: '8px 0', fontSize: 13 }}>
                  <div><strong>1x</strong> Wild Mushroom Sourdough Pizza</div>
                  <div style={{ fontSize: 11, color: 'var(--orange)', background: 'var(--soft-orange)', border: '1px solid var(--line)', padding: '2px 6px', borderRadius: 4, marginTop: 4 }}>
                    Note: Extra crispy crust
                  </div>
                </div>
                <button type="button" className="btn full small" style={{ background: 'var(--green)', marginTop: 10 }}>
                  Mark ready to serve ✓
                </button>
              </div>

              {/* Ticket 2 */}
              <div style={{ padding: 16, borderRadius: 12, border: '2px solid var(--green)', background: 'var(--paper)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 15 }}>Ticket 101 · Table 1</strong>
                  <span className="pill green" style={{ fontSize: 10 }}>READY</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  Guest: Pooja V. · Ready for runner
                </div>
                <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '8px 0', margin: '8px 0', fontSize: 13 }}>
                  <div><strong>1x</strong> Paneer Tikka Sourdough Toast</div>
                  <div><strong>2x</strong> Cold Brew Tonic</div>
                </div>
                <button type="button" className="btn secondary full small" style={{ marginTop: 10 }}>
                  Mark delivered / clear
                </button>
              </div>

              {/* Ticket 3 */}
              <div style={{ padding: 16, borderRadius: 12, border: '1.5px solid var(--line)', background: 'var(--paper)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 15 }}>Ticket 102 · Table 2</strong>
                  <span className="pill" style={{ fontSize: 10 }}>ACCEPTED</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                  Guest: Karan M. · 1 min ago
                </div>
                <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '8px 0', margin: '8px 0', fontSize: 13 }}>
                  <div><strong>1x</strong> Smoked Chicken Flatbread</div>
                  <div><strong>1x</strong> Crispy Truffle Fries</div>
                </div>
                <button type="button" className="btn full small" style={{ background: 'var(--orange)', marginTop: 10 }}>
                  Start preparing →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RESTAURANT OWNER DASHBOARD SHOWCASE */}
        {activeTab === 'dashboard' && (
          <div
            className="glass-card"
            style={{
              maxWidth: 900,
              margin: '0 auto',
              padding: '24px 20px',
              borderRadius: 20
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span className="pill green" style={{ fontSize: 11, fontWeight: 600, display: 'inline-block', marginBottom: 6 }}>Operations Overview</span>
                <h3 className="heading-5" style={{ margin: '2px 0 0' }}>Restaurant Operations Cockpit</h3>
              </div>
              <span className="pill green" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Owner role protected
              </span>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--paper-elevated)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Today's sales</span>
                <div className="font-mono-numbers" style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 2px' }}>₹24,850.00</div>
                <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ 100% UPI verified</span>
              </div>
              <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--paper-elevated)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active tickets</span>
                <div className="font-mono-numbers" style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 2px' }}>3 in queue</div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Avg ticket: 11.4m</span>
              </div>
              <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--paper-elevated)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Table capacity</span>
                <div className="font-mono-numbers" style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 2px' }}>6 / 8 tables</div>
                <span style={{ fontSize: 11, color: 'var(--green)' }}>75% occupied</span>
              </div>
              <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--paper-elevated)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Staff RBAC</span>
                <div style={{ fontSize: 18, fontWeight: 700, margin: '8px 0 2px', color: 'var(--green)' }}>Shielded</div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Turnover hidden</span>
              </div>
            </div>

            {/* Floor Map Strip */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Dining room table states</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: 10 }}>
                {['Table 1 (Ready)', 'Table 2 (Occupied)', 'Table 3 (Available)', 'Table 4 (Cooking)', 'Table 5 (Available)', 'Table 6 (Available)', 'Table 7 (Billed)', 'Table 8 (Available)'].map((t, idx) => {
                  const isAvailable = t.includes('Available');
                  const isReady = t.includes('Ready');
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 6px',
                        textAlign: 'center',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        border: isReady ? '1.5px solid var(--green)' : isAvailable ? '1px solid var(--line)' : '1px solid var(--orange)',
                        background: isReady || isAvailable ? 'var(--soft-green)' : 'var(--soft-orange)',
                        color: isReady || isAvailable ? 'var(--green)' : 'var(--orange)'
                      }}
                    >
                      {t}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* CTA Callout to Interactive Demo */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
            Experience the full live ordering flow with real soundbox chimes and simulated UPI confirmations:
          </p>
          <Link
            to="/demo"
            className="btn"
            style={{
              padding: '10px 24px',
              fontSize: 15,
              fontWeight: 600
            }}
          >
            Launch full interactive demo (No signup required) <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
