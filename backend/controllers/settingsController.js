const Config = require('../models/Config');
const asyncHandler = require('../middleware/asyncHandler');

exports.get = asyncHandler(async (req, res) => {
  let config = await Config.findOne();
  if (!config) {
    config = await Config.create({});
  }
  // Back-fill fields that may be missing from documents created before the schema was updated
  let dirty = false;
  if (!config.paymentMethods || !config.paymentMethods.length) {
    config.paymentMethods = ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'];
    dirty = true;
  }
  if (typeof config.shiftStartHour !== 'number') { config.shiftStartHour = 9; dirty = true; }
  if (typeof config.shiftEndHour !== 'number') { config.shiftEndHour = 8; dirty = true; }
  if (dirty) await config.save();
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
