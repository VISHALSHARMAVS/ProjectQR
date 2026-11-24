import { Router } from 'express';
import { z } from 'zod';
import { requireCustomer, requireCustomerQr, requireStaff } from '../middleware/auth.js';
import { Customer } from '../models/Customer.js';
import { DiningTable } from '../models/DiningTable.js';
import { Order } from '../models/Order.js';
import { Restaurant } from '../models/Restaurant.js';
import { Review, type ReviewDoc } from '../models/Review.js';
import { AppError } from '../utils/errors.js';
import { objectIdSchema } from '../utils/validation.js';
import { tenantFilter } from '../utils/tenant.js';
import { getOrderSocket } from './orders.js';

export const customerReviewRouter = Router();
export const restaurantReviewRouter = Router();

const createReviewSchema = z.object({
  token: z.string().optional(),
  orderId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string()).default([]),
  comment: z.string().trim().max(500).default(''),
  dishRatings: z.array(z.object({
    menuItemId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    dishName: z.string().trim().optional(),
    name: z.string().trim().optional(),
    liked: z.boolean().optional(),
    thumbsUp: z.boolean().optional()
  })).default([])
});

customerReviewRouter.use(requireCustomer, requireCustomerQr);

customerReviewRouter.post('/', async (req, res) => {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Please choose a rating score.');

  const [table, restaurant, customer] = await Promise.all([
    DiningTable.findById(req.customer!.tableId).select('label'),
    Restaurant.findById(req.customer!.restaurantId).select('name googleReviewUrl brandColor'),
    Customer.findById(req.customer!.customerId).select('name phone')
  ]);

  if (!table || !restaurant) throw new AppError(404, 'NOT_FOUND', 'Table or restaurant not found.');

  const rating = parsed.data.rating;
  const sentiment = rating >= 4 ? 'POSITIVE' : rating === 3 ? 'NEUTRAL' : 'NEGATIVE';

  let orderNumber = '';
  if (parsed.data.orderId) {
    const order = await Order.findById(parsed.data.orderId).select('orderNumber');
    if (order) orderNumber = order.orderNumber;
  }

  const mappedDishRatings = parsed.data.dishRatings.map((d) => ({
    menuItemId: d.menuItemId || null,
    name: d.dishName || d.name || 'Dish',
    thumbsUp: d.liked !== undefined ? d.liked : (d.thumbsUp !== undefined ? d.thumbsUp : true)
  }));

  const review = await Review.create({
    restaurantId: req.customer!.restaurantId,
    tableId: req.customer!.tableId,
    tableLabel: table.label,
    orderId: parsed.data.orderId || null,
    orderNumber,
    customerId: req.customer!.customerId,
    customerName: customer?.name || 'Guest',
    customerPhone: customer?.phone || '',
    rating,
    sentiment,
    tags: parsed.data.tags,
    comment: parsed.data.comment,
    dishRatings: mappedDishRatings,
    status: 'NEW'
  });

  const socket = getOrderSocket();

  // If negative or neutral experience (<= 3 stars), trigger instant Table-Side Manager Alert!
  if (rating <= 3) {
    socket?.to(`restaurant:${req.customer!.restaurantId}`).emit('review:alert', {
      id: String(review._id),
      tableLabel: table.label,
      rating,
      sentiment,
      tags: review.tags,
      comment: review.comment,
      customerName: review.customerName,
      createdAt: review.createdAt
    });
  }

  res.status(201).json({
    success: true,
    review: {
      id: String(review._id),
      rating: review.rating,
      sentiment: review.sentiment,
      tags: review.tags,
      comment: review.comment
    },
    googleReviewUrl: restaurant.googleReviewUrl || '',
    message: rating >= 4
      ? 'Thank you! Would you mind sharing your love on Google?'
      : 'Thank you for your candid feedback. Our manager has been alerted to make this right.'
  });
});

customerReviewRouter.patch('/:id/google-click', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid review identifier.');
  await Review.updateOne(
    { _id: req.params.id, restaurantId: req.customer!.restaurantId },
    { $set: { postedToGoogle: true } }
  );
  res.json({ success: true, googleReviewClicked: true });
});

restaurantReviewRouter.use(requireStaff);

restaurantReviewRouter.get('/', async (req, res) => {
  const reviews = await Review.find(tenantFilter(req.staff!.restaurantId))
    .sort({ createdAt: -1 })
    .limit(100) as unknown as ReviewDoc[];

  let totalRatingSum = 0;
  let positiveCount = 0;
  let neutralCount = 0;
  let negativeCount = 0;
  let googleRedirectCount = 0;
  let unresolvedComplaints = 0;
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const dishMap = new Map<string, { dishName: string; thumbsUp: number; thumbsDown: number }>();

  for (const rev of reviews) {
    totalRatingSum += rev.rating;
    ratingDistribution[rev.rating] = (ratingDistribution[rev.rating] || 0) + 1;
    if (rev.sentiment === 'POSITIVE') positiveCount++;
    else if (rev.sentiment === 'NEUTRAL') neutralCount++;
    else if (rev.sentiment === 'NEGATIVE') negativeCount++;
    if (rev.postedToGoogle) googleRedirectCount++;
    if (rev.status !== 'RESOLVED' && rev.rating <= 3) unresolvedComplaints++;

    for (const d of rev.dishRatings || []) {
      const key = d.name;
      if (!dishMap.has(key)) {
        dishMap.set(key, { dishName: d.name, thumbsUp: 0, thumbsDown: 0 });
      }
      const entry = dishMap.get(key)!;
      if (d.thumbsUp) entry.thumbsUp++;
      else entry.thumbsDown++;
    }
  }

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? Number((totalRatingSum / totalReviews).toFixed(1)) : 5.0;
  const googleClickConversionRate = positiveCount > 0 ? Math.round((googleRedirectCount / positiveCount) * 100) : 0;

  const dishLeaderboard = Array.from(dishMap.values())
    .map((item) => {
      const totalVotes = item.thumbsUp + item.thumbsDown;
      return {
        dishName: item.dishName,
        thumbsUp: item.thumbsUp,
        thumbsDown: item.thumbsDown,
        totalVotes,
        satisfactionRate: totalVotes > 0 ? Math.round((item.thumbsUp / totalVotes) * 100) : 100
      };
    })
    .sort((a, b) => b.totalVotes - a.totalVotes);

  res.json({
    summary: {
      averageRating,
      totalReviews,
      ratingDistribution,
      sentimentCounts: {
        POSITIVE: positiveCount,
        NEUTRAL: neutralCount,
        NEGATIVE: negativeCount
      },
      unresolvedComplaints,
      googleClicks: googleRedirectCount,
      googleClickConversionRate
    },
    dishLeaderboard,
    reviews: reviews.map((r) => ({
      id: String(r._id),
      tableLabel: r.tableLabel,
      orderNumber: r.orderNumber,
      customerName: r.customerName,
      rating: r.rating,
      sentiment: r.sentiment,
      tags: r.tags,
      comment: r.comment,
      dishRatings: (r.dishRatings || []).map((d) => ({
        dishName: d.name,
        liked: d.thumbsUp,
        comment: ''
      })),
      googleReviewClicked: Boolean(r.postedToGoogle),
      resolved: r.status === 'RESOLVED',
      resolutionNote: r.resolutionNote || '',
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : undefined,
      createdAt: r.createdAt
    }))
  });
});

const resolveReviewSchema = z.object({
  resolutionNote: z.string().trim().min(2).max(500)
});

restaurantReviewRouter.patch('/:id/resolve', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid review identifier.');
  const parsed = resolveReviewSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Please provide a short resolution note.');

  const review = await Review.findOneAndUpdate(
    tenantFilter(req.staff!.restaurantId, { _id: req.params.id }),
    {
      $set: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: req.staff!.id,
        resolutionNote: parsed.data.resolutionNote
      }
    },
    { returnDocument: 'after' }
  ) as unknown as ReviewDoc | null;

  if (!review) throw new AppError(404, 'NOT_FOUND', 'Review not found.');

  res.json({
    success: true,
    review: {
      id: String(review._id),
      resolved: true,
      status: review.status,
      resolutionNote: review.resolutionNote,
      resolvedAt: review.resolvedAt
    }
  });
});
