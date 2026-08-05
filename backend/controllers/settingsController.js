const Config = require('../database/models/Config');
const asyncHandler = require('../middleware/asyncHandler');

// GET /api/settings
exports.getSettings = asyncHandler(async (req, res) => {
  const configs = await Config.find();
  const settings = {};
  for (const c of configs) {
    settings[c.key] = c.value;
  }
  res.json(settings);
});

// PUT /api/settings
exports.updateSettings = asyncHandler(async (req, res) => {
  const updates = req.body || {};
  const ops = [];

  for (const [key, value] of Object.entries(updates)) {
    ops.push({
      updateOne: {
        filter: { key },
        update: { $set: { value } },
        upsert: true,
      },
    });
  }

  if (ops.length) await Config.bulkWrite(ops);

  const configs = await Config.find();
  const settings = {};
  for (const c of configs) {
    settings[c.key] = c.value;
  }
  res.json(settings);
});
