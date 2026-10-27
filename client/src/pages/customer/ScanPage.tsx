import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { Loading } from '../../components/ui';
import type { RestaurantInfo } from '../../types';

interface TableLanding { restaurant: RestaurantInfo; table: { id: string; label: string } }

export default function ScanPage() {
  const { token = '' } = useParams();
  const query = useQuery({ queryKey: ['public-table', token], queryFn: () => api.get<TableLanding>(`/public/tables/${encodeURIComponent(token)}`), retry: false });
  if (query.isLoading) return <div className="customer-wrap"><Loading label="Finding your table…" /></div>;
  if (query.error) {
    const message = query.error instanceof ApiError ? query.error.message : 'This QR code could not be opened.';
    return <main className="customer-wrap customer-page"><div className="customer-intro"><span className="eyebrow">ProjectQR</span><h2>This table link is unavailable.</h2><p>{message} Please ask a team member for help.</p></div><Link to="/" className="btn secondary">Back to home</Link></main>;
  }
  if (!query.data) return <Navigate to="/" replace />;
  const { restaurant, table } = query.data;
  return <main className="customer-wrap customer-page">
    <header className="customer-header"><div className="restaurant-logo">{restaurant.logoUrl ? <img src={restaurant.logoUrl} alt="" /> : restaurant.name.slice(0, 1).toUpperCase()}</div><div><h1>{restaurant.name}</h1><p>Table {table.label}</p></div></header>
    <section className="customer-intro"><span className="eyebrow">Welcome in</span><h2>Make yourself<br />comfortable.</h2><p>Browse the menu and order whenever you’re ready. Your team will take it from here.</p></section>
    <section className="customer-card surface"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16 }}><div><div className="eyebrow">Your table</div><strong style={{ display: 'block', marginTop: 4, fontSize: 21 }}>{table.label}</strong></div><span className="pill">Dine in</span></div><Link className="btn full" to={`/order/${encodeURIComponent(token)}/verify`}>Continue to the menu <span aria-hidden="true">→</span></Link><p className="muted" style={{ margin: '12px 0 0', fontSize: 11, textAlign: 'center' }}>We’ll ask you to verify a phone number before ordering.</p></section>
  </main>;
}
