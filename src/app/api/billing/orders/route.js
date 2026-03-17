import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

const convertDateForStorage = (dateString) => {
  if (!dateString) return null;
  if (dateString.includes('-') && dateString.split('-')[0].length <= 2) {
    const [day, month, year] = dateString.split('-');
    return new Date(year, month - 1, day);
  }
  if (dateString.includes('-') && dateString.split('-')[0].length === 4) {
    const [year, month, day] = dateString.split('-');
    return new Date(year, month - 1, day);
  }
  try { return new Date(dateString); } catch { return null; }
};

const defaultGST = () => ({
  isSelfGST: false, igst: 18, cgst: 0, sgst: 0,
  gstState: '', gstStateCode: '',
});

const defaultSplit = () => ({
  isApplicable: false, state1Percentage: 50, state2Percentage: 50,
});

// ─── GET all orders ─────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const query = {};
    ['product', 'entity', 'status'].forEach(k => {
      if (searchParams.get(k)) query[k] = searchParams.get(k);
    });
    const orders = await Order.find(query).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: orders, count: orders.length });
  } catch (error) {
    console.error('GET Orders Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─── POST create new order ───────────────────────────────────────────────────
export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();

    if (!body.orderId || !body.companyName) {
      return NextResponse.json(
        { success: false, error: 'Order ID and Company Name are required' },
        { status: 400 }
      );
    }

    if (await Order.findOne({ orderId: body.orderId })) {
      return NextResponse.json({ success: false, error: 'Order ID already exists' }, { status: 400 });
    }

    // Convert dates
    if (body.pcdDate)       body.pcdDate       = convertDateForStorage(body.pcdDate);
    if (body.terminateDate) body.terminateDate  = convertDateForStorage(body.terminateDate);

    // Ensure billing objects
    body.billing1 = body.billing1 || { address:'',area:'',city:'',pincode:'',state:'',stateCode:'' };
    body.billing2 = body.billing2 || { address:'',area:'',city:'',pincode:'',state:'',stateCode:'' };

    // ─── GST defaults ───────────────────────────────────────────────────────
    // gstDetails1 is always required; gstDetails2 only for NLD split
    body.gstDetails1 = body.gstDetails1 || defaultGST();
    body.gstDetails2 = body.gstDetails2 || defaultGST();
    // keep legacy field in sync with gstDetails1 for old code paths
    body.gstDetails  = body.gstDetails1;

    // ─── Split factor ────────────────────────────────────────────────────────
    const isNLD = body.product === 'NLD';
    const diffStates = isNLD &&
      body.billing1.state && body.billing2.state &&
      body.billing1.state !== body.billing2.state;

    if (diffStates) {
      if (!body.splitFactor) {
        body.splitFactor = { isApplicable: true, state1Percentage: 50, state2Percentage: 50 };
      } else {
        const total = (body.splitFactor.state1Percentage || 0) + (body.splitFactor.state2Percentage || 0);
        if (Math.abs(total - 100) > 0.01) {
          return NextResponse.json(
            { success: false, error: `Split factor must total 100%. Current: ${total}%` },
            { status: 400 }
          );
        }
        body.splitFactor.isApplicable = true;
      }
    } else {
      body.splitFactor = body.splitFactor || defaultSplit();
      body.splitFactor.isApplicable = false;
    }

    const order = await Order.create(body);
    return NextResponse.json({ success: true, data: order, message: 'Order created successfully' }, { status: 201 });
  } catch (error) {
    console.error('POST Order Error:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return NextResponse.json({ success: false, error: 'Validation failed', details: errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

// ─── DELETE all orders ───────────────────────────────────────────────────────
export async function DELETE(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    if (searchParams.get('confirm') !== 'DELETE_ALL_ORDERS') {
      return NextResponse.json(
        { success: false, error: 'Add ?confirm=DELETE_ALL_ORDERS to confirm' },
        { status: 400 }
      );
    }
    const result = await Order.deleteMany({});
    return NextResponse.json({ success: true, message: `${result.deletedCount} orders deleted`, deletedCount: result.deletedCount });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}