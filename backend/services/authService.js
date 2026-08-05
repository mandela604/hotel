/**
 * Grace Hotel — Auth Service
 * Business logic for login, signup, user management.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const models = require('../database/models');

async function login({ email, password }) {
  const user = await models.User.findOne({ email: email.toLowerCase(), status: 'active' });
  if (!user) throw { statusCode: 401, message: 'Invalid credentials.' };

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw { statusCode: 401, message: 'Invalid credentials.' };

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'grace-hotel-jwt-secret-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      initials: user.initials,
      phone: user.phone,
    },
  };
}

async function signup({ name, email, password, role = 'sales_rep', phone, initials }) {
  const existing = await models.User.findOne({ email: email.toLowerCase() });
  if (existing) throw { statusCode: 409, message: 'Email already registered.' };

  const hashed = await bcrypt.hash(password, 10);
  const user = await models.User.create({
    id: uuidv4(),
    name,
    email: email.toLowerCase(),
    password: hashed,
    role,
    phone,
    initials,
  });

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'grace-hotel-jwt-secret-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      initials: user.initials,
      phone: user.phone,
    },
  };
}

async function getUsers() {
  return await models.User.find({}).select('-password').sort({ createdAt: -1 });
}

module.exports = { login, signup, getUsers };