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
}

export function CategorySheet({
  isOpen,
  onClose,
  categories,
  activeCategoryId,
  onSelectCategory,
  restaurantName
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

  const totalDishes = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="zomato-sheet-root">
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
        {/* Grab handle indicator */}
        <div className="zomato-sheet-handle-wrap" onClick={onClose}>
          <div className="zomato-sheet-handle" />
        </div>

        {/* Header */}
        <div className="zomato-sheet-header">
          <div>
            <div className="zomato-sheet-eyebrow">
              {restaurantName || 'Browse Menu'}
            </div>
            <h2 className="zomato-sheet-title">Menu Categories</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="zomato-sheet-count-pill">
              {totalDishes} {totalDishes === 1 ? 'dish' : 'dishes'}
            </span>
            <button
              type="button"
              className="zomato-sheet-close-btn"
              onClick={onClose}
              aria-label="Close categories"
            >
              ✕
            </button>
          </div>
        </div>

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
                onClick={() => {
                  onSelectCategory(category.id);
                  onClose();
                }}
              >
                <div className="zomato-sheet-item-info">
                  <div className="zomato-sheet-item-row">
                    {isActive && <span className="zomato-sheet-active-dot" aria-hidden="true" />}
                    <span className="zomato-sheet-item-name">{category.name}</span>
                  </div>
                  {category.description && (
                    <p className="zomato-sheet-item-desc">{category.description}</p>
                  )}
                </div>

                <div className="zomato-sheet-item-meta">
                  <span className="zomato-sheet-dish-count">
                    {category.count}
                  </span>
                  <span className="zomato-sheet-arrow" aria-hidden="true">→</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
