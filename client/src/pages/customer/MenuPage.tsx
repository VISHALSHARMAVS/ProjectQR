import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { formatTableLabel, money } from '../../lib/format';
import { DietaryBadge, EmptyState, ErrorPanel, Loading, Modal } from '../../components/ui';
import { CustomerAssistanceModal } from '../../components/CustomerAssistanceModal';
import { ReviewModal } from '../../components/ReviewModal';
import { CategorySheet, type CategoryItem } from '../../components/CategorySheet';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { localizeText, t, useGuestLang } from '../../lib/i18n';
import { getBrandStyle } from '../../lib/theme';
import type { Category, CustomerHistory, DietaryType, MenuItem, MenuItemAddon, MenuItemVariant, RestaurantInfo, TableCartLine } from '../../types';

interface CustomerSession {
  sessionId: string;
  customer: { id: string; name: string };
  restaurant: RestaurantInfo;
  table: { id: string; label: string; pin?: string | null };
  tab?: { id: string; label: string; isHost: boolean; isSeparateTab: boolean } | null;
  tableMismatch?: {
    currentTable: { id: string; label: string };
    scannedTable: { id: string; label: string; token: string };
  } | null;
}
interface CustomerMenu {
  categories: Category[];
  items: MenuItem[];
  todaysWinner?: { menuItemId: string; name: string; quantityToday: number } | null;
  bestsellerItemIds?: string[];
}

export default function CustomerMenuPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cartKey = `projectqr-cart:${token}`;
  const [reviewOpen, setReviewOpen] = useState(false);
  useOrderSocket(true);
  const session = useQuery({ queryKey: ['customer-session', token], queryFn: () => api.get<CustomerSession>(`/customer/session?token=${encodeURIComponent(token)}`), retry: false });
  const [lang] = useGuestLang(session.data?.restaurant?.defaultLanguage);
  const hasValidSession = Boolean(session.data && !session.data.tableMismatch);
  const menu = useQuery({ queryKey: ['customer-menu', token], queryFn: () => api.get<CustomerMenu>(`/customer/menu?token=${encodeURIComponent(token)}`), enabled: hasValidSession, retry: false });
  const tableCartQuery = useQuery({
    queryKey: ['table-cart', token],
    queryFn: () => api.get<{ items: TableCartLine[] }>(`/customer/cart?token=${encodeURIComponent(token)}`),
    enabled: hasValidSession,
    retry: false,
    refetchInterval: 10_000
  });

  const historyQuery = useQuery({
    queryKey: ['customer-history', token],
    queryFn: () => api.get<CustomerHistory>(`/customer/history?token=${encodeURIComponent(token)}`),
    enabled: hasValidSession,
    retry: false
  });

  const endVisit = useMutation({
    mutationFn: () => api.post('/customer/logout'),
    onSuccess: async () => {
      localStorage.removeItem(cartKey);
      await queryClient.removeQueries({ queryKey: ['customer-session', token] });
      navigate(`/order/${encodeURIComponent(token)}`, { replace: true });
    }
  });

  const tableCartData = tableCartQuery.data;
  const cart = useMemo(() => tableCartData?.items ?? [], [tableCartData]);
  const [activeCategory, setActiveCategory] = useState('');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | DietaryType>('ALL');
  const [bestsellerOnly, setBestsellerOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };
  const [assistanceOpen, setAssistanceOpen] = useState(false);

  // Customization Modal State (for Variants and Add-ons)
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MenuItemVariant | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<MenuItemAddon[]>([]);

  const updateItemMutation = useMutation({
    mutationFn: ({
      item,
      quantity,
      variant,
      addons,
      notes
    }: {
      item: MenuItem;
      quantity: number;
      variant?: MenuItemVariant | null;
      addons?: MenuItemAddon[];
      notes?: string;
    }) =>
      api.post<{ items: TableCartLine[] }>('/customer/cart/items', {
        token,
        menuItemId: item._id,
        quantity,
        selectedVariant: variant ?? null,
        selectedAddons: addons ?? [],
        notes
      }),
    onMutate: async ({ item, quantity, variant, addons, notes }) => {
      // 1. Cancel ongoing queries so they don't overwrite optimistic data
      await queryClient.cancelQueries({ queryKey: ['table-cart', token] });

      // 2. Snapshot previous cart
      const previousCart = queryClient.getQueryData<{ items: TableCartLine[] }>(['table-cart', token]);

      // 3. Compute price and variant key
      const basePrice = variant ? variant.pricePaise : item.pricePaise;
      const addonsTotal = (addons || []).reduce((sum, a) => sum + a.pricePaise, 0);
      const calculatedUnitPrice = basePrice + addonsTotal;
      const variantName = variant?.name || '';

      const currentItems: TableCartLine[] = previousCart?.items ? [...previousCart.items] : [];
      const existingIndex = currentItems.findIndex((line) => {
        const itemVariantName = line.selectedVariant?.name || '';
        return line.menuItemId === item._id && itemVariantName === variantName;
      });

      if (quantity <= 0) {
        if (existingIndex >= 0) {
          currentItems.splice(existingIndex, 1);
        }
      } else if (existingIndex >= 0) {
        currentItems[existingIndex] = {
          ...currentItems[existingIndex],
          quantity,
          unitPricePaise: calculatedUnitPrice,
          selectedVariant: variant ?? null,
          selectedAddons: addons ?? [],
          notes: notes !== undefined ? notes : currentItems[existingIndex].notes
        };
      } else {
        currentItems.push({
          menuItemId: item._id,
          name: item.name,
          unitPricePaise: calculatedUnitPrice,
          quantity,
          selectedVariant: variant ?? null,
          selectedAddons: addons ?? [],
          notes: notes || '',
          addedByName: session.data?.customer?.name || 'You'
        });
      }

      // 4. Instantly update React Query cache in 0ms
      queryClient.setQueryData<{ items: TableCartLine[] }>(['table-cart', token], {
        items: currentItems
      });

      return { previousCart };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['table-cart', token], context.previousCart);
      }
    },
    onSettled: () => {
      setCustomizingItem(null);
      void queryClient.invalidateQueries({ queryKey: ['table-cart', token] });
    }
  });

  const openCustomizer = (item: MenuItem) => {
    setCustomizingItem(item);
    if (item.variants && item.variants.length > 0) {
      setSelectedVariant(item.variants[0] || null);
    } else {
      setSelectedVariant(null);
    }
    setSelectedAddons([]);
  };

  const addItemDirect = (item: MenuItem) => {
    // If the item has variants or add-ons, always open customizer
    if ((item.variants && item.variants.length > 0) || (item.addons && item.addons.length > 0)) {
      openCustomizer(item);
    } else {
      const currentQty = quantityById.get(item._id) || 0;
      updateItemMutation.mutate({ item, quantity: currentQty + 1 });
    }
  };

  const handleDecreaseItem = (item: MenuItem) => {
    const matchingLines = cart.filter((l) => l.menuItemId === item._id);
    if (matchingLines.length === 0) return;
    const lastLine = matchingLines[matchingLines.length - 1];
    updateItemMutation.mutate({
      item,
      quantity: lastLine.quantity - 1,
      variant: lastLine.selectedVariant,
      addons: lastLine.selectedAddons,
      notes: lastLine.notes
    });
  };

  const quantityById = new Map<string, number>();
  for (const line of cart) {
    quantityById.set(line.menuItemId, (quantityById.get(line.menuItemId) || 0) + line.quantity);
  }

  const menuData = menu.data;
  const categories = useMemo(() => menuData?.categories ?? [], [menuData]);
  const items = useMemo(() => menuData?.items ?? [], [menuData]);
  const todaysWinner = menu.data?.todaysWinner;
  const bestsellerItemIds = useMemo(() => menu.data?.bestsellerItemIds ?? [], [menu.data?.bestsellerItemIds]);
  const queryClean = searchQuery.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (bestsellerOnly && !item.isBestseller && !item.isChefSpecial && !bestsellerItemIds.includes(item._id) && item._id !== todaysWinner?.menuItemId) {
        return false;
      }
      if (dietaryFilter !== 'ALL' && item.dietary !== dietaryFilter) return false;
      if (queryClean) {
        const matchName = item.name.toLowerCase().includes(queryClean);
        const matchDesc = item.description?.toLowerCase().includes(queryClean);
        return matchName || matchDesc;
      }
      return true;
    });
  }, [items, bestsellerOnly, bestsellerItemIds, todaysWinner, dietaryFilter, queryClean]);

  const availableCategories = useMemo(() => {
    return categories.filter((category) => {
      return filteredItems.some((item) => item.categoryId === category._id);
    });
  }, [categories, filteredItems]);

  const categoryItems: CategoryItem[] = useMemo(() => {
    return availableCategories.map((category) => {
      const count = filteredItems.filter((item) => item.categoryId === category._id).length;
      return {
        id: category._id,
        name: localizeText(category.name, category.translations, lang, 'name'),
        description: localizeText(category.description, category.translations, lang, 'description'),
        count
      };
    });
  }, [availableCategories, filteredItems, lang]);

  const effectiveActiveCategory = activeCategory || availableCategories[0]?._id || '';

  // Auto-sync active category on scroll using lightweight IntersectionObserver
  useEffect(() => {
    if (!availableCategories.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const catId = entry.target.id.replace('category-', '');
            setActiveCategory(catId);
            const chip = document.getElementById(`chip-${catId}`);
            if (chip) {
              chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
          }
        }
      },
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 }
    );

    availableCategories.forEach((cat) => {
      const el = document.getElementById(`category-${cat._id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [availableCategories]);

  if (session.data?.tableMismatch || (session.error instanceof ApiError && (session.error.status === 401 || session.error.code === 'CUSTOMER_SESSION_TABLE_MISMATCH'))) {
    return <Navigate to={`/order/${encodeURIComponent(token)}/verify`} replace />;
  }
  if (session.isLoading || menu.isLoading) return <Loading label="Loading your menu…" />;
  if (session.error || !session.data || menu.error || !menu.data) {
    return <ErrorPanel message="Could not load menu. Scan the QR code again or ask your waiter for assistance." />;
  }

  const { restaurant, table } = session.data;
  const winnerMenuItem = todaysWinner ? items.find((i) => i._id === todaysWinner.menuItemId) : null;

  const scrollTo = (id: string): void => {
    setActiveCategory(id);
    const target = document.getElementById(`category-${id}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('category-highlight-flash');
      window.setTimeout(() => target.classList.remove('category-highlight-flash'), 1200);
    }
  };

  const totalQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.unitPricePaise, 0);

  const brandStyle = getBrandStyle(restaurant.brandColor);

  // Compute live subtotal inside customization modal
  const modalUnitPrice = (selectedVariant ? selectedVariant.pricePaise : (customizingItem?.pricePaise || 0)) +
    selectedAddons.reduce((s, a) => s + a.pricePaise, 0);

  return (
    <main className={`customer-wrap customer-page ${cart.length > 0 ? 'cart-active' : ''}`} style={brandStyle}>
      <header className="customer-header">
        <div className="customer-header-brand">
          <div className="restaurant-logo">
            {restaurant.logoUrl ? <img src={restaurant.logoUrl} alt="" /> : restaurant.name.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restaurant.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {formatTableLabel(table.label)} · Hi, {session.data.customer.name}
              </span>
              {table.pin && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--soft-green)',
                    color: 'var(--green-dark)',
                    border: '1px solid var(--line)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600
                  }}
                  title="Share this PIN with friends at your table so they can join your shared cart"
                >
                  PIN: <span className="font-mono-numbers" style={{ letterSpacing: 1 }}>{table.pin}</span>
                </span>
              )}
              {session.data.tab?.isSeparateTab && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--paper-elevated)',
                    color: 'var(--muted)',
                    border: '1px solid var(--line)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  Solo tab
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="customer-header-actions">
          <ThemeToggle variant="compact" />
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setReviewOpen(true)}
            title="Rate your dining experience"
            style={{ color: 'var(--orange)', borderColor: 'var(--line)' }}
          >
            Review
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setAssistanceOpen(true)}
            title="Request water, cutlery, bill or call a waiter"
          >
            Help
          </button>
          <Link className="btn secondary small" to={`/order/${encodeURIComponent(token)}/tracking`}>
            Orders
          </Link>
          <button className="btn ghost small" onClick={() => endVisit.mutate()} disabled={endVisit.isPending} title="End dining visit">
            {endVisit.isPending ? '…' : 'End'}
          </button>
        </div>
      </header>

      <div style={{ paddingTop: 14 }}>
        <div
          style={{
            marginBottom: 14,
            padding: '14px 16px',
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <h1 className="heading-4" style={{ margin: 0, fontSize: 20, lineHeight: 1.25 }}>
                {restaurant.name}
              </h1>
              {(restaurant.description || restaurant.welcomeTagline) && (
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.4 }}>
                  {restaurant.description || restaurant.welcomeTagline}
                </p>
              )}
            </div>
            <span className="pill green" style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {formatTableLabel(table.label)}
            </span>
          </div>
        </div>

        {table.pin && session.data?.tab?.isHost && (
          <div style={{
            margin: '0 0 16px',
            padding: '12px 16px',
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            color: 'var(--ink)',
            lineHeight: 1.4
          }}>
            <span>
              <strong>Friends dining with you?</strong> Tell them Table PIN <strong>{table.pin}</strong> when they scan the table QR code so they can join your shared cart.
            </span>
          </div>
        )}

        {/* Instant Search Bar */}
        <div className="menu-search-wrap">
          <svg className="menu-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="search"
            className="menu-search-input"
            placeholder={t('searchDishes', lang)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search menu"
          />
          {searchQuery && (
            <button
              type="button"
              className="menu-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dietary & Bestseller Filters */}
        <div className="dietary-filter-bar" aria-label="Filter by dietary preference">
          <button
            type="button"
            className={`dietary-filter-chip ${dietaryFilter === 'ALL' && !bestsellerOnly ? 'active' : ''}`}
            onClick={() => { setDietaryFilter('ALL'); setBestsellerOnly(false); }}
          >
            All Items
          </button>
          <button
            type="button"
            className={`dietary-filter-chip ${bestsellerOnly ? 'active' : ''}`}
            onClick={() => setBestsellerOnly(!bestsellerOnly)}
          >
            Bestsellers
          </button>
          <button
            type="button"
            className={`dietary-filter-chip ${dietaryFilter === 'VEG' ? 'active' : ''}`}
            onClick={() => setDietaryFilter(dietaryFilter === 'VEG' ? 'ALL' : 'VEG')}
          >
            <DietaryBadge type="VEG" /> Veg Only
          </button>
          <button
            type="button"
            className={`dietary-filter-chip ${dietaryFilter === 'NON_VEG' ? 'active' : ''}`}
            onClick={() => setDietaryFilter(dietaryFilter === 'NON_VEG' ? 'ALL' : 'NON_VEG')}
          >
            <DietaryBadge type="NON_VEG" /> Non-Veg
          </button>
          <button
            type="button"
            className={`dietary-filter-chip ${dietaryFilter === 'EGG' ? 'active' : ''}`}
            onClick={() => setDietaryFilter(dietaryFilter === 'EGG' ? 'ALL' : 'EGG')}
          >
            <DietaryBadge type="EGG" /> Contains Egg
          </button>
        </div>

        {/* Today's Winner Spotlight Banner */}
        {todaysWinner && winnerMenuItem && (
          <section className="todays-winner-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="caption-3" style={{ color: 'var(--ink)' }}>
                  Today’s winner
                </span>
              </div>
              <span className="pill orange" style={{ fontSize: 11, fontWeight: 600 }}>
                Most ordered today
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
              <div>
                <strong className="title-3" style={{ color: 'var(--ink)', display: 'block' }}>{todaysWinner.name}</strong>
                <span className="body-6" style={{ color: 'var(--muted)', display: 'block', marginTop: 2 }}>
                  Ordered <strong>{todaysWinner.quantityToday} times</strong> today at {restaurant.name}
                </span>
              </div>
              <button
                type="button"
                className="btn small"
                onClick={() => addItemDirect(winnerMenuItem)}
              >
                Add ({money(winnerMenuItem.pricePaise)})
              </button>
            </div>
          </section>
        )}

        {/* Quick Reorder Carousel from Previous Visit */}
        {historyQuery.data?.favoriteItems && historyQuery.data.favoriteItems.length > 0 && (
          <section style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <span className="eyebrow" style={{ color: 'var(--green)', fontSize: 11 }}>
                  Welcome back
                </span>
                <h2 className="title-2" style={{ margin: '2px 0 0', color: 'var(--ink)' }}>
                  Reorder from your recent visits
                </h2>
              </div>
              {historyQuery.data.lastVisit && (
                <span className="caption-2" style={{ color: 'var(--muted)' }}>
                  Last visited {new Date(historyQuery.data.lastVisit.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
              {historyQuery.data.favoriteItems.map((fav) => {
                const matchedMenuItem = menu.data?.items.find((i) => i._id === fav.menuItemId);
                return (
                  <div
                    key={fav.menuItemId}
                    style={{
                      flex: '0 0 170px',
                      background: 'var(--paper-elevated)',
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <DietaryBadge type={fav.dietaryType} />
                        <strong className="title-4" style={{ lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {fav.name}
                        </strong>
                      </div>
                      <span className="font-mono-numbers" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                        {money(fav.pricePaise)}
                      </span>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn small full"
                        onClick={() => matchedMenuItem && addItemDirect(matchedMenuItem)}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>

      {availableCategories.length > 0 && (
        <div className="menu-categories-sticky-wrap">
          <nav className="menu-categories" id="menu-category-nav" aria-label="Menu categories">
            {availableCategories.map((category) => (
              <button
                key={category._id}
                id={`chip-${category._id}`}
                className={`category-chip ${effectiveActiveCategory === category._id ? 'active' : ''}`}
                onClick={() => scrollTo(category._id)}
              >
                {localizeText(category.name, category.translations, lang, 'name')}
              </button>
            ))}
          </nav>
        </div>
      )}

      {availableCategories.length === 0 ? (
        <div className="surface" style={{ marginTop: 14 }}>
          <EmptyState
            title={searchQuery ? `No dishes found for “${searchQuery}”` : "No items match this filter"}
            description={searchQuery ? "Try checking your spelling or clear the search to browse all items." : "Try selecting 'All Items' or choose another category."}
            action={searchQuery ? <button className="btn small" onClick={() => setSearchQuery('')}>Clear search</button> : undefined}
          />
        </div>
      ) : (
        availableCategories.map((category) => {
          const categoryItems = filteredItems.filter((item) => item.categoryId === category._id);
          const isCollapsed = Boolean(collapsedCategories[category._id]);
          return (
          <section className="menu-section" id={`category-${category._id}`} key={category._id}>
            <button
              type="button"
              onClick={() => toggleCategoryCollapse(category._id)}
              aria-expanded={!isCollapsed}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'transparent',
                border: 'none',
                padding: '6px 0',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--ink)'
              }}
            >
              <h2 style={{ margin: 0 }}>
                {localizeText(category.name, category.translations, lang, 'name')} <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>({categoryItems.length})</span>
              </h2>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 160ms ease', flexShrink: 0 }}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {category.description && !isCollapsed && (
              <p className="muted" style={{ margin: '2px 0 10px', fontSize: 12 }}>{category.description}</p>
            )}
            {!isCollapsed && categoryItems.map((item) => {
              const qty = quantityById.get(item._id) ?? 0;
              const hasCustomizations = (item.variants && item.variants.length > 0) || (item.addons && item.addons.length > 0);
              const isWinner = todaysWinner?.menuItemId === item._id;
              const isBestseller = Boolean(item.isBestseller || bestsellerItemIds.includes(item._id));
              const isSpecial = Boolean(item.isChefSpecial);

              return (
                <article className={`swiggy-card ${item.available ? '' : 'is-sold-out'}`} key={item._id}>
                  <div className="swiggy-card-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <DietaryBadge type={item.dietary || 'VEG'} />
                      {isWinner ? (
                        <span className="swiggy-social-badge winner">Today’s winner</span>
                      ) : isBestseller ? (
                        <span className="swiggy-social-badge reordered">
                          <span className="meter" /> Bestseller
                        </span>
                      ) : isSpecial ? (
                        <span className="swiggy-social-badge" style={{ background: 'var(--soft-green)', color: 'var(--green)', border: '1px solid var(--brand-border, var(--line))', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                          Chef’s Special
                        </span>
                      ) : null}
                    </div>

                    <h3 className="swiggy-dish-title">{localizeText(item.name, item.translations, lang, 'name')}</h3>

                    <div className="swiggy-dish-price">
                      {item.variants && item.variants.length > 0
                        ? `From ${money(Math.min(...item.variants.map((v) => v.pricePaise)))}`
                        : money(item.pricePaise)}
                    </div>

                    {item.description && <p className="swiggy-dish-desc">{localizeText(item.description, item.translations, lang, 'description')}</p>}
                  </div>

                  <div className="swiggy-media-col">
                    <div className="swiggy-img-wrap">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} loading="lazy" />
                      ) : (
                        <div className="swiggy-placeholder-img">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M15 11v11"/><path d="M5 2v20"/><path d="M2 2h6"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="swiggy-btn-anchor">
                      {!item.available ? (
                        <span className="swiggy-sold-out-pill">Sold out</span>
                      ) : qty === 0 ? (
                        <>
                          <button
                            type="button"
                            className="swiggy-add-btn"
                            onClick={() => addItemDirect(item)}
                          >
                            Add <span>+</span>
                          </button>
                          {hasCustomizations && (
                            <span className="swiggy-customisable-hint">Customisable</span>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="swiggy-stepper">
                            <button
                              type="button"
                              aria-label={`Decrease ${item.name}`}
                              onClick={() => handleDecreaseItem(item)}
                            >
                              −
                            </button>
                            <span>{qty}</span>
                            <button
                              type="button"
                              aria-label={`Increase ${item.name}`}
                              onClick={() => addItemDirect(item)}
                            >
                              +
                            </button>
                          </div>
                          {hasCustomizations && (
                            <span className="swiggy-customisable-hint">Customisable</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
          );
        })
      )}

      {/* GST Inclusive Notice Footer */}
      <footer style={{ textAlign: 'center', padding: '24px 12px 100px', color: 'var(--muted)', fontSize: 12 }}>
        <p style={{ margin: 0, fontWeight: 500 }}>✓ All menu prices are inclusive of applicable taxes (GST).</p>
        <p style={{ margin: '4px 0 0', opacity: 0.8 }}>Itemized tax invoice breakdown provided on your bill.</p>
      </footer>

      {/* Item Customization Modal (Portion Sizes & Extras) */}
      {customizingItem && (
        <Modal
          title={`Customize ${customizingItem.name}`}
          onClose={() => setCustomizingItem(null)}
          width={480}
        >
          <div style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: 4 }}>
            {/* Portion Size Selection */}
            {customizingItem.variants && customizingItem.variants.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <span className="eyebrow" style={{ display: 'block', marginBottom: 8, color: 'var(--ink)' }}>
                  Choose portion size (required)
                </span>
                <div style={{ display: 'grid', gap: 8 }}>
                  {customizingItem.variants.map((v) => (
                    <label
                      key={v.name}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        border: selectedVariant?.name === v.name ? '2px solid var(--green)' : '1px solid var(--line)',
                        borderRadius: 12,
                        background: selectedVariant?.name === v.name ? 'var(--soft-green)' : 'var(--paper)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="radio"
                          name="portion-variant"
                          checked={selectedVariant?.name === v.name}
                          onChange={() => setSelectedVariant(v)}
                        />
                        <strong className="title-4">{v.name}</strong>
                      </div>
                      <span className="font-mono-numbers" style={{ fontWeight: 600, fontSize: 14 }}>{money(v.pricePaise)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Add-ons / Extras Selection */}
            {customizingItem.addons && customizingItem.addons.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <span className="eyebrow" style={{ display: 'block', marginBottom: 8, color: 'var(--ink)' }}>
                  Add extras (optional)
                </span>
                <div style={{ display: 'grid', gap: 8 }}>
                  {customizingItem.addons.map((addon) => {
                    const isChecked = selectedAddons.some((a) => a.name === addon.name);
                    return (
                      <label
                        key={addon.name}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '11px 14px',
                          border: isChecked ? '1.5px solid var(--green)' : '1px solid var(--line)',
                          borderRadius: 12,
                          background: isChecked ? 'var(--soft-green)' : 'var(--paper)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAddons((prev) => [...prev, addon]);
                              } else {
                                setSelectedAddons((prev) => prev.filter((a) => a.name !== addon.name));
                              }
                            }}
                          />
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{addon.name}</span>
                        </div>
                        <span className="font-mono-numbers" style={{ fontWeight: 600, color: 'var(--muted)', fontSize: 13 }}>
                          +{money(addon.pricePaise)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Add Action */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginBottom: 8 }}>
              Inclusive of all taxes (GST)
            </div>
            <button
              type="button"
              className="btn full"
              disabled={updateItemMutation.isPending}
              onClick={() => {
                updateItemMutation.mutate({
                  item: customizingItem,
                  quantity: 1,
                  variant: selectedVariant,
                  addons: selectedAddons
                });
              }}
            >
              {updateItemMutation.isPending ? 'Adding…' : `Add to order · ${money(modalUnitPrice)}`}
            </button>
          </div>
        </Modal>
      )}

      {/* Floating Zomato-style Menu Category FAB */}
      {availableCategories.length > 0 && !categoryMenuOpen && (
        <button
          type="button"
          className={`floating-menu-fab ${cart.length > 0 ? 'has-cart' : ''}`}
          style={{
            bottom: cart.length > 0 ? 80 : 24,
            background: '#27272a',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            padding: '10px 18px'
          }}
          onClick={() => setCategoryMenuOpen(true)}
          aria-label="Open menu categories"
        >
          <svg className="fab-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
          </svg>
          <span className="fab-label">Menu</span>
        </button>
      )}

      {/* Floating Call Staff Button */}
      <button
        type="button"
        className="assistance-float-pill"
        style={{ left: 16, right: 'auto', bottom: cart.length > 0 ? 80 : 24 }}
        onClick={() => setAssistanceOpen(true)}
        title="Request water, cutlery, bill or call a waiter"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        <span>Call staff</span>
      </button>

      {/* Floating Bottom Table Cart Bar */}
      {cart.length > 0 && (
        <Link className="swiggy-floating-cart-bar" to={`/order/${encodeURIComponent(token)}/checkout`}>
          <div>
            <div className="font-mono-numbers" style={{ fontSize: 13, fontWeight: 600 }}>
              {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'} · {money(subtotal)}
            </div>
            <div style={{ fontSize: 11, opacity: 0.9, marginTop: 1 }}>
              Shared with {formatTableLabel(table.label)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
            <span>View cart</span>
            <span aria-hidden="true">→</span>
          </div>
        </Link>
      )}

      <CategorySheet
        isOpen={categoryMenuOpen}
        onClose={() => setCategoryMenuOpen(false)}
        categories={categoryItems}
        activeCategoryId={effectiveActiveCategory}
        onSelectCategory={scrollTo}
        restaurantName={restaurant.name}
        bottomOffset={cart.length > 0 ? 80 : 24}
      />

      <CustomerAssistanceModal
        isOpen={assistanceOpen}
        onClose={() => setAssistanceOpen(false)}
        token={token}
        tableLabel={formatTableLabel(table.label)}
      />

      <ReviewModal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        token={token}
        tableLabel={formatTableLabel(table.label)}
        googleReviewUrl={session.data?.restaurant?.googleReviewUrl}
        enableDishReviews={session.data?.restaurant?.enableDishReviews ?? true}
      />
    </main>
  );
}
