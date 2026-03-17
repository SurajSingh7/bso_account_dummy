import mongoose from 'mongoose';

const BillingSchema = new mongoose.Schema({
  address:   { type: String, default: '' },
  area:      { type: String, default: '' },
  city:      { type: String, default: '' },
  pincode:   { type: String, default: '' },
  state:     { type: String, default: '' },
  stateCode: { type: String, default: '' },
}, { _id: false });

const GSTDetailsSchema = new mongoose.Schema({
  isSelfGST:    { type: Boolean, required: true, default: false },
  igst:         { type: Number, default: 0, min: 0, max: 100 },
  cgst:         { type: Number, default: 0, min: 0, max: 100 },
  sgst:         { type: Number, default: 0, min: 0, max: 100 },
  gstState:     { type: String, default: '' },
  gstStateCode: { type: String, default: '' },
}, { _id: false });

const SplitFactorSchema = new mongoose.Schema({
  isApplicable:     { type: Boolean, default: false },
  state1Percentage: { type: Number,  default: 50, min: 0, max: 100 },
  state2Percentage: { type: Number,  default: 50, min: 0, max: 100 },
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  orderId:      { type: String, required: true, unique: true },
  companyName:  { type: String, required: true },
  companyGroup: { type: String, required: true },
  entity:       { type: String, required: true },
  product:      { type: String, required: true },
  bso:          { type: String, default: '' },        // ← NEW: BSO field
  orderType:    { type: String, required: true },
  status:       { type: String, required: true },
  capacity:     { type: String, default: '' },
  lsiId:        { type: String, default: '' },
  amount:       { type: Number, default: 0 },
  pcdDate:      { type: Date,   default: null },
  terminateDate:{ type: Date,   default: null },
  endA:         { type: String, default: '' },
  endB:         { type: String, default: '' },
  billing1:     { type: BillingSchema, default: () => ({}) },
  billing2:     { type: BillingSchema, default: () => ({}) },

  // ─── GST ─────────────────────────────────────────────────────────────────
  // gstDetails1 → always used (primary / billing-1 for NLD split)
  // gstDetails2 → only used when product=NLD and billing states differ
  // gstDetails  → kept for backward-compatibility with old records
  gstDetails:  { type: GSTDetailsSchema, default: () => ({}) }, // legacy
  gstDetails1: { type: GSTDetailsSchema, default: () => ({}) },
  gstDetails2: { type: GSTDetailsSchema, default: () => ({}) },

  splitFactor: { type: SplitFactorSchema, default: () => ({}) },
}, {
  timestamps: true,
});

OrderSchema.index({ orderId:     1 });
OrderSchema.index({ companyName: 1 });
OrderSchema.index({ status:      1 });

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);