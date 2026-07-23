const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  creatorId:      { type: String, required: true, index: true },
  title:          { type: String, required: true, maxlength: 20 },
  description:    { type: String, default: '', maxlength: 50 },
  link:           { type: String, required: true },
  coreAmount:     { type: Number, required: true },
  maxClicks:      { type: Number, required: true },
  clickCount:     { type: Number, default: 0 },
  rewardPerClick: { type: Number, default: 50 },
  completedBy:    [{ type: String }],
  status:         { type: String, enum: ['active', 'completed'], default: 'active' },
  createdAt:      { type: Date, default: Date.now },
});

module.exports = mongoose.model('Task', taskSchema);
