const mongoose = require('mongoose');

const halvingSchema = new mongoose.Schema({
  halvingCount:   { type: Number, default: 0 },
  cycleWithdrawn: { type: Number, default: 0 },
}, { versionKey: false });

halvingSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model('Halving', halvingSchema);
