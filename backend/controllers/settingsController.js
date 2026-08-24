const Config = require('../models/Config');
const asyncHandler = require('../middleware/asyncHandler');

exports.get = asyncHandler(async (req, res) => {
  let config = await Config.findOne();
  if (!config) {
    config = await Config.create({});
  }
  res.json({ success: true, data: config });
});

exports.update = asyncHandler(async (req, res) => {
  let config = await Config.findOne();
  if (!config) {
    config = await Config.create(req.body);
  } else {
    Object.assign(config, req.body);
    await config.save();
  }
  res.json({ success: true, data: config });
});
