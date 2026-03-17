import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import mongoose from 'mongoose';

function isValidObjectId(id) { return mongoose.Types.ObjectId.isValid(id); }

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

// GET single order
export async function GET(request, context) {
  try {
    await dbConnect();
    const { id } = await context.params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 });
    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT update order
export async function PUT(request, context) {
  try {
    await dbConnect();
    const { id } = await context.params;
    const body = await request.json();

    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 });

    // Check for duplicate orderId on other records
    if (body.orderId) {
      const dup = await Order.findOne({ orderId: body.orderId, _id: { $ne: id } });
      if (dup) return NextResponse.json({ success: false, error: 'Order ID already exists' }, { status: 400 });
    }

    // Convert dates
    if (body.pcdDate)       body.pcdDate       = convertDateForStorage(body.pcdDate);
    if (body.terminateDate) body.terminateDate  = convertDateForStorage(body.terminateDate);

    // ─── GST defaults ───────────────────────────────────────────────────────
    body.gstDetails1 = body.gstDetails1 || defaultGST();
    body.gstDetails2 = body.gstDetails2 || defaultGST();
    body.gstDetails  = body.gstDetails1; // keep legacy in sync

    // ─── Split factor ────────────────────────────────────────────────────────
    const isNLD = body.product === 'NLD';
    const diffStates = isNLD &&
      body.billing1?.state && body.billing2?.state &&
      body.billing1.state !== body.billing2.state;

    if (diffStates && body.splitFactor) {
      const total = (body.splitFactor.state1Percentage || 0) + (body.splitFactor.state2Percentage || 0);
      if (Math.abs(total - 100) > 0.01) {
        return NextResponse.json(
          { success: false, error: `Split factor must total 100%. Current: ${total}%` },
          { status: 400 }
        );
      }
      body.splitFactor.isApplicable = true;
    } else if (body.splitFactor) {
      body.splitFactor.isApplicable = false;
    }

    const order = await Order.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('PUT Order Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

// DELETE single order
export async function DELETE(request, context) {
  try {
    await dbConnect();
    const { id } = await context.params;
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 });
    const order = await Order.findByIdAndDelete(id);
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Order deleted successfully', data: order });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}