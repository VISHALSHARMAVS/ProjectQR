import { randomBytes } from 'node:crypto';
import { connectDatabase } from './config/database.js';
import { Category } from './models/Category.js';
import { DiningTable } from './models/DiningTable.js';
import { MenuItem } from './models/MenuItem.js';
import { Restaurant } from './models/Restaurant.js';
import { User } from './models/User.js';
import { hashPassword } from './services/password.js';

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('The demo seed cannot run in production.');
  await connectDatabase();
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase() || 'owner@projectqr.local';
  const password = process.env.SEED_OWNER_PASSWORD || randomBytes(12).toString('base64url');
  let restaurant = await Restaurant.findOne({ slug: 'projectqr-demo' });
  if (!restaurant) restaurant = await Restaurant.create({ name: 'The Green Fork', slug: 'projectqr-demo', description: 'A demo restaurant for testing dine-in ordering.' });
  let owner = await User.findOne({ email });
  const createdOwner = !owner;
  if (owner && String(owner.restaurantId) !== String(restaurant._id)) throw new Error('SEED_OWNER_EMAIL is already used by a different restaurant. Choose another email.');
  if (!owner) owner = await User.create({ restaurantId: restaurant._id, name: 'Demo Owner', email, passwordHash: await hashPassword(password), role: 'owner' });
  else if (process.env.SEED_OWNER_PASSWORD) {
    owner.passwordHash = await hashPassword(password);
    await owner.save();
  }
  const categoryCount = await Category.countDocuments({ restaurantId: restaurant._id });
  if (!categoryCount) {
    const [starters, mains, drinks] = await Category.create([
      { restaurantId: restaurant._id, name: 'Small plates', description: 'A little something to start', displayOrder: 1 },
      { restaurantId: restaurant._id, name: 'From the kitchen', description: 'Our favourite mains', displayOrder: 2 },
      { restaurantId: restaurant._id, name: 'Drinks', description: 'Made fresh to order', displayOrder: 3 }
    ]);
    await MenuItem.create([
      { restaurantId: restaurant._id, categoryId: starters!._id, name: 'Crispy lotus stem', description: 'Tossed with chilli, sesame and a squeeze of lime.', pricePaise: 24500, available: true, preparationMinutes: 12 },
      { restaurantId: restaurant._id, categoryId: mains!._id, name: 'Paneer tikka bowl', description: 'Charred paneer, fragrant rice and mint yoghurt.', pricePaise: 36500, available: true, preparationMinutes: 18 },
      { restaurantId: restaurant._id, categoryId: drinks!._id, name: 'Nimbu soda', description: 'Fresh lime, soda and a little rock salt.', pricePaise: 9000, available: true, preparationMinutes: 4 }
    ]);
  }
  if (!await DiningTable.exists({ restaurantId: restaurant._id })) {
    await DiningTable.create({ restaurantId: restaurant._id, label: '1', qrToken: randomBytes(24).toString('base64url') });
  }
  console.info('Demo restaurant is ready.');
  console.info(`Owner email: ${owner.email}`);
  if (createdOwner || process.env.SEED_OWNER_PASSWORD) console.info(`Owner password: ${password}`);
  else console.info('Existing owner password left unchanged. Set SEED_OWNER_PASSWORD to reset it.');
  console.info(`Customer OTP mode: ${process.env.OTP_MODE || 'mock'} (development only)`);
  process.exit(0);
}

seed().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
