import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import MonthlyBilling from '@/models/MonthlyBilling';
import Order from '@/models/Order';

// ─── Date helpers ─────────────────────────────────────────────
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'string' && (dateStr.includes('T') || dateStr.includes('Z'))) {
    return new Date(dateStr);
  }
  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3 && parseInt(parts[0]) <= 31) {
      const [day, month, year] = parts.map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  }
  return new Date(dateStr);
};

const formatDate = (date) => {
  if (!date) return '';
  if (!(date instanceof Date)) date = new Date(date);
  const day   = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year  = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const formatMonthYear = (month, year) => `${MONTH_NAMES[month]} ${year}`;

// Parse "February 2026" → { month: 1, year: 2026 }
const parseMonthYear = (monthYearStr) => {
  if (!monthYearStr) return null;
  const parts = monthYearStr.trim().split(' ');
  if (parts.length !== 2) return null;
  const month = MONTH_NAMES.indexOf(parts[0]);
  const year  = parseInt(parts[1]);
  if (month === -1 || isNaN(year)) return null;
  return { month, year };
};

const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

const generateInvoiceNumber = (billing, index = 0) => {
  const date  = new Date();
  const year  = date.getFullYear().toString().substr(-2);
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day   = ('0' + date.getDate()).slice(-2);
  const timestamp = (Date.now() + index).toString().slice(-6);
  const stateCode = billing.state ? billing.state.substring(0, 3).toUpperCase() : 'XXX';
  return `INV-${year}${month}${day}-${stateCode}-${timestamp}`;
};

// ─── Invoice date = startDate + 1 day ─────────────────────────
// Full month (startDay=1)  → 2nd of month
// Partial month (e.g. startDay=17) → 18th
const calcInvoiceDate = (startDateStr) => {
  const d = parseDate(startDateStr);
  if (!d) return '';
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  return formatDate(next);
};

// ─── GST recalculation helpers ─────────────────────────────────
const recalcCreditNotes = (creditNotes, isSelfGST) => {
  if (!creditNotes?.length) return [];
  return creditNotes.map((cn) => {
    const amt = Number(cn.amount) || 0;
    const needsRecalc = amt > 0 && (
      (Number(cn.totalWithGst) || 0) === 0 ||
      (isSelfGST  && (Number(cn.cgst) || 0) === 0 && (Number(cn.igst) || 0) > 0) ||
      (!isSelfGST && (Number(cn.igst) || 0) === 0 && (Number(cn.cgst) || 0) > 0)
    );
    if (needsRecalc) {
      const cgst = isSelfGST ? Math.round(amt * 0.09 * 100) / 100 : 0;
      const sgst = isSelfGST ? Math.round(amt * 0.09 * 100) / 100 : 0;
      const igst = isSelfGST ? 0 : Math.round(amt * 0.18 * 100) / 100;
      return { date: cn.date||'', periodStart: cn.periodStart||'', periodEnd: cn.periodEnd||'',
        amount: amt, cgst, sgst, igst, totalWithGst: Math.round((amt+cgst+sgst+igst)*100)/100,
        invoiceNumber: cn.invoiceNumber||'', notes: cn.notes||'' };
    }
    return { date: cn.date||'', periodStart: cn.periodStart||'', periodEnd: cn.periodEnd||'',
      amount: amt, cgst: Number(cn.cgst)||0, sgst: Number(cn.sgst)||0, igst: Number(cn.igst)||0,
      totalWithGst: Number(cn.totalWithGst)||0, invoiceNumber: cn.invoiceNumber||'', notes: cn.notes||'' };
  });
};

const recalcMiscSell = (miscellaneousSell, isSelfGST) => {
  if (!miscellaneousSell?.length) return [];
  return miscellaneousSell.map((item) => {
    const amt = Number(item.amount) || 0;
    const needsRecalc = amt > 0 && (Number(item.totalWithGst) || 0) === 0;
    if (needsRecalc) {
      const cgst = isSelfGST ? Math.round(amt*0.09*100)/100 : 0;
      const sgst = isSelfGST ? Math.round(amt*0.09*100)/100 : 0;
      const igst = isSelfGST ? 0 : Math.round(amt*0.18*100)/100;
      return { date: item.date||'', amount: amt, cgst, sgst, igst,
        totalWithGst: Math.round((amt+cgst+sgst+igst)*100)/100, notes: item.notes||'' };
    }
    return { date: item.date||'', amount: amt, cgst: Number(item.cgst)||0,
      sgst: Number(item.sgst)||0, igst: Number(item.igst)||0,
      totalWithGst: Number(item.totalWithGst)||amt, notes: item.notes||'' };
  });
};

const sanitiseBillingForSave = (data) => {
  const isSelfGST = data.isSelfGST || false;
  return {
    ...data,
    creditNotes:      recalcCreditNotes(data.creditNotes, isSelfGST),
    miscellaneousSell: recalcMiscSell(data.miscellaneousSell, isSelfGST),
  };
};

// ─── Generate a single month's billing stub for one state ─────
// Used by add-entry when no billing record exists yet for that month.
const generateBillingStubForMonth = (order, monthIdx, year, state) => {
  const pcdDate     = parseDate(order.pcdDate);
  const termDate    = order.terminateDate ? parseDate(order.terminateDate) : null;
  const daysInMonth = getDaysInMonth(monthIdx, year);

  const isNLD       = order.product === 'NLD';
  const state1      = order.billing1?.state || '';
  const state2      = order.billing2?.state || '';
  const shouldSplit = isNLD && state1 !== state2 && state2 !== '';

  const splitFactor     = order.splitFactor || {};
  const state1Pct       = shouldSplit ? (Number(splitFactor.state1Percentage) || 50) : 100;
  const state2Pct       = shouldSplit ? (Number(splitFactor.state2Percentage) || 50) : 0;
  const statePct        = state === state2 ? state2Pct : state1Pct;

  const capacityMbps    = Number(order.capacity) || 0;
  const baseRate        = Number(order.amount)   || 0;
  const totalAmount     = baseRate * capacityMbps;
  const monthlyBase     = totalAmount * statePct / 100;

  // Billing days
  const monthStart = new Date(year, monthIdx, 1);
  const monthEnd   = new Date(year, monthIdx, daysInMonth);
  const isPcdMonth = pcdDate && pcdDate.getFullYear() === year && pcdDate.getMonth() === monthIdx;

  let termEnd = null;
  if (termDate) {
    const lastDay = new Date(termDate);
    lastDay.setDate(lastDay.getDate() - 1);
    termEnd = lastDay;
  }
  const isTermMonth = termEnd && termEnd.getFullYear() === year && termEnd.getMonth() === monthIdx;

  const startDay    = isPcdMonth  ? pcdDate.getDate()  : 1;
  const endDay      = isTermMonth ? termEnd.getDate()   : daysInMonth;
  const billingDays = endDay - startDay + 1;

  const monthlyCharge = monthlyBase * (billingDays / daysInMonth);

  // GST
  const isState1 = state === state1 || !shouldSplit;
  const gstDetails = isState1
    ? (order.gstDetails1 || order.gstDetails || {})
    : (order.gstDetails2 || order.gstDetails || {});
  const isSelfGST = gstDetails.isSelfGST || false;

  let cgst = 0, sgst = 0, igst = 0;
  if (isSelfGST) {
    cgst = Math.round(monthlyCharge * (gstDetails.cgst || 9) / 100 * 100) / 100;
    sgst = Math.round(monthlyCharge * (gstDetails.sgst || 9) / 100 * 100) / 100;
  } else {
    igst = Math.round(monthlyCharge * (gstDetails.igst || 18) / 100 * 100) / 100;
  }

  const startDateStr = formatDate(new Date(year, monthIdx, startDay));

  return {
    orderId:          order.orderId,
    month:            formatMonthYear(monthIdx, year),
    startDate:        startDateStr,
    endDate:          formatDate(new Date(year, monthIdx, endDay)),
    billingDays,
    perDayRate:       monthlyBase / daysInMonth,
    monthlyBilling:   Math.round(monthlyCharge * 100) / 100,
    cgst, sgst, igst,
    totalWithGst:     Math.round((monthlyCharge + cgst + sgst + igst) * 100) / 100,
    isSelfGST,
    gstState:         gstDetails.gstState     || '',
    gstStateCode:     gstDetails.gstStateCode || '',
    state,
    splitKey:         shouldSplit ? String(statePct) : '100',
    splitPercentage:  statePct,
    capacity:         capacityMbps,
    companyName:      order.companyName,
    status:           'generated',
    invoiceNumber:    '',
    invoiceDate:      calcInvoiceDate(startDateStr),
    receivedDetails:  [],
    creditNotes:      [],
    miscellaneousSell:[],
    tdsProvision:     [],
    tdsConfirm:       [],
    isPcdMonth:       !!isPcdMonth,
    isTerminateMonth: !!isTermMonth,
  };
};

// ─── Main billing generation (used by POST) ───────────────────
const calculateMonthlyBillings = (order, endDate, autoGenerateInvoice = false) => {
  const pcdDate       = parseDate(order.pcdDate);
  const terminateDate = order.terminateDate ? parseDate(order.terminateDate) : null;
  const currentEndDate= parseDate(endDate);
  if (!pcdDate || !currentEndDate) return [];

  const billings  = [];
  let invoiceIndex= 0;
  const isNLD     = order.product === 'NLD';
  const state1    = order.billing1?.state || '';
  const state2    = order.billing2?.state || '';
  const shouldSplit = isNLD && state1 !== state2 && state2 !== '';
  const splitFactor = order.splitFactor || { isApplicable: false, state1Percentage: 50, state2Percentage: 50 };
  const state1Percentage = shouldSplit && splitFactor.isApplicable ? splitFactor.state1Percentage : 100;
  const state2Percentage = shouldSplit && splitFactor.isApplicable ? splitFactor.state2Percentage : 0;
  const capacityMbps = Number(order.capacity) || 0;
  const baseRate     = Number(order.amount)   || 0;
  const totalAmount  = baseRate * capacityMbps;

  let serviceEndDate = currentEndDate;
  if (terminateDate) {
    const lastBillingDay = new Date(terminateDate);
    lastBillingDay.setDate(lastBillingDay.getDate() - 1);
    serviceEndDate = lastBillingDay < currentEndDate ? lastBillingDay : currentEndDate;
  }

  let currentDate = new Date(pcdDate);
  while (currentDate <= serviceEndDate && currentDate <= currentEndDate) {
    const month      = currentDate.getMonth();
    const year       = currentDate.getFullYear();
    const daysInMonth= getDaysInMonth(month, year);
    const isPcdMonth = currentDate.getFullYear() === pcdDate.getFullYear() && currentDate.getMonth() === pcdDate.getMonth();
    const isTerminateMonth = terminateDate && currentDate.getFullYear() === serviceEndDate.getFullYear() && currentDate.getMonth() === serviceEndDate.getMonth();

    let startDay = 1, endDay = daysInMonth, billingDays = daysInMonth;
    if (isPcdMonth && isTerminateMonth) {
      startDay = pcdDate.getDate(); endDay = serviceEndDate.getDate(); billingDays = endDay - startDay + 1;
    } else if (isPcdMonth) {
      startDay = pcdDate.getDate(); endDay = daysInMonth; billingDays = endDay - startDay + 1;
    } else if (isTerminateMonth) {
      startDay = 1; endDay = serviceEndDate.getDate(); billingDays = endDay - startDay + 1;
    }
    const startDateStr = formatDate(new Date(year, month, startDay));
    const endDateStr   = formatDate(new Date(year, month, endDay));

    const makeBilling = (statePct, gstDetails, state) => {
      const monthlyCharge = (totalAmount * statePct / 100) * (billingDays / daysInMonth);
      const isSelfGST = gstDetails.isSelfGST || false;
      let cgst = 0, sgst = 0, igst = 0;
      if (isSelfGST) {
        cgst = monthlyCharge * (gstDetails.cgst || 9) / 100;
        sgst = monthlyCharge * (gstDetails.sgst || 9) / 100;
      } else {
        igst = monthlyCharge * (gstDetails.igst || 18) / 100;
      }
      const b = {
        orderId: order.orderId, month: formatMonthYear(month, year),
        startDate: startDateStr, endDate: endDateStr, billingDays,
        perDayRate: totalAmount * statePct / 100 / daysInMonth,
        receivedDetails: [], creditNotes: [], miscellaneousSell: [], tdsProvision: [], tdsConfirm: [],
        monthlyBilling: monthlyCharge, cgst, sgst, igst, totalWithGst: monthlyCharge + cgst + sgst + igst,
        invoiceNumber: '',
        invoiceDate: calcInvoiceDate(startDateStr),
        isSelfGST, gstState: gstDetails.gstState||'', gstStateCode: gstDetails.gstStateCode||'',
        state, splitKey: String(statePct), splitPercentage: statePct, capacity: capacityMbps,
        companyName: order.companyName, status: 'generated', isPcdMonth, isTerminateMonth,
      };
      if (autoGenerateInvoice) { b.invoiceNumber = generateInvoiceNumber(b, invoiceIndex++); b.status = 'invoiced'; }
      return b;
    };

    if (shouldSplit) {
      billings.push(makeBilling(state1Percentage, order.gstDetails1 || order.gstDetails || {}, state1));
      billings.push(makeBilling(state2Percentage, order.gstDetails2 || order.gstDetails || {}, state2));
    } else {
      billings.push(makeBilling(100, order.gstDetails || {}, state1 || state2));
    }

    if (isTerminateMonth) break;
    currentDate = new Date(year, month + 1, 1);
  }
  return billings;
};

// ─── POST: Generate monthly billings ─────────────────────────
export async function POST(request) {
  try {
    await connectDB();
    const { orderId, mode, customEndDate, autoInvoice = true } = await request.json();
    if (!orderId) return NextResponse.json({ success: false, error: 'Order ID is required' }, { status: 400 });

    const order = await Order.findOne({ orderId });
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

    let endDate;
    if (mode === 'auto') endDate = formatDate(new Date());
    else if (mode === 'manual' && customEndDate) endDate = customEndDate;
    else return NextResponse.json({ success: false, error: 'Invalid mode or missing customEndDate' }, { status: 400 });

    const billings = calculateMonthlyBillings(order, endDate, autoInvoice);
    if (!billings.length) return NextResponse.json({ success: false, error: 'No billings to generate' }, { status: 400 });

    const operations = billings.map(billing => ({
      updateOne: {
        filter: { orderId: billing.orderId, month: billing.month, state: billing.state, splitKey: billing.splitKey },
        update: { $set: billing },
        upsert: true,
      },
    }));
    await MonthlyBilling.bulkWrite(operations);

    const savedBillings = await MonthlyBilling.find({ orderId, month: { $in: billings.map(b => b.month) } }).sort({ month: 1, state: 1 });
    return NextResponse.json({ success: true, message: `Generated ${billings.length} billing entries`, data: savedBillings });

  } catch (error) {
    console.error('Generate monthly billings error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─── GET: Fetch monthly billings ──────────────────────────────
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const query   = orderId ? { orderId } : {};
    const billings= await MonthlyBilling.find(query).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: billings });
  } catch (error) {
    console.error('Fetch monthly billings error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─── PUT: Update a monthly billing ───────────────────────────
export async function PUT(request) {
  try {
    await connectDB();
    const bodyData = await request.json();
    const { _id, ...rawUpdateData } = bodyData;
    if (!_id) return NextResponse.json({ success: false, error: 'Billing ID is required' }, { status: 400 });

    const updateData = sanitiseBillingForSave(rawUpdateData);
    const updatedBilling = await MonthlyBilling.findByIdAndUpdate(_id, { $set: updateData }, { new: true, runValidators: true });
    if (!updatedBilling) return NextResponse.json({ success: false, error: 'Billing not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: updatedBilling });
  } catch (error) {
    console.error('Update monthly billing error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─── DELETE: Delete monthly billings ─────────────────────────
export async function DELETE(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const orderId   = searchParams.get('orderId');
    const billingId = searchParams.get('billingId');

    if (billingId) {
      await MonthlyBilling.findByIdAndDelete(billingId);
      return NextResponse.json({ success: true, message: 'Billing deleted' });
    } else if (orderId) {
      await MonthlyBilling.deleteMany({ orderId });
      return NextResponse.json({ success: true, message: 'All billings for order deleted' });
    } else {
      return NextResponse.json({ success: false, error: 'orderId or billingId required' }, { status: 400 });
    }
  } catch (error) {
    console.error('Delete monthly billing error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─── PATCH: Special actions ───────────────────────────────────
export async function PATCH(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // ── action=add-entry ─────────────────────────────────────
    if (action === 'add-entry') {
      const { orderId, state, month, amountType, entry } = await request.json();

      if (!orderId || !month || !amountType || !entry) {
        return NextResponse.json({
          success: false,
          error: 'orderId, month, amountType and entry are required',
        }, { status: 400 });
      }

      const VALID_TYPES = ['receivedDetails', 'tdsProvision', 'tdsConfirm', 'creditNotes', 'miscellaneousSell'];
      if (!VALID_TYPES.includes(amountType)) {
        return NextResponse.json({ success: false, error: `Invalid amountType: ${amountType}` }, { status: 400 });
      }

      if (!entry.date || entry.amount === undefined || entry.amount === null) {
        return NextResponse.json({ success: false, error: 'entry must have date and amount' }, { status: 400 });
      }

      const entryAmount = Number(entry.amount);
      if (isNaN(entryAmount)) {
        return NextResponse.json({ success: false, error: 'entry.amount must be a number' }, { status: 400 });
      }

      let billing = await MonthlyBilling.findOne({ orderId, month, state });
      if (!billing && state) {
        billing = await MonthlyBilling.findOne({ orderId, month, state: '' });
      }
      if (!billing) {
        billing = await MonthlyBilling.findOne({ orderId, month });
      }

      if (!billing) {
        const order = await Order.findOne({ orderId });
        if (!order) {
          return NextResponse.json({ success: false, error: `Order not found: ${orderId}` }, { status: 404 });
        }

        const parsed = parseMonthYear(month);
        if (!parsed) {
          return NextResponse.json({ success: false, error: `Cannot parse month: "${month}"` }, { status: 400 });
        }

        const stub = generateBillingStubForMonth(order, parsed.month, parsed.year, state || order.billing1?.state || '');
        billing    = new MonthlyBilling(stub);
      }

      const cleanEntry = {
        date:   entry.date   || '',
        amount: entryAmount,
        notes:  entry.notes  || '',
      };

      if (!billing[amountType]) billing[amountType] = [];
      billing[amountType].push(cleanEntry);

      const sanitised = sanitiseBillingForSave(billing.toObject ? billing.toObject() : billing);
      Object.assign(billing, sanitised);

      const saved = await billing.save();
      return NextResponse.json({ success: true, data: saved });
    }

    // ── action=backfill ───────────────────────────────────────
    if (action === 'backfill') {
      const billings = await MonthlyBilling.find({ 'creditNotes.0': { $exists: true } });
      let fixedCount = 0;
      const bulkOps  = [];

      for (const billing of billings) {
        const fixed    = recalcCreditNotes(billing.creditNotes, billing.isSelfGST || false);
        const needsFix = fixed.some((cn, i) => (Number(billing.creditNotes[i]?.totalWithGst) || 0) !== cn.totalWithGst);
        if (needsFix) {
          fixedCount++;
          bulkOps.push({ updateOne: { filter: { _id: billing._id }, update: { $set: { creditNotes: fixed } } } });
        }
      }
      if (bulkOps.length) await MonthlyBilling.bulkWrite(bulkOps);

      return NextResponse.json({ success: true, message: `Backfill complete. Fixed ${fixedCount} records.`, fixed: fixedCount, total: billings.length });
    }

    return NextResponse.json({ success: false, error: 'Unknown action. Use ?action=add-entry or ?action=backfill' }, { status: 400 });

  } catch (error) {
    console.error('PATCH billing error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}