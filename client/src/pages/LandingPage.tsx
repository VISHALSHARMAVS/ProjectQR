import { Link } from 'react-router-dom';
import { AppHeader } from '../components/ui';

export default function LandingPage() {
  return <div className="app-shell">
    <AppHeader action={<div style={{ display: 'flex', gap: 9 }}><Link className="btn secondary small" to="/login">Sign in</Link><Link className="btn small" to="/register">Set up restaurant</Link></div>} />
    <main className="page-wrap" style={{ padding: 'clamp(58px, 10vw, 112px) 0 70px' }}>
      <div style={{ maxWidth: 740 }}><span className="pill">Dine-in ordering, made easy</span><h1 style={{ margin: '22px 0 18px', fontSize: 'clamp(48px, 8vw, 88px)', lineHeight: .98, letterSpacing: '-.075em' }}>The table is set.<br />Let the menu come to you.</h1><p className="muted" style={{ maxWidth: 530, fontSize: 17, lineHeight: 1.7 }}>Guests scan a table QR, place their order and follow along. Your team sees every order in the kitchen as it comes in.</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: 11, marginTop: 26 }}><Link to="/register" className="btn">Create your restaurant <span aria-hidden="true">→</span></Link><Link to="/login" className="btn secondary">Open staff workspace</Link></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, maxWidth: 920, marginTop: 'clamp(58px, 10vw, 112px)' }}>
        {[['01', 'One QR per table', 'Guests land in the right restaurant and at the right table.'], ['02', 'A menu that stays current', 'Change prices and availability whenever your menu changes.'], ['03', 'Orders your team can follow', 'The customer and kitchen see the same order progress.']].map(([number, title, copy]) => <article className="surface" key={number} style={{ padding: 21 }}><span className="eyebrow">{number}</span><h2 style={{ margin: '20px 0 8px', fontSize: 17, letterSpacing: '-.025em' }}>{title}</h2><p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{copy}</p></article>)}
      </div>
    </main>
    <footer style={{ borderTop: '1px solid var(--line)', background: '#fbfaf6', padding: '36px 0', marginTop: 40 }}>
      <div className="page-wrap" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <strong style={{ fontSize: 14, color: 'var(--green-dark)' }}>ProjectQR</strong>
          <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>Effortless table-side ordering & real-time kitchen operations.</p>
        </div>
        <div style={{ display: 'flex', gap: 18, fontSize: 12 }}>
          <Link to="/register" style={{ color: 'var(--green)', fontWeight: 650 }}>Get started</Link>
          <Link to="/login" className="muted">Sign in</Link>
          <span className="muted">© {new Date().getFullYear()} ProjectQR. All rights reserved.</span>
        </div>
      </div>
    </footer>
  </div>;
}
