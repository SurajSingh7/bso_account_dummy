import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import DistributedPayment from '../../../../models/Distribution';

// ─── GET ──────────────────────────────────────────────────────
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const record = await DistributedPayment.findById(id);
      if (!record) return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: record });
    }

    const query = {};
    const companyGroup = searchParams.get('companyGroup');
    const paymentType  = searchParams.get('paymentType');
    if (companyGroup) query.companyGroup = { $regex: companyGroup.trim(), $options: 'i' };
    if (paymentType && ['receivedDetails', 'tdsProvision', 'tdsConfirm'].includes(paymentType)) {
      query.paymentType = paymentType;
    }

    const [records, groups] = await Promise.all([
      DistributedPayment.find(query).sort({ createdAt: -1 }).limit(500).lean(),
      DistributedPayment.distinct('companyGroup'),
    ]);
    return NextResponse.json({ success: true, data: records, groups: groups.sort() });
  } catch (error) {
    console.error('GET /api/billing/distributed error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────
export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();

    const {
      companyGroup, paymentType, paymentDate, billingMonth, totalAmount,
      notes, entries,
      paymentMethod, bankName, chequeNumber, chequeDate, neftId, transactionId, paymentNote,
    } = body;

    if (!companyGroup || !paymentType || !paymentDate || !billingMonth || totalAmount === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: companyGroup, paymentType, paymentDate, billingMonth, totalAmount' },
        { status: 400 }
      );
    }

    const cleanEntries = (entries || []).map(e => ({
      orderId:     String(e.orderId     || ''),
      companyName: String(e.companyName || ''),
      state:       String(e.state       || ''),
      entity:      String(e.entity      || ''),
      splitPct:    Number(e.splitPct)   || 100,
      isSplit:     Boolean(e.isSplit),
      amount:      Number(e.amount)     || 0,
      notes:       String(e.notes       || ''),
      date:        String(e.date        || ''),
      month:       String(e.month       || ''),
      // ── NEW: clean and store monthly adjustments ─────────────
      monthlyAdjustments: (e.monthlyAdjustments || []).map(adj => ({
        month:           String(adj.month           || ''),
        invoiceNumber:   String(adj.invoiceNumber   || '-'),
        invoiceDate:     String(adj.invoiceDate     || '-'),
        monthlyAmount:   Number(adj.monthlyAmount)  || 0,    // ← ADD THIS
        adjustedAmount:  Number(adj.adjustedAmount) || 0,
        remainingAmount: Number(adj.remainingAmount) || 0,
        amountStatus: ['Fully Paid', 'Partially Paid', 'Not Paid'].includes(adj.amountStatus)
          ? adj.amountStatus
          : 'Not Paid',
      })),
    }));

    const record = await DistributedPayment.create({
      companyGroup:  String(companyGroup),
      paymentType:   String(paymentType),
      paymentDate:   String(paymentDate),
      billingMonth:  String(billingMonth),
      totalAmount:   Number(totalAmount),
      notes:         String(notes         || ''),
      entries:       cleanEntries,
      entryCount:    cleanEntries.length,
      paymentMethod:  String(paymentMethod  || 'cash'),
      bankName:       String(bankName       || ''),
      chequeNumber:   String(chequeNumber   || ''),
      chequeDate:     String(chequeDate     || ''),
      neftId:         String(neftId         || ''),
      transactionId:  String(transactionId  || ''),
      paymentNote:    String(paymentNote    || ''),
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    console.error('POST /api/billing/distributed error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────
export async function DELETE(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id query param required' }, { status: 400 });
    const deleted = await DistributedPayment.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Distribution record deleted' });
  } catch (error) {
    console.error('DELETE /api/billing/distributed error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}