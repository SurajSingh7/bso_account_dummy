import mongoose from 'mongoose';

const ReceivedDetailSchema = new mongoose.Schema({
  date: { type: String, required: true }, // format: DD-MM-YYYY
  amount: { type: Number, required: true, default: 0 },
  notes: { type: String, default: '' }
}, { _id: false });

const MiscellaneousSellSchema = new mongoose.Schema({
  date: { type: String, required: true },
  amount: { type: Number, required: true, default: 0 },
  cgst: { type: Number, default: 0 }, // CGST amount for this item
  sgst: { type: Number, default: 0 }, // SGST amount for this item
  igst: { type: Number, default: 0 }, // IGST amount for this item
  totalWithGst: { type: Number, default: 0 }, // amount + cgst + sgst + igst
  notes: { type: String, default: '' }
}, { _id: false });

const TdsProvisionSchema = new mongoose.Schema({
  date: { type: String, required: true },
  amount: { type: Number, required: true, default: 0 },
  notes: { type: String, default: '' }
}, { _id: false });

const TdsConfirmSchema = new mongoose.Schema({
  date: { type: String, required: true },
  amount: { type: Number, required: true, default: 0 },
  notes: { type: String, default: '' }
}, { _id: false });

const CreditNoteSchema = new mongoose.Schema({
  date: { type: String, required: true },       // Submit date: DD-MM-YYYY
  periodStart: { type: String, default: '' },   // Period start: DD-MM-YYYY (within billing month)
  periodEnd: { type: String, default: '' },     // Period end: DD-MM-YYYY (within billing month)
  amount: { type: Number, required: true, default: 0 }, // Auto-calculated from period
  cgst: { type: Number, default: 0 },           // CGST amount for this credit note
  sgst: { type: Number, default: 0 },           // SGST amount for this credit note
  igst: { type: Number, default: 0 },           // IGST amount for this credit note
  totalWithGst: { type: Number, default: 0 },   // amount + cgst + sgst + igst
  invoiceNumber: { type: String, default: '' }, // Pre-filled with current billing month
  notes: { type: String, default: '' }
}, { _id: false });

const MonthlyBillingSchema = new mongoose.Schema({
  orderId: { type: String, required: true, index: true },
  month: { type: String, required: true }, // format: "January 2026"
  startDate: { type: String, required: true }, // format: DD-MM-YYYY
  endDate: { type: String, required: true }, // format: DD-MM-YYYY
  billingDays: { type: Number, required: true },
  perDayRate: { type: Number, required: true },
  
  receivedDetails: { type: [ReceivedDetailSchema], default: [] },
  miscellaneousSell: { type: [MiscellaneousSellSchema], default: [] },
  tdsProvision: { type: [TdsProvisionSchema], default: [] },
  tdsConfirm: { type: [TdsConfirmSchema], default: [] },
  creditNotes: { type: [CreditNoteSchema], default: [] },
  
  monthlyBilling: { type: Number, required: true }, // Base amount without GST
  cgst: { type: Number, default: 0 }, // CGST 9% of monthlyBilling
  sgst: { type: Number, default: 0 }, // SGST 9% of monthlyBilling
  igst: { type: Number, default: 0 }, // IGST 18% of monthlyBilling
  totalWithGst: { type: Number, required: true }, // monthlyBilling + cgst + sgst + igst
  invoiceNumber: { type: String, default: '' },
  invoiceDate: { type: String, default: '' }, 
  
  // GST Details from order
  isSelfGST: { type: Boolean, default: false },
  gstState: { type: String, default: '' },
  gstStateCode: { type: String, default: '' },
  
  // Additional fields for tracking
  state: { type: String, default: '' },
  splitKey: { type: String, default: '100' }, // '100' or '50' for split billing
  splitPercentage: { type: Number, default: 100 }, // Percentage from splitFactor
  capacity: { type: Number, default: 0 },
  companyName: { type: String, default: '' },
  
  // Status tracking
  status: { 
    type: String, 
    enum: ['draft', 'generated', 'invoiced', 'paid'], 
    default: 'generated' 
  },
  
  isPcdMonth: { type: Boolean, default: false },
  isTerminateMonth: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Compound index for efficient querying
MonthlyBillingSchema.index({ orderId: 1, month: 1, state: 1, splitKey: 1 }, { unique: true });

export default mongoose.models.MonthlyBilling || mongoose.model('MonthlyBilling', MonthlyBillingSchema);