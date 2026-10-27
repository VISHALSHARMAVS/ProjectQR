import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Category } from '../models/Category.js';
import { MenuItem } from '../models/MenuItem.js';
import { requireRoles, requireStaff } from '../middleware/auth.js';
import { saveMenuImage } from '../services/imageStorage.js';
import { AppError } from '../utils/errors.js';
import { objectIdSchema } from '../utils/validation.js';
import { tenantFilter } from '../utils/tenant.js';

export const categoryRouter = Router();
const categoryInput = z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(300).default(''), displayOrder: z.number().int().min(0).max(10000).default(0), active: z.boolean().default(true) });
const categoryPatch = categoryInput.partial();

categoryRouter.use(requireStaff, requireRoles('owner', 'staff'));
categoryRouter.get('/', async (req, res) => {
  const categories = await Category.find(tenantFilter(req.staff!.restaurantId)).sort({ displayOrder: 1, name: 1 }).lean();
  res.json({ categories });
});
categoryRouter.post('/', async (req, res) => {
  const parsed = categoryInput.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid category.');
  const category = await Category.create({ ...parsed.data, restaurantId: req.staff!.restaurantId });
  res.status(201).json({ category });
});
categoryRouter.patch('/:id', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid category identifier.');
  const parsed = categoryPatch.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) throw new AppError(400, 'INVALID_INPUT', 'Provide at least one valid category field.');
  const category = await Category.findOneAndUpdate(tenantFilter(req.staff!.restaurantId, { _id: req.params.id }), parsed.data, { returnDocument: 'after', runValidators: true });
  if (!category) throw new AppError(404, 'NOT_FOUND', 'Category not found.');
  res.json({ category });
});
categoryRouter.delete('/:id', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid category identifier.');
  const category = await Category.findOne(tenantFilter(req.staff!.restaurantId, { _id: req.params.id }));
  if (!category) throw new AppError(404, 'NOT_FOUND', 'Category not found.');
  if (await MenuItem.exists(tenantFilter(req.staff!.restaurantId, { categoryId: category._id }))) throw new AppError(409, 'CATEGORY_HAS_ITEMS', 'Move or delete this category’s menu items before deleting it.');
  await category.deleteOne();
  res.status(204).end();
});

export const menuRouter = Router();
const imageUrlSchema = z.string().trim().max(2048).refine((value) => !value || value.startsWith('/uploads/') || /^https:\/\//i.test(value), 'Use an HTTPS image URL or an uploaded image');
const menuFields = {
  categoryId: objectIdSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
  pricePaise: z.number().int().min(0).max(100000000),
  imageUrl: imageUrlSchema.default(''),
  available: z.boolean().default(true),
  preparationMinutes: z.number().int().min(1).max(600).nullable().default(null),
  displayOrder: z.number().int().min(0).max(10000).default(0)
};
const menuInput = z.object(menuFields);
const menuPatch = menuInput.partial();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

menuRouter.use(requireStaff, requireRoles('owner', 'staff'));
menuRouter.get('/', async (req, res) => {
  const items = await MenuItem.find(tenantFilter(req.staff!.restaurantId)).sort({ displayOrder: 1, name: 1 }).lean();
  res.json({ items });
});
menuRouter.post('/', async (req, res) => {
  const parsed = menuInput.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid menu item.');
  const category = await Category.findOne(tenantFilter(req.staff!.restaurantId, { _id: parsed.data.categoryId }));
  if (!category) throw new AppError(400, 'INVALID_CATEGORY', 'Choose a category belonging to this restaurant.');
  const item = await MenuItem.create({ ...parsed.data, restaurantId: req.staff!.restaurantId });
  res.status(201).json({ item });
});
menuRouter.patch('/:id', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid menu item identifier.');
  const parsed = menuPatch.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) throw new AppError(400, 'INVALID_INPUT', 'Provide at least one valid menu item field.');
  if (parsed.data.categoryId) {
    const category = await Category.findOne(tenantFilter(req.staff!.restaurantId, { _id: parsed.data.categoryId }));
    if (!category) throw new AppError(400, 'INVALID_CATEGORY', 'Choose a category belonging to this restaurant.');
  }
  const item = await MenuItem.findOneAndUpdate(tenantFilter(req.staff!.restaurantId, { _id: req.params.id }), parsed.data, { returnDocument: 'after', runValidators: true });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Menu item not found.');
  res.json({ item });
});
menuRouter.delete('/:id', async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid menu item identifier.');
  const item = await MenuItem.findOneAndDelete(tenantFilter(req.staff!.restaurantId, { _id: req.params.id }));
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Menu item not found.');
  res.status(204).end();
});
menuRouter.post('/:id/image', requireRoles('owner', 'staff'), upload.single('image'), async (req, res) => {
  if (!objectIdSchema.safeParse(req.params.id).success) throw new AppError(400, 'INVALID_ID', 'Invalid menu item identifier.');
  if (!req.file) throw new AppError(400, 'IMAGE_REQUIRED', 'Choose an image file to upload.');
  const item = await MenuItem.findOne(tenantFilter(req.staff!.restaurantId, { _id: req.params.id }));
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Menu item not found.');
  item.imageUrl = await saveMenuImage(req.file.buffer);
  await item.save();
  res.json({ item });
});
