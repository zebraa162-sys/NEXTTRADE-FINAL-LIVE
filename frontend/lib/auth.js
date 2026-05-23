import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';

const SECRET = process.env.JWT_SECRET || 'dev_secret';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}

export function getTokenFromRequest(req) {
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export async function getUserFromRequest(req) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const db = await getDb();
  const user = await db.collection('users').findOne({ id: payload.id });
  return user;
}

export async function ensureSeedUsers() {
  const db = await getDb();
  const users = db.collection('users');
  const settings = db.collection('settings');

  const existingAdmin = await users.findOne({ email: 'admin@trading.com' });
  if (!existingAdmin) {
    await users.insertOne({
      id: uuidv4(),
      email: 'admin@trading.com',
      passwordHash: await bcrypt.hash('password', 8),
      name: 'Administrator',
      role: 'admin',
      demoBalance: 10000,
      liveBalance: 0,
      activeAccount: 'demo',
      createdAt: new Date()
    });
  }

  const existingMaster = await users.findOne({ email: 'masteruser@trading.com' });
  if (!existingMaster) {
    await users.insertOne({
      id: uuidv4(),
      email: 'masteruser@trading.com',
      passwordHash: await bcrypt.hash('password', 8),
      name: 'Master User',
      role: 'user',
      demoBalance: 10000,
      liveBalance: 0,
      activeAccount: 'demo',
      createdAt: new Date()
    });
  }

  const s = await settings.findOne({ id: 'global' });
  if (!s) {
    await settings.insertOne({
      id: 'global',
      winRatio: 0.2, // global probability that a winning trade is allowed; house edge 80%
      payoutRate: 1.8,
      updatedAt: new Date()
    });
  }
}

export async function hashPassword(p) { return bcrypt.hash(p, 8); }
export async function comparePassword(p, h) { return bcrypt.compare(p, h); }
