/**
 * Grace Hotel — Shared base schema for all models
 * - UUIDv4 `id`
 * - `createdAt` / `updatedAt`
 * - `toJSON`/`toObject` transform that hides Mongoose `_id` and `__v`
 */

const { v4: uuidv4 } = require('uuid');

const baseFields = {
  id: { type: String, default: () => uuidv4(), unique: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
};

const transform = (doc, ret) => {
  ret.id = ret.id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const basePlugin = (schema) => {
  schema.add(baseFields);
  schema.set('toJSON', transform);
  schema.set('toObject', transform);
};

module.exports = { baseFields, transform, basePlugin };