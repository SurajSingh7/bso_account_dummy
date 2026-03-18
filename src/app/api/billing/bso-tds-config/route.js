// app/api/billing/bso-tds-config/route.js

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import BsoTdsConfig from '../../../../models/BsoTdsConfig';

// ── GET — fetch all or single by id ───────────────────────────────────────────
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const config = await BsoTdsConfig.findById(id).lean();
      if (!config) {
        return NextResponse.json({ success: false, error: 'Config not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: config });
    }

    const configs = await BsoTdsConfig.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: configs, count: configs.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ── POST — create new config ───────────────────────────────────────────────────
export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const { name, tds, isActive } = body;

    if (!name || tds === undefined || tds === null) {
      return NextResponse.json(
        { success: false, error: 'name and tds are required' },
        { status: 400 }
      );
    }

    // Check duplicate
    const existing = await BsoTdsConfig.findOne({ name: name.trim() });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `BSO "${name}" already exists` },
        { status: 409 }
      );
    }

    const config = await BsoTdsConfig.create({
      name: name.trim(),
      tds: Number(tds),
      isActive: isActive !== undefined ? isActive : true,
    });

    return NextResponse.json({ success: true, data: config }, { status: 201 });
  } catch (error) {
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, error: 'BSO name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ── PUT — update existing config by id ────────────────────────────────────────
export async function PUT(request) {
  try {
    await connectDB();
    const body = await request.json();
    const { _id, name, tds, isActive } = body;

    if (!_id) {
      return NextResponse.json({ success: false, error: '_id is required' }, { status: 400 });
    }

    // Check duplicate name on another doc
    if (name) {
      const duplicate = await BsoTdsConfig.findOne({
        name: name.trim(),
        _id: { $ne: _id },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `BSO "${name}" already exists` },
          { status: 409 }
        );
      }
    }

    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (tds !== undefined) updateFields.tds = Number(tds);
    if (isActive !== undefined) updateFields.isActive = isActive;

    const updated = await BsoTdsConfig.findByIdAndUpdate(
      _id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Config not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ── DELETE — delete by id or bulk ─────────────────────────────────────────────
export async function DELETE(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const deleted = await BsoTdsConfig.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Config not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deleted, message: 'Deleted successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}