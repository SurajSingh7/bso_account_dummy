// models/BsoTdsConfig.js

import mongoose from 'mongoose';

const BsoTdsConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'BSO name is required'],
      trim: true,
      unique: true,
    },
    tds: {
      type: Number,
      required: [true, 'TDS percentage is required'],
      min: [0, 'TDS cannot be negative'],
      max: [100, 'TDS cannot exceed 100%'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const BsoTdsConfig =
  mongoose.models.BsoTdsConfig ||
  mongoose.model('BsoTdsConfig', BsoTdsConfigSchema);

export default BsoTdsConfig;