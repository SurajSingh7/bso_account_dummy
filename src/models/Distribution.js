import mongoose from 'mongoose';

// ─── Monthly Invoice Adjustment (per month per order) ─────────
const MonthlyAdjustmentSchema = new mongoose.Schema({
  month:           { type: String, required: true },   // "September 2025"
  invoiceNumber:   { type: String, default: '-' },
  invoiceDate:     { type: String, default: '-' },
  monthlyAmount:   { type: Number, default: 0 },  
  adjustedAmount:  { type: Number, default: 0 },       // amount paid toward this month
  remainingAmount: { type: Number, default: 0 },       // outstanding after this payment
  amountStatus: {
    type: String,
    enum: ['Fully Paid', 'Partially Paid', 'Not Paid'],
    default: 'Not Paid',
  },
}, { _id: false });

// ─── Per-Order Entry ──────────────────────────────────────────
const DistributionEntrySchema = new mongoose.Schema({
  orderId:     { type: String, required: true },
  companyName: { type: String, default: '' },
  state:       { type: String, default: '' },
  entity:      { type: String, default: '' },
  splitPct:    { type: Number, default: 100 },
  isSplit:     { type: Boolean, default: false },
  amount:      { type: Number, required: true, default: 0 },
  notes:       { type: String, default: '' },
  date:        { type: String, required: true },   // DD-MM-YYYY
  month:       { type: String, required: true },   // "January 2026"
  // ── NEW: month-wise invoice adjustment breakdown ─────────────
  monthlyAdjustments: { type: [MonthlyAdjustmentSchema], default: [] },
}, { _id: false });

// ─── Top-level Distribution Record ───────────────────────────
const DistributedPaymentSchema = new mongoose.Schema({
  companyGroup: { type: String, required: true, index: true },
  paymentType: {
    type: String,
    required: true,
    enum: ['receivedDetails', 'tdsProvision', 'tdsConfirm'],
    index: true,
  },
  paymentDate:  { type: String, required: true },   // DD-MM-YYYY
  billingMonth: { type: String, required: true },   // "January 2026"
  totalAmount:  { type: Number, required: true, default: 0 },
  notes:        { type: String, default: '' },
  entryCount:   { type: Number, default: 0 },
  paymentMethod: {
    type: String,
    default: 'cash',
    enum: ['cash', 'cheque', 'neft', 'upi'],
  },
  bankName:      { type: String, default: '' },
  chequeNumber:  { type: String, default: '' },
  chequeDate:    { type: String, default: '' },   // DD-MM-YYYY
  neftId:        { type: String, default: '' },
  transactionId: { type: String, default: '' },
  paymentNote:   { type: String, default: '' },
  entries: { type: [DistributionEntrySchema], default: [] },
}, { timestamps: true });

DistributedPaymentSchema.index({ companyGroup: 1, paymentType: 1, createdAt: -1 });
DistributedPaymentSchema.index({ billingMonth: 1, createdAt: -1 });
DistributedPaymentSchema.index({ paymentDate: 1 });

export default mongoose.models.DistributedPayment ||
  mongoose.model('DistributedPayment', DistributedPaymentSchema);