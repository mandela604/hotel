/**
 * Grace Hotel — Data Service
 * Generic CRUD + query helpers used across all modules.
 */

const models = require('../database/models');

async function getByKey(modelName, key, value) {
  const Model = models[modelName];
  if (!Model) throw { statusCode: 404, message: 'Model not found' };
  const doc = await Model.findOne({ [key]: value });
  if (!doc) throw { statusCode: 404, message: 'Not found' };
  return doc;
}

async function getAll(modelName, filter = {}) {
  const Model = models[modelName];
  if (!Model) throw { statusCode: 404, message: 'Model not found' };
  return await Model.find(filter);
}

async function createOne(modelName, data) {
  const Model = models[modelName];
  if (!Model) throw { statusCode: 404, message: 'Model not found' };
  const doc = await Model.create(data);
  return doc;
}

async function updateOne(modelName, id, updates) {
  const Model = models[modelName];
  if (!Model) throw { statusCode: 404, message: 'Model not found' };
  const doc = await Model.findOneAndUpdate({ id }, updates, { new: true });
  if (!doc) throw { statusCode: 404, message: 'Not found' };
  return doc;
}

async function deleteOne(modelName, id) {
  const Model = models[modelName];
  if (!Model) throw { statusCode: 404, message: 'Model not found' };
  const doc = await Model.findOneAndDelete({ id });
  if (!doc) throw { statusCode: 404, message: 'Not found' };
  return doc;
}

module.exports = { getByKey, getAll, createOne, updateOne, deleteOne };