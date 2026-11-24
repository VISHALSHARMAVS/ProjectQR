import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { Modal } from './ui';
import type { DishRatingPayload, ReviewRootCauseTag, SubmitReviewPayload } from '../types';

interface OrderedDishItem {
  menuItemId?: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  orderId?: string;
  tableLabel?: string;
  googleReviewUrl?: string;
  enableDishReviews?: boolean;
  orderedDishes?: OrderedDishItem[];
  onSuccess?: () => void;
}

const ROOT_CAUSE_OPTIONS: { tag: ReviewRootCauseTag; label: string; icon: string }[] = [
  { tag: 'FOOD_QUALITY', label: 'Food Taste / Quality', icon: '🍲' },
  { tag: 'SLOW_SERVICE', label: 'Slow Service / Wait Time', icon: '⏱️' },
  { tag: 'WRONG_ITEM', label: 'Wrong / Missing Item', icon: '🍽️' },
  { tag: 'CLEANLINESS', label: 'Cleanliness / Hygiene', icon: '🧹' },
  { tag: 'STAFF_BEHAVIOR', label: 'Staff Behavior', icon: '🧑‍🍳' },
  { tag: 'PORTION_SIZE', label: 'Portion Size', icon: '⚖️' },
  { tag: 'PRICING', label: 'Pricing / Value', icon: '💰' },
  { tag: 'AMBIENCE', label: 'Noise / Ambience', icon: '🔊' },
  { tag: 'OTHER', label: 'Other Issue', icon: '📝' }
];

const RATING_LABELS: Record<number, { title: string; subtitle: string; color: string }> = {
  1: { title: 'Very Disappointed', subtitle: 'We sincerely apologize. Tell us what went wrong so we can fix it table-side right now.', color: '#dc2626' },
  2: { title: 'Below Expectations', subtitle: 'Not up to our standards. Help our manager make this right for you before you leave.', color: '#ea580c' },
  3: { title: 'Average Experience', subtitle: 'What could our team have done to make your meal exceptional today?', color: '#d97706' },
  4: { title: 'Great Experience!', subtitle: 'We are delighted you enjoyed your time with us! Tell us what you loved.', color: '#16a34a' },
  5: { title: 'Outstanding!', subtitle: 'Thank you! You made our day. Share your 5-star love with other diners!', color: '#15803d' }
};

export function ReviewModal({
  isOpen,
  onClose,
  token,
  orderId,
  tableLabel = 'Your Table',
  googleReviewUrl,
  enableDishReviews = true,
  orderedDishes = [],
  onSuccess
}: Props) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<ReviewRootCauseTag[]>([]);
  const [comment, setComment] = useState('');
  const [dishRatings, setDishRatings] = useState<Record<string, { liked: boolean; name: string }>>({});
  const [submittedReviewId, setSubmittedReviewId] = useState<string | null>(null);
  const [googleClicked, setGoogleClicked] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const effectiveRating = hoverRating ?? rating;
  const isHighRating = rating >= 4;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const formattedDishRatings: DishRatingPayload[] = Object.entries(dishRatings).map(([menuItemId, val]) => ({
        menuItemId: menuItemId.startsWith('dish_') ? undefined : menuItemId,
        dishName: val.name,
        liked: val.liked
      }));

      const payload: SubmitReviewPayload = {
        orderId,
        rating,
        tags: rating <= 3 ? selectedTags : [],
        comment: comment.trim() || undefined,
        dishRatings: formattedDishRatings.length > 0 ? formattedDishRatings : undefined
      };

      const res = await api.post<{ success: boolean; review: { id: string; sentiment: string } }>(
        `/customer/reviews?token=${encodeURIComponent(token)}`,
        payload
      );
      return res.review;
    },
    onSuccess: (review) => {
      setSubmittedReviewId(review.id);
      onSuccess?.();
    },
    onError: (err: unknown) => {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not submit review. Please try again.');
    }
  });

  const handleGoogleClick = async () => {
    if (!googleReviewUrl) return;
    setGoogleClicked(true);
    if (submittedReviewId) {
      try {
        await api.patch(`/customer/reviews/${submittedReviewId}/google-click?token=${encodeURIComponent(token)}`, {});
      } catch (err) {
        console.warn('Could not record google click:', err);
      }
    }
    window.open(googleReviewUrl, '_blank', 'noopener,noreferrer');
  };

  const toggleTag = (tag: ReviewRootCauseTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleDishLike = (dishKey: string, dishName: string, liked: boolean) => {
    setDishRatings((prev) => {
      const existing = prev[dishKey];
      if (existing && existing.liked === liked) {
        const next = { ...prev };
        delete next[dishKey];
        return next;
      }
      return { ...prev, [dishKey]: { liked, name: dishName } };
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      title={submittedReviewId ? 'Thank You!' : 'Rate Your Experience'}
      onClose={onClose}
      width={520}
    >
      <div style={{ padding: '4px 0 12px' }}>
        {submittedReviewId ? (
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>
              {isHighRating ? '🎉' : '🙏'}
            </div>
            <h3 style={{ fontSize: 20, margin: '0 0 8px', color: isHighRating ? '#15803d' : '#991b1b' }}>
              {isHighRating ? 'Thank you so much!' : 'Your feedback was delivered to our manager.'}
            </h3>
            <p className="muted" style={{ fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
              {isHighRating
                ? 'Your feedback means the world to our chefs and floor team. We look forward to serving you again!'
                : 'Our duty manager has received your instant table alert. A staff member will attend to your table shortly to address your concerns.'}
            </p>

            {isHighRating && googleReviewUrl && (
              <div style={{ padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 20 }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#334155' }}>
                  Would you take 10 seconds to share this on Google Maps? It helps small restaurants like ours tremendously!
                </p>
                <button
                  type="button"
                  className="btn full"
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px 16px',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
                  }}
                  onClick={handleGoogleClick}
                >
                  <span>⭐</span>
                  <span>{googleClicked ? 'Opened Google Reviews' : 'Post 5 Stars on Google Maps'}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              className="btn secondary full"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                {tableLabel} · 15-Second Dining Feedback
              </span>
              <div
                style={{
                  display: 'inline-flex',
                  gap: 8,
                  margin: '8px 0',
                  userSelect: 'none'
                }}
                role="radiogroup"
                aria-label="Rating out of 5 stars"
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 36,
                      lineHeight: 1,
                      padding: 2,
                      transition: 'transform 0.15s ease',
                      transform: (hoverRating ?? rating) >= star ? 'scale(1.15)' : 'scale(1)',
                      color: (hoverRating ?? rating) >= star ? '#f59e0b' : '#cbd5e1'
                    }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setRating(star)}
                    aria-label={`${star} star${star === 1 ? '' : 's'}`}
                  >
                    ★
                  </button>
                ))}
              </div>

              {RATING_LABELS[effectiveRating] && (
                <div>
                  <strong style={{ display: 'block', fontSize: 16, color: RATING_LABELS[effectiveRating].color }}>
                    {RATING_LABELS[effectiveRating].title}
                  </strong>
                  <p className="muted" style={{ fontSize: 13, margin: '4px 0 0', lineHeight: 1.4 }}>
                    {RATING_LABELS[effectiveRating].subtitle}
                  </p>
                </div>
              )}
            </div>

            {/* Low rating branch: Root cause diagnostic tags */}
            {!isHighRating && (
              <div style={{ marginBottom: 18, background: '#fff7ed', border: '1px solid #fed7aa', padding: 14, borderRadius: 12 }}>
                <strong style={{ display: 'block', fontSize: 13, color: '#9a3412', marginBottom: 8 }}>
                  What caused this issue? (Select all that apply)
                </strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ROOT_CAUSE_OPTIONS.map((item) => {
                    const active = selectedTags.includes(item.tag);
                    return (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => toggleTag(item.tag)}
                        style={{
                          fontSize: 12,
                          padding: '6px 10px',
                          borderRadius: 20,
                          border: active ? '1.5px solid #ea580c' : '1px solid #fdba74',
                          background: active ? '#ea580c' : '#ffffff',
                          color: active ? '#ffffff' : '#7c2d12',
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dish-level feedback: Yumpingo style */}
            {enableDishReviews && orderedDishes.length > 0 && (
              <div style={{ marginBottom: 18, background: '#f8fafc', border: '1px solid #e2e8f0', padding: 14, borderRadius: 12 }}>
                <strong style={{ display: 'block', fontSize: 13, color: '#334155', marginBottom: 8 }}>
                  {isHighRating ? '🍲 Which dishes did you love most?' : '🍲 Were any specific dishes an issue?'}
                </strong>
                <div style={{ display: 'grid', gap: 8, maxHeight: 160, overflowY: 'auto' }}>
                  {orderedDishes.map((dish, i) => {
                    const key = dish.menuItemId || `dish_${i}`;
                    const currentRating = dishRatings[key];
                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          background: '#ffffff',
                          borderRadius: 8,
                          border: '1px solid #f1f5f9'
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                          {dish.name}
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            aria-label={`Like ${dish.name}`}
                            onClick={() => toggleDishLike(key, dish.name, true)}
                            style={{
                              background: currentRating?.liked === true ? '#dcfce7' : '#f8fafc',
                              border: currentRating?.liked === true ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                              borderRadius: 6,
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: 14
                            }}
                          >
                            👍
                          </button>
                          <button
                            type="button"
                            aria-label={`Dislike ${dish.name}`}
                            onClick={() => toggleDishLike(key, dish.name, false)}
                            style={{
                              background: currentRating?.liked === false ? '#fee2e2' : '#f8fafc',
                              border: currentRating?.liked === false ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
                              borderRadius: 6,
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: 14
                            }}
                          >
                            👎
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Note / Comments */}
            <div className="field" style={{ marginBottom: 18 }}>
              <label htmlFor="review-comment" style={{ fontSize: 12, fontWeight: 600 }}>
                {isHighRating
                  ? 'Compliment or special note for our team (optional)'
                  : 'Tell our floor manager what happened so we can assist (optional)'}
              </label>
              <textarea
                id="review-comment"
                className="textarea"
                rows={2}
                maxLength={500}
                placeholder={isHighRating ? 'e.g. The paneer tikka was extraordinary!' : 'e.g. Starters were cold and main course took 35 mins.'}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            {submitError && (
              <div className="form-error" style={{ marginBottom: 12 }}>
                {submitError}
              </div>
            )}

            {/* Action CTAs */}
            <div style={{ display: 'grid', gap: 10 }}>
              <button
                type="button"
                className="btn full"
                style={{
                  minHeight: 46,
                  fontWeight: 700,
                  fontSize: 14,
                  background: isHighRating ? 'var(--green, #315b43)' : '#dc2626',
                  color: '#ffffff'
                }}
                disabled={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending
                  ? 'Submitting…'
                  : isHighRating
                  ? 'Submit Review ✓'
                  : '🚨 Alert Duty Manager & Submit Feedback'}
              </button>

              <button
                type="button"
                className="btn ghost full"
                onClick={onClose}
              >
                Maybe later
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
