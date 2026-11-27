import { useEffect, useRef } from 'react';

export interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  count: number;
}

interface CategorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  activeCategoryId?: string;
  onSelectCategory: (categoryId: string) => void;
  restaurantName?: string;
  bottomOffset?: number;
}

export function CategorySheet({
  isOpen,
  onClose,
  categories,
  activeCategoryId,
  onSelectCategory,
  bottomOffset = 24
}: CategorySheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="zomato-sheet-root" style={{ paddingBottom: bottomOffset }}>
      {/* Tap outside to dismiss */}
      <div
        className="zomato-sheet-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        className="zomato-sheet-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu categories"
      >
        {/* Category List */}
        <div className="zomato-sheet-list" role="listbox">
          {categories.map((category) => {
            const isActive = activeCategoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`zomato-sheet-item ${isActive ? 'active' : ''}`}
                style={{
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 12,
                  color: isActive ? 'var(--green)' : 'var(--ink)'
                }}
                onClick={() => {
                  onClose();
                  window.requestAnimationFrame(() => {
                    window.setTimeout(() => {
                      onSelectCategory(category.id);
                    }, 40);
                  });
                }}
              >
                <div className="zomato-sheet-item-info">
                  <div className="zomato-sheet-item-row">
                    <span
                      className="zomato-sheet-item-name"
                      style={{
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? 'var(--green)' : 'var(--ink)'
                      }}
                    >
                      {category.name}
                    </span>
                  </div>
                </div>

                <div className="zomato-sheet-item-meta">
                  <span
                    className="zomato-sheet-dish-count"
                    style={{
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--green)' : 'var(--muted)'
                    }}
                  >
                    {category.count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Matching Close Pill directly below popup */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 16, position: 'relative', zIndex: 1002 }}>
        <button
          type="button"
          className="floating-menu-fab"
          style={{
            position: 'static',
            background: '#27272a',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            padding: '10px 18px',
            borderRadius: 999
          }}
          onClick={onClose}
          aria-label="Close menu categories"
        >
          <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>✕</span>
          <span className="fab-label">Close</span>
        </button>
      </div>
    </div>
  );
}
