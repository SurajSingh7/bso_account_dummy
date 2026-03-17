'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar, RefreshCw, FileText, Trash2, Edit2, Save, X, ArrowLeft,
  Filter, Download, TrendingUp, DollarSign, Calendar as CalendarIcon,
  CheckCircle2, Clock, FileCheck, Eye, Plus, Trash, Receipt, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

// ── BSO TDS Config ─────────────────────────────────────────────────────────────
// Add/edit entries here. tds: 1 means 1% of basic, tds: 2 means 2% of basic.
const bsoTdsConf = [
  { name: "Airtel", tds: 1 },
  { name: "Vodafone", tds: 2 },
  { name: "Tata", tds: 1 },
];

/**
 * Given a billing record, return a tdsConfirm entry if the companyName
 * matches any entry in bsoTdsConf, otherwise return null.
 */
const buildAutoTdsConfirmEntry = (billing) => {
  if (!billing) return null;
  const match = bsoTdsConf.find(
    (b) => billing.companyName?.toLowerCase().includes(b.name.toLowerCase())
  );
  if (!match) return null;
  const basic = Number(billing.monthlyBilling) || 0;
  const tdsAmount = Math.round((basic * match.tds) / 100 * 100) / 100;
  return {
    date: billing.startDate || getCurrentDateDDMMYYYY(),
    amount: tdsAmount,
    notes: `Auto TDS @${match.tds}% of ₹${basic.toFixed(2)} (${match.name})`,
  };
};

// Date utility functions for DD-MM-YYYY format
const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return '';
  if (dateStr.includes('-') && dateStr.split('-')[0].length <= 2) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
};

const formatDateToInput = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length <= 2) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
};

const getCurrentDateDDMMYYYY = () => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const calculateTotal = (arr) => {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
};

const calculateMiscSellTotal = (arr) => {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, item) => sum + (Number(item.totalWithGst) || Number(item.amount) || 0), 0);
};

const calculateCreditNotesTotal = (arr, isSelfGST = false) => {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, item) => {
    const amt = Number(item.amount) || 0;
    const saved = Number(item.totalWithGst) || 0;
    if (saved > 0) return sum + saved;
    if (amt > 0) {
      const gst = amt * 0.18;
      return sum + Math.round((amt + gst) * 100) / 100;
    }
    return sum;
  }, 0);
};

const recalcCreditNoteGST = (creditNotes, isSelfGST) => {
  if (!creditNotes || creditNotes.length === 0) return [];
  return creditNotes.map((cn) => {
    const amt = Number(cn.amount) || 0;
    if (amt > 0 && (Number(cn.totalWithGst) || 0) === 0) {
      const cgst = isSelfGST ? Math.round(amt * 0.09 * 100) / 100 : 0;
      const sgst = isSelfGST ? Math.round(amt * 0.09 * 100) / 100 : 0;
      const igst = isSelfGST ? 0 : Math.round(amt * 0.18 * 100) / 100;
      const totalWithGst = Math.round((amt + cgst + sgst + igst) * 100) / 100;
      return { ...cn, cgst, sgst, igst, totalWithGst };
    }
    return cn;
  });
};

const buildCNInvoiceNumber = (billingMonth) => {
  if (!billingMonth) return '';
  const [monthName = '', yearStr = ''] = billingMonth.split(' ');
  const monthAbbr = monthName.substring(0, 3).toUpperCase();
  const seq = Date.now().toString().slice(-4);
  return `CN-${monthAbbr}-${yearStr}-${seq}`;
};

// ─── BillingDetailModal ────────────────────────────────────────────────────────
const BillingDetailModal = ({ billing, mode, onClose, onSave, onDelete, onModeChange }) => {
  const buildInitialData = (b) => ({
    ...b,
    creditNotes: recalcCreditNoteGST(b.creditNotes, b.isSelfGST || false),
  });

  const [editFormData, setEditFormData] = useState(() => buildInitialData(billing));
  const isEditMode = mode === 'edit';

  useEffect(() => {
    setEditFormData(buildInitialData(billing));
  }, [billing]);

  const handleSave = async () => { await onSave(editFormData); };

  const handleAddEntry = (arrayName) => {
    let newEntry;
    if (arrayName === 'creditNotes') {
      newEntry = {
        date: getCurrentDateDDMMYYYY(),
        periodStart: '',
        periodEnd: '',
        amount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalWithGst: 0,
        invoiceNumber: buildCNInvoiceNumber(editFormData.month),
        notes: '',
      };
    } else if (arrayName === 'miscellaneousSell') {
      newEntry = { date: getCurrentDateDDMMYYYY(), amount: 0, cgst: 0, sgst: 0, igst: 0, totalWithGst: 0, notes: '' };
    } else {
      newEntry = { date: getCurrentDateDDMMYYYY(), amount: 0, notes: '' };
    }
    setEditFormData(prev => ({ ...prev, [arrayName]: [...(prev[arrayName] || []), newEntry] }));
  };

  const handleRemoveEntry = (arrayName, index) => {
    setEditFormData(prev => ({ ...prev, [arrayName]: prev[arrayName].filter((_, i) => i !== index) }));
  };

  const handleUpdateEntry = (arrayName, index, field, value) => {
    const updated = [...editFormData[arrayName]];
    updated[index] = { ...updated[index], [field]: value };
    if (arrayName === 'miscellaneousSell' && field === 'amount') {
      const amt = Number(value) || 0;
      const isSelfGST = editFormData.isSelfGST || false;
      updated[index].cgst = isSelfGST ? amt * 0.09 : 0;
      updated[index].sgst = isSelfGST ? amt * 0.09 : 0;
      updated[index].igst = isSelfGST ? 0 : amt * 0.18;
      updated[index].totalWithGst = amt + updated[index].cgst + updated[index].sgst + updated[index].igst;
    }
    setEditFormData(prev => ({ ...prev, [arrayName]: updated }));
  };

  const invoiceDateHint = (() => {
    const sd = editFormData.startDate || '';
    const parts = sd.split('-');
    if (parts.length === 3 && parts[0] === '01') return '2nd of month';
    return 'start + 1 day';
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2.5 hover:bg-white rounded-xl border border-gray-200 transition-all hover:shadow-md group">
              <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
            </button>
            <div>
              <p className="text-sm text-gray-500 font-semibold mb-1">{isEditMode ? 'Editing Billing' : 'Viewing Billing'}</p>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {editFormData.month} - {editFormData.state}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isEditMode ? (
              <>
                <button onClick={() => onModeChange('edit')} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-semibold shadow-lg hover:shadow-xl">
                  <Edit2 className="w-5 h-5" /> Edit Billing
                </button>
                <button onClick={() => onDelete(billing._id)} className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-red-500 text-red-700 rounded-xl hover:bg-red-50 transition-all font-semibold shadow-md hover:shadow-lg">
                  <Trash2 className="w-5 h-5" /> Delete
                </button>
              </>
            ) : (
              <>
                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all font-semibold shadow-lg hover:shadow-xl">
                  <Save className="w-5 h-5" /> Save Changes
                </button>
                <button onClick={() => { setEditFormData(buildInitialData(billing)); onModeChange('view'); }} className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-500 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold shadow-md hover:shadow-lg">
                  <X className="w-5 h-5" /> Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Basic Information */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" /> Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Order ID', val: editFormData.orderId },
              { label: 'Month', val: editFormData.month },
              { label: 'Company Name', val: editFormData.companyName },
              { label: 'Start Date', val: editFormData.startDate },
              { label: 'End Date', val: editFormData.endDate },
              { label: 'Billing Days', val: editFormData.billingDays, type: 'number' },
              { label: 'State', val: editFormData.state },
              { label: 'Split Percentage', val: `${editFormData.splitPercentage || 100}%` },
              { label: 'GST Type', val: editFormData.isSelfGST ? 'Self GST (CGST+SGST)' : 'IGST' },
            ].map(({ label, val, type }) => (
              <div key={label}>
                <label className="text-sm font-semibold text-gray-600 mb-2 block">{label}</label>
                <input type={type || 'text'} value={val} disabled className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 font-medium" />
              </div>
            ))}

            <div>
              <label className="text-sm font-semibold text-gray-600 mb-2 block">Monthly Billing (Basic)</label>
              <input type="number"
                value={isEditMode ? editFormData.monthlyBilling : editFormData.monthlyBilling.toFixed(2)}
                onChange={(e) => {
                  if (!isEditMode) return;
                  const v = Number(e.target.value);
                  const isSelfGST = editFormData.isSelfGST || false;
                  const cgst = isSelfGST ? v * 0.09 : 0;
                  const sgst = isSelfGST ? v * 0.09 : 0;
                  const igst = isSelfGST ? 0 : v * 0.18;
                  setEditFormData(prev => ({ ...prev, monthlyBilling: v, cgst, sgst, igst, totalWithGst: v + cgst + sgst + igst }));
                }}
                disabled={!isEditMode}
                className={`w-full px-4 py-3 border-2 rounded-lg font-medium ${isEditMode ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none' : 'border-gray-200 bg-gray-50 text-gray-900'}`} />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-600 mb-2 block">CGST (9%)</label>
              <input type="number" value={editFormData.cgst.toFixed(2)} disabled className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 font-medium" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600 mb-2 block">SGST (9%)</label>
              <input type="number" value={editFormData.sgst.toFixed(2)} disabled className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 font-medium" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600 mb-2 block">IGST (18%)</label>
              <input type="number" value={editFormData.igst.toFixed(2)} disabled className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-900 font-medium" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600 mb-2 block">Monthly Billing + GST</label>
              <input type="number" value={editFormData.totalWithGst.toFixed(2)} disabled className="w-full px-4 py-3 border-2 border-green-300 rounded-lg bg-green-50 text-green-900 font-bold" />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-600 mb-2 block">Invoice Number</label>
              <input type="text"
                value={editFormData.invoiceNumber || ''}
                onChange={(e) => isEditMode && setEditFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                disabled={!isEditMode}
                placeholder="Auto-generated"
                className={`w-full px-4 py-3 border-2 rounded-lg font-medium ${isEditMode ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none' : 'border-gray-200 bg-gray-50 text-gray-900'}`} />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                Invoice Date
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold leading-none">
                  {invoiceDateHint}
                </span>
              </label>
              <input
                type="date"
                value={formatDateToInput(editFormData.invoiceDate || '')}
                onChange={(e) =>
                  isEditMode &&
                  setEditFormData(prev => ({ ...prev, invoiceDate: formatDateToDisplay(e.target.value) }))
                }
                disabled={!isEditMode}
                className={`w-full px-4 py-3 border-2 rounded-lg font-medium ${
                  isEditMode
                    ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none'
                    : 'border-gray-200 bg-gray-50 text-gray-900'
                }`}
              />
              {editFormData.invoiceDate && (
                <p className="text-xs text-gray-500 mt-1">{editFormData.invoiceDate}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-600 mb-2 block">Status</label>
              <select
                value={editFormData.status}
                onChange={(e) => isEditMode && setEditFormData(prev => ({ ...prev, status: e.target.value }))}
                disabled={!isEditMode}
                className={`w-full px-4 py-3 border-2 rounded-lg font-medium ${isEditMode ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none' : 'border-gray-200 bg-gray-50 text-gray-900'}`}>
                <option value="draft">Draft</option>
                <option value="generated">Generated</option>
                <option value="invoiced">Invoiced</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
        </div>

        {/* Received Details */}
        <ArrayDetailsSection title="Received Details" icon={<DollarSign className="w-6 h-6 text-green-600" />}
          arrayName="receivedDetails" data={editFormData.receivedDetails || []} isEditMode={isEditMode}
          onAddEntry={handleAddEntry} onUpdateEntry={handleUpdateEntry} onRemoveEntry={handleRemoveEntry} colorClass="green" />

        {/* Credit Notes */}
        <CreditNotesSection
          title="Credit Notes" icon={<Receipt className="w-6 h-6 text-cyan-600" />}
          arrayName="creditNotes" data={editFormData.creditNotes || []} isEditMode={isEditMode}
          onAddEntry={handleAddEntry} onUpdateEntry={handleUpdateEntry} onRemoveEntry={handleRemoveEntry}
          colorClass="cyan"
          currentMonth={editFormData.month}
          monthlyBilling={editFormData.monthlyBilling}
          isSelfGST={editFormData.isSelfGST || false}
          setEditFormData={setEditFormData}
          editFormData={editFormData}
        />

        {/* Miscellaneous Sell */}
        <MiscSellSection title="Miscellaneous Sell" icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
          arrayName="miscellaneousSell" data={editFormData.miscellaneousSell || []} isEditMode={isEditMode}
          onAddEntry={handleAddEntry} onUpdateEntry={handleUpdateEntry} onRemoveEntry={handleRemoveEntry} colorClass="purple" />

        {/* TDS Provision */}
        <ArrayDetailsSection title="TDS Provision" icon={<FileCheck className="w-6 h-6 text-orange-600" />}
          arrayName="tdsProvision" data={editFormData.tdsProvision || []} isEditMode={isEditMode}
          onAddEntry={handleAddEntry} onUpdateEntry={handleUpdateEntry} onRemoveEntry={handleRemoveEntry} colorClass="orange" />

        {/* TDS Confirm */}
        <ArrayDetailsSection title="TDS Confirm" icon={<CheckCircle2 className="w-6 h-6 text-blue-600" />}
          arrayName="tdsConfirm" data={editFormData.tdsConfirm || []} isEditMode={isEditMode}
          onAddEntry={handleAddEntry} onUpdateEntry={handleUpdateEntry} onRemoveEntry={handleRemoveEntry} colorClass="blue" />
      </div>
    </div>
  );
};

// ─── ArrayDetailsSection ───────────────────────────────────────────────────────
const ArrayDetailsSection = ({ title, icon, arrayName, data, isEditMode, onAddEntry, onUpdateEntry, onRemoveEntry, colorClass }) => (
  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">{icon}{title}</h3>
      {isEditMode && (
        <button onClick={() => onAddEntry(arrayName)} className={`flex items-center gap-2 px-4 py-2 bg-${colorClass}-100 text-${colorClass}-700 rounded-lg hover:bg-${colorClass}-200 transition-colors font-semibold`}>
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      )}
    </div>
    <div className="space-y-4">
      {data.map((detail, index) => (
        <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Date (DD-MM-YYYY)</label>
            <input type="date" value={formatDateToInput(detail.date)}
              onChange={(e) => isEditMode && onUpdateEntry(arrayName, index, 'date', formatDateToDisplay(e.target.value))}
              disabled={!isEditMode}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${isEditMode ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none' : 'border-gray-200 bg-white'}`} />
            {detail.date && <p className="text-xs text-gray-500 mt-1">{detail.date}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Amount</label>
            <input type="number" value={detail.amount}
              onChange={(e) => isEditMode && onUpdateEntry(arrayName, index, 'amount', Number(e.target.value))}
              disabled={!isEditMode} placeholder="0.00"
              className={`w-full px-3 py-2 border rounded-lg text-sm ${isEditMode ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none' : 'border-gray-200 bg-white'}`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
            <input type="text" value={detail.notes || ''}
              onChange={(e) => isEditMode && onUpdateEntry(arrayName, index, 'notes', e.target.value)}
              disabled={!isEditMode} placeholder="Add notes..."
              className={`w-full px-3 py-2 border rounded-lg text-sm ${isEditMode ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none' : 'border-gray-200 bg-white'}`} />
          </div>
          {isEditMode && (
            <div className="flex items-end">
              <button onClick={() => onRemoveEntry(arrayName, index)} className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-semibold flex items-center justify-center gap-2">
                <Trash className="w-4 h-4" /> Remove
              </button>
            </div>
          )}
        </div>
      ))}
      {data.length === 0 && <p className="text-center text-gray-500 py-8">No {title.toLowerCase()} added yet</p>}
    </div>
  </div>
);

// ─── CreditNotesSection ────────────────────────────────────────────────────────
const CreditNotesSection = ({
  title, icon, arrayName, data, isEditMode,
  onAddEntry, onUpdateEntry, onRemoveEntry, colorClass,
  currentMonth, monthlyBilling, isSelfGST,
  setEditFormData, editFormData,
}) => {

  const monthInfo = useMemo(() => {
    if (!currentMonth) return null;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const [monthName, yearStr] = currentMonth.split(' ');
    const monthIndex = monthNames.indexOf(monthName);
    const year = parseInt(yearStr, 10);
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();
    const mm = String(monthIndex + 1).padStart(2, '0');
    return {
      totalDays, year, monthIndex,
      inputMin: `${year}-${mm}-01`,
      inputMax: `${year}-${mm}-${String(totalDays).padStart(2, '0')}`,
    };
  }, [currentMonth]);

  const parseDDMMYYYY = (s) => {
    if (!s) return null;
    const p = s.split('-');
    if (p.length !== 3) return null;
    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  };

  const calcFromPeriod = (periodStart, periodEnd) => {
    if (!periodStart || !periodEnd || !monthInfo) return { amount: 0, cgst: 0, sgst: 0, igst: 0, totalWithGst: 0 };
    const s = parseDDMMYYYY(periodStart);
    const e = parseDDMMYYYY(periodEnd);
    if (!s || !e || e <= s) return { amount: 0, cgst: 0, sgst: 0, igst: 0, totalWithGst: 0 };
    const days = Math.round((e - s) / (1000 * 60 * 60 * 24));
    const basicAmt = Math.round((days / monthInfo.totalDays) * (monthlyBilling || 0) * 100) / 100;
    const cgst = isSelfGST ? Math.round(basicAmt * 0.09 * 100) / 100 : 0;
    const sgst = isSelfGST ? Math.round(basicAmt * 0.09 * 100) / 100 : 0;
    const igst = isSelfGST ? 0 : Math.round(basicAmt * 0.18 * 100) / 100;
    const totalWithGst = Math.round((basicAmt + cgst + sgst + igst) * 100) / 100;
    return { amount: basicAmt, cgst, sgst, igst, totalWithGst, days };
  };

  const handlePeriodChange = (index, field, value) => {
    const updated = [...editFormData.creditNotes];
    updated[index] = { ...updated[index], [field]: value };
    const start = field === 'periodStart' ? value : updated[index].periodStart;
    const end = field === 'periodEnd' ? value : updated[index].periodEnd;
    const calc = calcFromPeriod(start, end);
    updated[index].amount = calc.amount;
    updated[index].cgst = calc.cgst;
    updated[index].sgst = calc.sgst;
    updated[index].igst = calc.igst;
    updated[index].totalWithGst = calc.totalWithGst;
    setEditFormData(prev => ({ ...prev, creditNotes: updated }));
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">{icon}{title}</h3>
        {isEditMode && (
          <button onClick={() => onAddEntry(arrayName)} className={`flex items-center gap-2 px-4 py-2 bg-${colorClass}-100 text-${colorClass}-700 rounded-lg hover:bg-${colorClass}-200 transition-colors font-semibold`}>
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        )}
      </div>

      <div className="space-y-5">
        {data.map((detail, index) => {
          const s = parseDDMMYYYY(detail.periodStart);
          const e = parseDDMMYYYY(detail.periodEnd);
          const selectedDays = s && e && e > s ? Math.round((e - s) / (1000 * 60 * 60 * 24)) : 0;
          const hasPeriod = !!detail.periodStart && !!detail.periodEnd && selectedDays > 0;

          const amt = Number(detail.amount) || 0;
          const displayCGST = Number(detail.cgst) || (isSelfGST ? Math.round(amt * 0.09 * 100) / 100 : 0);
          const displaySGST = Number(detail.sgst) || (isSelfGST ? Math.round(amt * 0.09 * 100) / 100 : 0);
          const displayIGST = Number(detail.igst) || (!isSelfGST ? Math.round(amt * 0.18 * 100) / 100 : 0);
          const displayTotal = Number(detail.totalWithGst) > 0
            ? Number(detail.totalWithGst)
            : (amt > 0 ? Math.round((amt + amt * 0.18) * 100) / 100 : 0);

          return (
            <div key={index} className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">

              {hasPeriod ? (
                <div className="px-4 py-2.5 bg-gradient-to-r from-cyan-50 to-teal-50 border-b border-cyan-200 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-cyan-800 font-semibold">
                  <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0 text-cyan-600" />
                  <span>
                    ₹{(monthlyBilling || 0).toFixed(2)}&nbsp;(basic)
                    &nbsp;×&nbsp;{selectedDays}&nbsp;days /&nbsp;{monthInfo?.totalDays}&nbsp;days
                    &nbsp;=&nbsp;
                    <strong className="text-teal-700">₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    &nbsp;+ GST =&nbsp;
                    <strong className="text-teal-800">₹{displayTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </span>
                  <span className="ml-auto text-cyan-500 font-normal">({detail.periodStart} → {detail.periodEnd})</span>
                </div>
              ) : amt > 0 ? (
                <div className="px-4 py-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-200 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-amber-800 font-semibold">
                  <Receipt className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                  <span>
                    Basic:&nbsp;<strong className="text-amber-700">₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    &nbsp;+&nbsp;{isSelfGST ? 'CGST+SGST' : 'IGST'}&nbsp;18%&nbsp;=&nbsp;
                    <strong className="text-amber-900">₹{displayTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    &nbsp;(GST auto-applied)
                  </span>
                </div>
              ) : null}

              {/* Row 1: Submit Date | Period Start | Period End | Invoice Number */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Submit Date</label>
                  <input type="date" value={formatDateToInput(detail.date || '')}
                    onChange={(e) => isEditMode && onUpdateEntry(arrayName, index, 'date', formatDateToDisplay(e.target.value))}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${isEditMode ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none' : 'border-gray-200 bg-white'}`} />
                  {detail.date && <p className="text-xs text-gray-500 mt-1">{detail.date}</p>}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Period Start <span className="text-cyan-600 font-normal">({currentMonth})</span>
                  </label>
                  <input type="date" value={formatDateToInput(detail.periodStart || '')}
                    min={monthInfo?.inputMin} max={monthInfo?.inputMax}
                    onChange={(e) => isEditMode && handlePeriodChange(index, 'periodStart', formatDateToDisplay(e.target.value))}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${isEditMode ? 'border-cyan-300 bg-white focus:ring-2 focus:ring-cyan-500 focus:outline-none' : 'border-gray-200 bg-white'}`} />
                  {detail.periodStart && <p className="text-xs text-gray-500 mt-1">{detail.periodStart}</p>}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Period End <span className="text-cyan-600 font-normal">({monthInfo?.totalDays} days total)</span>
                  </label>
                  <input type="date" value={formatDateToInput(detail.periodEnd || '')}
                    min={monthInfo?.inputMin} max={monthInfo?.inputMax}
                    onChange={(e) => isEditMode && handlePeriodChange(index, 'periodEnd', formatDateToDisplay(e.target.value))}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${isEditMode ? 'border-cyan-300 bg-white focus:ring-2 focus:ring-cyan-500 focus:outline-none' : 'border-gray-200 bg-white'}`} />
                  {detail.periodEnd && <p className="text-xs text-gray-500 mt-1">{detail.periodEnd}</p>}
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    Invoice Number
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold leading-none">CN</span>
                  </label>
                  <input type="text"
                    value={detail.invoiceNumber !== undefined ? detail.invoiceNumber : ''}
                    onChange={(e) => isEditMode && onUpdateEntry(arrayName, index, 'invoiceNumber', e.target.value)}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${isEditMode ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none' : 'border-gray-200 bg-white font-medium'}`} />
                </div>
              </div>

              {/* Row 2: Amount | CGST | SGST | IGST | Total+GST | Notes */}
              <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    Amount (Basic) <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-[10px] font-bold leading-none">AUTO</span>
                  </label>
                  <input type="number" value={amt.toFixed(2)} disabled
                    className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm bg-teal-50 text-teal-900 font-extrabold cursor-not-allowed" />
                  {hasPeriod
                    ? <p className="text-[11px] text-teal-600 mt-1 font-semibold">{selectedDays}/{monthInfo?.totalDays} days</p>
                    : isEditMode && <p className="text-[11px] text-gray-400 mt-1">Select period to auto-fill</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    CGST (9%) <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-[10px] font-bold leading-none">AUTO</span>
                  </label>
                  <input type="number" value={displayCGST.toFixed(2)} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    SGST (9%) <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-[10px] font-bold leading-none">AUTO</span>
                  </label>
                  <input type="number" value={displaySGST.toFixed(2)} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    IGST (18%) <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-[10px] font-bold leading-none">AUTO</span>
                  </label>
                  <input type="number" value={displayIGST.toFixed(2)} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    Total + GST <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-[10px] font-bold leading-none">AUTO</span>
                  </label>
                  <input type="number" value={displayTotal.toFixed(2)} disabled className="w-full px-3 py-2 border border-green-300 rounded-lg text-sm bg-green-50 text-green-900 font-extrabold cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
                  <input type="text" value={detail.notes || ''}
                    onChange={(e) => isEditMode && onUpdateEntry(arrayName, index, 'notes', e.target.value)}
                    disabled={!isEditMode} placeholder="Add notes..."
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${isEditMode ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none' : 'border-gray-200 bg-white'}`} />
                </div>
              </div>

              {isEditMode && (
                <div className="px-4 pb-4">
                  <button onClick={() => onRemoveEntry(arrayName, index)}
                    className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-semibold flex items-center justify-center gap-2 text-sm">
                    <Trash className="w-4 h-4" /> Remove Entry
                  </button>
                </div>
              )}

              {hasPeriod && (
                <div className="px-4 pb-3">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                    <span>Month start</span>
                    <span className="text-cyan-600 font-semibold">{selectedDays} of {monthInfo?.totalDays} days selected</span>
                    <span>Month end</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-teal-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (selectedDays / (monthInfo?.totalDays || 1)) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {data.length === 0 && <p className="text-center text-gray-500 py-8">No {title.toLowerCase()} added yet</p>}
      </div>
    </div>
  );
};

// ─── MiscSellSection ───────────────────────────────────────────────────────────
const MiscSellSection = ({ title, icon, arrayName, data, isEditMode, onAddEntry, onUpdateEntry, onRemoveEntry, colorClass }) => (
  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">{icon}{title}</h3>
      {isEditMode && (
        <button onClick={() => onAddEntry(arrayName)} className={`flex items-center gap-2 px-4 py-2 bg-${colorClass}-100 text-${colorClass}-700 rounded-lg hover:bg-${colorClass}-200 transition-colors font-semibold`}>
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      )}
    </div>
    <div className="space-y-4">
      {data.map((detail, index) => (
        <div key={index} className="grid grid-cols-1 md:grid-cols-7 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Date</label>
            <input type="date" value={formatDateToInput(detail.date)}
              onChange={(e) => isEditMode && onUpdateEntry(arrayName, index, 'date', formatDateToDisplay(e.target.value))}
              disabled={!isEditMode}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${isEditMode ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none' : 'border-gray-200 bg-white'}`} />
            {detail.date && <p className="text-xs text-gray-500 mt-1">{detail.date}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Amount</label>
            <input type="number" value={detail.amount}
              onChange={(e) => isEditMode && onUpdateEntry(arrayName, index, 'amount', Number(e.target.value))}
              disabled={!isEditMode} placeholder="0.00"
              className={`w-full px-3 py-2 border rounded-lg text-sm ${isEditMode ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none' : 'border-gray-200 bg-white'}`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">CGST (9%)</label>
            <input type="number" value={(detail.cgst || 0).toFixed(2)} disabled className="w-full px-3 py-2 border rounded-lg text-sm border-gray-200 bg-gray-50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">SGST (9%)</label>
            <input type="number" value={(detail.sgst || 0).toFixed(2)} disabled className="w-full px-3 py-2 border rounded-lg text-sm border-gray-200 bg-gray-50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">IGST (18%)</label>
            <input type="number" value={(detail.igst || 0).toFixed(2)} disabled className="w-full px-3 py-2 border rounded-lg text-sm border-gray-200 bg-gray-50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Total + GST</label>
            <input type="number" value={(detail.totalWithGst || detail.amount || 0).toFixed(2)} disabled className="w-full px-3 py-2 border rounded-lg text-sm border-green-300 bg-green-50 font-bold" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
            <input type="text" value={detail.notes || ''}
              onChange={(e) => isEditMode && onUpdateEntry(arrayName, index, 'notes', e.target.value)}
              disabled={!isEditMode} placeholder="Notes..."
              className={`w-full px-3 py-2 border rounded-lg text-sm ${isEditMode ? 'border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none' : 'border-gray-200 bg-white'}`} />
          </div>
          {isEditMode && (
            <div className="flex items-end md:col-span-7">
              <button onClick={() => onRemoveEntry(arrayName, index)} className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-semibold flex items-center justify-center gap-2">
                <Trash className="w-4 h-4" /> Remove
              </button>
            </div>
          )}
        </div>
      ))}
      {data.length === 0 && <p className="text-center text-gray-500 py-8">No {title.toLowerCase()} added yet</p>}
    </div>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const MonthlyBillGeneratorComp = () => {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [billings, setBillings] = useState([]);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingOrder, setFetchingOrder] = useState(true);
  const [viewingBilling, setViewingBilling] = useState(null);
  const [viewMode, setViewMode] = useState('view');
  const [selectedState, setSelectedState] = useState('all');

  useEffect(() => {
    if (orderId) { fetchOrderDetails(); fetchBillings(); }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setFetchingOrder(true);
      const res = await fetch(`/api/billing/orders?orderId=${orderId}`);
      const result = await res.json();
      if (result.success && result.data.length > 0) setOrderDetails(result.data[0]);
      else alert('Order not found');
    } catch { alert('Failed to fetch order details'); }
    finally { setFetchingOrder(false); }
  };

  const fetchBillings = async () => {
    try {
      const res = await fetch(`/api/billing/monthly?orderId=${orderId}`);
      const result = await res.json();
      if (result.success) {
        setBillings(result.data);
        if (result.data.length > 0) setSelectedState(result.data[0].state);
      }
    } catch (e) { console.error('Error fetching billings:', e); }
  };

  const uniqueStates = useMemo(() => [...new Set(billings.map(b => b.state))].filter(Boolean), [billings]);
  const filteredBillings = useMemo(() => selectedState === 'all' ? billings : billings.filter(b => b.state === selectedState), [billings, selectedState]);

  const hasGSTColumns = useMemo(() => ({
    hasCGST: filteredBillings.some(b => (b.cgst ?? 0) > 0),
    hasSGST: filteredBillings.some(b => (b.sgst ?? 0) > 0),
    hasIGST: filteredBillings.some(b => (b.igst ?? 0) > 0),
  }), [filteredBillings]);

  const billingsWithBalance = useMemo(() => {
    let runningBalance = 0, cumulativeUnpaid = 0;
    const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const sorted = [...filteredBillings].sort((a, b) => {
      const pm = (s) => { const [mn, y] = s.split(' '); return new Date(parseInt(y), monthOrder.indexOf(mn)); };
      return pm(a.month) - pm(b.month);
    });
    const totalCreditPool = sorted.reduce((sum, b) =>
      sum + calculateTotal(b.receivedDetails) + calculateCreditNotesTotal(b.creditNotes, b.isSelfGST) + calculateTotal(b.tdsConfirm), 0);
    let creditPool = totalCreditPool;
    return sorted.map((billing) => {
      const monthlyReceived = calculateTotal(billing.receivedDetails);
      const monthlyCreditNotes = calculateCreditNotesTotal(billing.creditNotes, billing.isSelfGST);
      const monthlyMiscSell = calculateMiscSellTotal(billing.miscellaneousSell);
      const monthlyTDSProv = calculateTotal(billing.tdsProvision);
      const monthlyTDSConf = calculateTotal(billing.tdsConfirm);
      const monthlyCredits = monthlyReceived + monthlyCreditNotes + monthlyTDSConf;
      const monthlyCharges = billing.totalWithGst + monthlyMiscSell;
      runningBalance += monthlyCharges - monthlyCredits;
      let totalRemainingAdjustment = 0;
      if (creditPool >= monthlyCharges) { creditPool -= monthlyCharges; totalRemainingAdjustment = cumulativeUnpaid; }
      else { const u = monthlyCharges - creditPool; creditPool = 0; cumulativeUnpaid += u; totalRemainingAdjustment = cumulativeUnpaid; }
      return { ...billing, monthlyReceived, monthlyCreditNotes, monthlyMiscSell, monthlyTDSProv, monthlyTDSConf, monthlyCharges, totalBalance: runningBalance, totalRemainingAdjustment: Math.max(0, totalRemainingAdjustment) };
    });
  }, [filteredBillings]);

  const totals = useMemo(() => ({
    count: billingsWithBalance.length,
    monthlyBilling: billingsWithBalance.reduce((s, b) => s + (b.monthlyBilling ?? 0), 0),
    cgst: billingsWithBalance.reduce((s, b) => s + (b.cgst ?? 0), 0),
    sgst: billingsWithBalance.reduce((s, b) => s + (b.sgst ?? 0), 0),
    igst: billingsWithBalance.reduce((s, b) => s + (b.igst ?? 0), 0),
    totalWithGst: billingsWithBalance.reduce((s, b) => s + (b.totalWithGst ?? 0), 0),
    monthlyReceived: billingsWithBalance.reduce((s, b) => s + (b.monthlyReceived ?? 0), 0),
    monthlyCreditNotes: billingsWithBalance.reduce((s, b) => s + (b.monthlyCreditNotes ?? 0), 0),
    monthlyMiscSell: billingsWithBalance.reduce((s, b) => s + (b.monthlyMiscSell ?? 0), 0),
    monthlyTDSProv: billingsWithBalance.reduce((s, b) => s + (b.monthlyTDSProv ?? 0), 0),
    monthlyTDSConf: billingsWithBalance.reduce((s, b) => s + (b.monthlyTDSConf ?? 0), 0),
    finalBalance: billingsWithBalance.length > 0 ? billingsWithBalance[billingsWithBalance.length - 1].totalBalance : 0,
  }), [billingsWithBalance]);

  // ── Auto-generate: create billings then auto-patch tdsConfirm for matching companies
// Helper now takes bso string directly instead of matching on companyName
const buildAutoTdsConfirmEntry = (billing, bso) => {
  if (!bso) return null;
  const match = bsoTdsConf.find(
    (b) => bso.toLowerCase().includes(b.name.toLowerCase())
  );
  if (!match) return null;
  const basic = Number(billing.monthlyBilling) || 0;
  const tdsAmount = Math.round((basic * match.tds) / 100 * 100) / 100;
  return {
    date: billing.startDate || getCurrentDateDDMMYYYY(),
    amount: tdsAmount,
    notes: `Auto TDS @${match.tds}% of ₹${basic.toFixed(2)} (BSO: ${bso})`,
  };
};


const handleAutoGenerate = async () => {
  if (!orderId) return alert('No order ID found in URL');
  setLoading(true);
  try {
    // Step 1: Fetch order to get the BSO field
    const orderRes = await fetch(`/api/billing/orders?orderId=${orderId}`);
    const orderResult = await orderRes.json();
    const bso = orderResult.success && orderResult.data.length > 0
      ? orderResult.data[0].bso || ''
      : '';

    // Step 2: Generate billings
    const res = await fetch('/api/billing/monthly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, mode: 'auto', autoInvoice: true }),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Failed to generate billings');

    // Step 3: Re-fetch fresh billings (POST response may be incomplete)
    const fetchRes = await fetch(`/api/billing/monthly?orderId=${orderId}`);
    const fetchResult = await fetchRes.json();
    const freshBillings = fetchResult.success ? fetchResult.data : [];

    // Step 4: Patch tdsConfirm using BSO from order
    let tdsPatched = 0;
    const patchPromises = freshBillings.map(async (billing) => {
      if (billing.tdsConfirm && billing.tdsConfirm.length > 0) return;

      const tdsEntry = buildAutoTdsConfirmEntry(billing, bso);
      if (!tdsEntry) return;

      const putRes = await fetch('/api/billing/monthly', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...billing, tdsConfirm: [tdsEntry] }),
      });
      const putResult = await putRes.json();
      if (putResult.success) tdsPatched++;
      else console.warn(`Failed to patch TDS for ${billing._id}:`, putResult.error);
    });

    await Promise.all(patchPromises);

    alert(
      `✅ Successfully generated ${freshBillings.length} billings!` +
      (tdsPatched > 0
        ? `\n📋 Auto-added TDS Confirm to ${tdsPatched} billing(s) (BSO: ${bso}).`
        : bso
          ? `\n⚠️ BSO "${bso}" not found in bsoTdsConf — no TDS added.`
          : `\n⚠️ No BSO set on this order — no TDS added.`)
    );
    await fetchBillings();
  } catch (e) {
    alert(`❌ Failed to generate billings:\n${e.message}`);
  } finally {
    setLoading(false);
  }
};

  const formatDateToDisplayLocal = (storedDate) => {
    if (!storedDate) return '';
    try {
      const d = new Date(storedDate);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}-${month}-${d.getFullYear()}`;
      }
    } catch (e) { console.error(e); }
    return storedDate;
  };

  const handleDelete = async (billingId) => {
    if (!confirm('Are you sure you want to delete this billing?')) return;
    try {
      const res = await fetch(`/api/billing/monthly?billingId=${billingId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) { alert('✅ Billing deleted'); setViewingBilling(null); await fetchBillings(); }
      else alert('❌ ' + result.error);
    } catch { alert('❌ Failed to delete billing'); }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Are you sure you want to delete all ${billings.length} billings?`)) return;
    try {
      const res = await fetch(`/api/billing/monthly?orderId=${orderId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) { alert('✅ All billings deleted'); await fetchBillings(); }
      else alert('❌ ' + result.error);
    } catch { alert('❌ Failed to delete billings'); }
  };

  const handleSaveEdit = async (editFormData) => {
    try {
      const res = await fetch('/api/billing/monthly', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editFormData) });
      const result = await res.json();
      if (result.success) { alert('✅ Billing updated'); setViewMode('view'); setViewingBilling(null); await fetchBillings(); }
      else alert('❌ ' + result.error);
    } catch { alert('❌ Failed to update billing'); }
  };

  if (!orderId) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-10 max-w-lg w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"><X className="w-10 h-10 text-red-600" /></div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">No Order ID Found</h2>
        <p className="text-gray-600 mb-6 text-lg">Please provide an orderId in the URL query parameter.</p>
        <Link href="/billing/orders" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold shadow-lg"><ArrowLeft className="w-5 h-5" />Go to Orders</Link>
      </div>
    </div>
  );

  if (fetchingOrder) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 flex items-center justify-center">
      <div className="text-center"><RefreshCw className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-6" /><p className="text-xl font-semibold text-gray-700">Loading order details...</p></div>
    </div>
  );

  if (!orderDetails) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-yellow-200 p-10 max-w-lg w-full text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6"><X className="w-10 h-10 text-yellow-600" /></div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Order Not Found</h2>
        <p className="text-gray-600 mb-6 text-lg">The order with ID "{orderId}" does not exist.</p>
        <Link href="/billing/orders" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold shadow-lg"><ArrowLeft className="w-5 h-5" />Go to Orders</Link>
      </div>
    </div>
  );

  if (viewingBilling) return (
    <BillingDetailModal billing={viewingBilling} mode={viewMode}
      onClose={() => { setViewingBilling(null); setViewMode('view'); }}
      onSave={handleSaveEdit} onDelete={handleDelete} onModeChange={setViewMode} />
  );

  const fmt = (n) => (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="max-w-[1900px] mx-auto p-6 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/billing/account/outstanding-report" className="p-2.5 hover:bg-white rounded-xl border border-gray-200 transition-all hover:shadow-md group">
              <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
            </Link>
            <div>
              <p className="text-sm text-gray-500 font-semibold mb-1">Monthly Billing for Order</p>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{orderId}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleAutoGenerate} disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Generating...' : 'Generate Billings'}
            </button>
            {billings.length > 0 && <>
              <button className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-green-500 text-green-700 rounded-xl hover:bg-green-50 transition-all font-semibold shadow-md hover:shadow-lg">
                <Download className="w-5 h-5" /> Export
              </button>
              <button onClick={handleDeleteAll} className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-red-500 text-red-700 rounded-xl hover:bg-red-50 transition-all font-semibold shadow-md hover:shadow-lg">
                <Trash2 className="w-5 h-5" /> Delete All
              </button>
            </>}
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FileText className="w-6 h-6 text-blue-600" />Order Information</h3>
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${orderDetails.status === 'PCD' ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-300' : 'bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-300'}`}>{orderDetails.status}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <div className="space-y-1"><p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Company Name</p><p className="text-base font-bold text-gray-900">{orderDetails.companyName}</p></div>
            <div className="space-y-1"><p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Entity</p><span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-bold">{orderDetails.entity}</span></div>
            <div className="space-y-1"><p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Product</p><span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-bold">{orderDetails.product}</span></div>
            <div className="space-y-1"><p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">PCD Date</p><p className="text-base font-bold text-gray-900 flex items-center gap-1"><CalendarIcon className="w-4 h-4 text-blue-600" />{formatDateToDisplayLocal(orderDetails.pcdDate)}</p></div>
            <div className="space-y-1"><p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Capacity</p><p className="text-base font-bold text-gray-900">{orderDetails.capacity} Mbps</p></div>
            {orderDetails.splitFactor?.isApplicable && (
              <div className="space-y-1"><p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Split Factor</p>
                <div className="flex items-center gap-2">
                  <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold">{orderDetails.billing1?.state}: {orderDetails.splitFactor.state1Percentage}%</span>
                  <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-bold">{orderDetails.billing2?.state}: {orderDetails.splitFactor.state2Percentage}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {[
            { label: 'Total Entries', val: totals.count, sub: 'Monthly billing records', icon: <FileCheck className="w-6 h-6 opacity-80" />, from: 'from-purple-500', to: 'to-purple-700', large: true },
            { label: 'Monthly Billing', val: `₹${fmt(totals.monthlyBilling)}`, sub: 'Base amount (excl. GST)', icon: <TrendingUp className="w-6 h-6 opacity-80" />, from: 'from-orange-500', to: 'to-orange-700' },
            { label: 'Total Received', val: `₹${fmt(totals.monthlyReceived)}`, sub: 'Payments received', icon: <DollarSign className="w-6 h-6 opacity-80" />, from: 'from-green-500', to: 'to-green-700' },
            { label: 'Credit Notes+GST', val: `₹${fmt(totals.monthlyCreditNotes)}`, sub: 'Total credit notes incl. GST', icon: <Receipt className="w-6 h-6 opacity-80" />, from: 'from-cyan-500', to: 'to-cyan-700' },
            { label: 'Final Balance', val: `₹${fmt(totals.finalBalance)}`, sub: 'Running balance', icon: <CheckCircle2 className="w-6 h-6 opacity-80" />, from: 'from-emerald-500', to: 'to-emerald-700' },
          ].map(({ label, val, sub, icon, from, to, large }) => (
            <div key={label} className={`relative overflow-hidden bg-gradient-to-br ${from} ${to} rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold uppercase tracking-wider opacity-90">{label}</p>{icon}</div>
                <p className={`${large ? 'text-4xl' : 'text-3xl'} font-extrabold`}>{val}</p>
                <p className="text-xs opacity-80 mt-1">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* State Filter */}
        {uniqueStates.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Filter className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-bold text-gray-900">Filter by State</h3>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{uniqueStates.length} {uniqueStates.length === 1 ? 'State' : 'States'}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setSelectedState('all')} className={`px-6 py-3 rounded-xl font-semibold transition-all ${selectedState === 'all' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'}`}>
                All States <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">{billings.length}</span>
              </button>
              {uniqueStates.map((state) => (
                <button key={state} onClick={() => setSelectedState(state)} className={`px-6 py-3 rounded-xl font-semibold transition-all ${selectedState === state ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105' : 'bg-white text-gray-700 hover:bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-400'}`}>
                  {state} <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${selectedState === state ? 'bg-white/20' : 'bg-indigo-100 text-indigo-700'}`}>{billings.filter(b => b.state === state).length}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Billings Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-6 h-6 text-blue-600" /> Monthly Billings with Running Balance
              {selectedState !== 'all' && <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold">{selectedState}</span>}
            </h3>
            <p className="text-sm text-gray-600 font-semibold">Showing {billingsWithBalance.length} of {billings.length} entries</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-3 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Month</th>
                  <th className="px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Days</th>
                  <th className="px-3 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Period</th>
                  <th className="px-3 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Invoice Date</th>
                  <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Monthly Billing</th>
                  {hasGSTColumns.hasCGST && <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">CGST (9%)</th>}
                  {hasGSTColumns.hasSGST && <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">SGST (9%)</th>}
                  {hasGSTColumns.hasIGST && <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">IGST (18%)</th>}
                  <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Total + GST</th>
                  <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Misc+GST Sell</th>
                  <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Received</th>
                  <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Credit Notes+GST</th>
                  <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">TDS Conf</th>
                  <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">TDS Prov</th>
                  <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider bg-yellow-50">Total Balance</th>
                  <th className="px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider bg-green-50">Remaining Adj</th>
                  <th className="px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {billingsWithBalance.map((billing, index) => {
                  const isFullyPaid = billing.monthlyCharges <= (billing.monthlyReceived + billing.monthlyCreditNotes + billing.monthlyTDSConf);
                  const unpaidAmount = billing.totalRemainingAdjustment;
                  return (
                    <tr key={billing._id} className={`border-b border-gray-100 transition-all ${index % 2 === 0 ? 'bg-white hover:bg-blue-50/50' : 'bg-gray-50/50 hover:bg-blue-50/50'}`}>
                      <td className="px-3 py-4 text-sm font-semibold text-gray-900">{billing.month}</td>
                      <td className="px-3 py-4 text-center text-sm font-semibold text-gray-900">{billing.billingDays}</td>
                      <td className="px-3 py-4 text-sm text-gray-700 font-medium">
                        <div className="flex flex-col text-xs"><span>{billing.startDate}</span><span>{billing.endDate}</span></div>
                      </td>
                      <td className="px-3 py-4 text-sm font-semibold text-blue-700">
                        {billing.invoiceDate || <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-4 text-right text-sm font-bold text-gray-900">₹{fmt(billing.monthlyBilling ?? 0)}</td>
                      {hasGSTColumns.hasCGST && <td className="px-3 py-4 text-right text-sm font-semibold text-gray-700">₹{fmt(billing.cgst ?? 0)}</td>}
                      {hasGSTColumns.hasSGST && <td className="px-3 py-4 text-right text-sm font-semibold text-gray-700">₹{fmt(billing.sgst ?? 0)}</td>}
                      {hasGSTColumns.hasIGST && <td className="px-3 py-4 text-right text-sm font-semibold text-gray-700">₹{fmt(billing.igst ?? 0)}</td>}
                      <td className="px-3 py-4 text-right text-sm font-bold text-indigo-700">₹{fmt(billing.totalWithGst ?? 0)}</td>
                      <td className="px-3 py-4 text-right text-sm font-semibold text-purple-700">₹{fmt(billing.monthlyMiscSell)}</td>
                      <td className="px-3 py-4 text-right text-sm font-semibold text-green-700">₹{fmt(billing.monthlyReceived)}</td>
                      <td className="px-3 py-4 text-right text-sm font-semibold text-cyan-700">₹{fmt(billing.monthlyCreditNotes)}</td>
                      <td className="px-3 py-4 text-right text-sm font-semibold text-blue-700">₹{fmt(billing.monthlyTDSConf)}</td>
                      <td className="px-3 py-4 text-right text-sm font-semibold text-orange-700">₹{fmt(billing.monthlyTDSProv)}</td>
                      <td className={`px-3 py-4 text-right text-sm font-extrabold bg-yellow-50 ${(billing.totalBalance ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>₹{fmt(billing.totalBalance ?? 0)}</td>
                      <td className="px-3 py-4 text-center bg-green-50">
                        {unpaidAmount === 0 || isFullyPaid
                          ? <button onClick={() => { setViewingBilling(billing); setViewMode('view'); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-semibold text-sm"><CheckCircle2 className="w-4 h-4" />Settled</button>
                          : unpaidAmount > 10000
                            ? <button onClick={() => { setViewingBilling(billing); setViewMode('view'); }} className="inline-flex items-center gap-1 px-3 py-1.5 text-red-700 hover:bg-red-50 rounded-lg transition-colors font-bold text-sm"><X className="w-4 h-4" />₹{unpaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</button>
                            : <button onClick={() => { setViewingBilling(billing); setViewMode('view'); }} className="inline-flex items-center gap-1 px-3 py-1.5 text-orange-700 hover:bg-orange-50 rounded-lg transition-colors font-bold text-sm"><AlertTriangle className="w-4 h-4" />₹{unpaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</button>
                        }
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setViewingBilling(billing); setViewMode('view'); }} className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors" title="View Details"><Eye className="w-4 h-4 text-blue-700" /></button>
                          <button onClick={() => { setViewingBilling(billing); setViewMode('edit'); }} className="p-2 bg-green-100 hover:bg-green-200 rounded-lg transition-colors" title="Edit Billing"><Edit2 className="w-4 h-4 text-green-700" /></button>
                          <button onClick={() => handleDelete(billing._id)} className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4 text-red-700" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gradient-to-r from-gray-100 to-blue-100 border-t-2 border-gray-300">
                <tr className="font-bold">
                  <td className="px-3 py-4 text-sm text-gray-900" colSpan="4">TOTAL</td>
                  <td className="px-3 py-4 text-right text-sm text-gray-900">₹{fmt(totals.monthlyBilling)}</td>
                  {hasGSTColumns.hasCGST && <td className="px-3 py-4 text-right text-sm text-gray-700">₹{fmt(totals.cgst)}</td>}
                  {hasGSTColumns.hasSGST && <td className="px-3 py-4 text-right text-sm text-gray-700">₹{fmt(totals.sgst)}</td>}
                  {hasGSTColumns.hasIGST && <td className="px-3 py-4 text-right text-sm text-gray-700">₹{fmt(totals.igst)}</td>}
                  <td className="px-3 py-4 text-right text-sm text-indigo-700">₹{fmt(totals.totalWithGst)}</td>
                  <td className="px-3 py-4 text-right text-sm text-purple-700">₹{fmt(totals.monthlyMiscSell)}</td>
                  <td className="px-3 py-4 text-right text-sm text-green-700">₹{fmt(totals.monthlyReceived)}</td>
                  <td className="px-3 py-4 text-right text-sm text-cyan-700">₹{fmt(totals.monthlyCreditNotes)}</td>
                  <td className="px-3 py-4 text-right text-sm text-blue-700">₹{fmt(totals.monthlyTDSConf)}</td>
                  <td className="px-3 py-4 text-right text-sm text-orange-700">₹{fmt(totals.monthlyTDSProv)}</td>
                  <td className={`px-3 py-4 text-right text-lg font-extrabold bg-yellow-100 ${totals.finalBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>₹{fmt(totals.finalBalance)}</td>
                  <td className="px-3 py-4 bg-green-100" colSpan="2" />
                </tr>
              </tfoot>
            </table>
            {billingsWithBalance.length === 0 && (
              <div className="text-center py-20">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6"><FileText className="w-12 h-12 text-gray-400" /></div>
                <p className="text-xl text-gray-700 font-semibold mb-2">{selectedState === 'all' ? 'No billings generated yet' : `No billings found for ${selectedState}`}</p>
                <p className="text-sm text-gray-500">{selectedState === 'all' ? 'Click "Generate Billings" button above to create monthly billing entries' : 'Try selecting a different state or generate new billings'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyBillGeneratorComp;