'use client'
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Search, X, Filter, Eye, Printer, Building2, Calendar,
  IndianRupee, FileText, CheckCircle2, AlertCircle,
  Loader2, RefreshCw, Hash, Layers, Wallet, CreditCard,
  Building, Smartphone, Banknote, ChevronDown, ChevronUp,
  MapPin, Clock
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────
const PAYMENT_TYPES = [
  {
    value: 'receivedDetails',
    label: 'Received',
    shortLabel: 'RCV',
    color: 'emerald',
    badgeCls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    activeCls: 'bg-emerald-600 text-white border-emerald-600',
    dotCls: 'bg-emerald-400',
  },
  {
    value: 'tdsProvision',
    label: 'TDS Provision',
    shortLabel: 'TDS-P',
    color: 'amber',
    badgeCls: 'bg-amber-50 text-amber-700 border border-amber-200',
    activeCls: 'bg-amber-500 text-white border-amber-500',
    dotCls: 'bg-amber-400',
  },
  {
    value: 'tdsConfirm',
    label: 'TDS Confirm',
    shortLabel: 'TDS-C',
    color: 'violet',
    badgeCls: 'bg-violet-50 text-violet-700 border border-violet-200',
    activeCls: 'bg-violet-600 text-white border-violet-600',
    dotCls: 'bg-violet-400',
  },
]

const PAYMENT_METHOD_META = {
  cash:   { label: 'Cash',   icon: Wallet,     color: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  cheque: { label: 'Cheque', icon: CreditCard, color: 'blue',    bg: 'bg-blue-100',    text: 'text-blue-700'    },
  neft:   { label: 'NEFT',   icon: Building,   color: 'violet',  bg: 'bg-violet-100',  text: 'text-violet-700'  },
  upi:    { label: 'UPI',    icon: Smartphone, color: 'orange',  bg: 'bg-orange-100',  text: 'text-orange-700'  },
}

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (n) => (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtShort = (n) => {
  if (!n) return '₹0'
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}
const typeInfo = (val) => PAYMENT_TYPES.find(t => t.value === val) || PAYMENT_TYPES[0]
const fmtCreatedAt = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
const getPaymentMethodMeta = (method) => PAYMENT_METHOD_META[method] || PAYMENT_METHOD_META.cash

// ─── Compute monthly total for an entry ──────────────────────
const getMonthlyTotal = (entry) => {
  const adjs = entry.monthlyAdjustments || []
  if (!adjs.length) return null
  return adjs.reduce((s, a) => s + (Number(a.adjustedAmount) || 0) + (Number(a.remainingAmount) || 0), 0)
}

// ─── Status Pill ──────────────────────────────────────────────
const StatusPill = ({ adj }) => {
  if (adj.amountStatus === 'Fully Paid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" />Fully Paid
      </span>
    )
  }
  if (adj.amountStatus === 'Partially Paid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200">
        <AlertCircle className="w-2.5 h-2.5 flex-shrink-0" />Partial
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide bg-red-100 text-red-600 border border-red-200">
      <X className="w-2.5 h-2.5 flex-shrink-0" />Not Paid
    </span>
  )
}

// ─── PDF Entry Card ────────────────────────────────────────────
const PdfEntryCard = ({ entry, index }) => {
  // ✅ Only show Fully Paid or Partially Paid — skip Not Paid rows
  const adjs = (entry.monthlyAdjustments || []).filter(adj =>
    adj.amountStatus === 'Fully Paid' || adj.amountStatus === 'Partially Paid'
  )
  const hasAdjs = adjs.length > 0

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-2.5 bg-white break-inside-avoid">
      {/* Card Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-[22px] h-[22px] rounded-[6px] bg-white/15 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
            {index + 1}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-black text-white font-mono tracking-tight">
                {entry.orderId}
              </span>
              {entry.isSplit && (
                <span className="text-[8px] font-black text-violet-300 bg-violet-500/30 border border-violet-400/30 px-1.5 py-px rounded uppercase">
                  Split {entry.splitPct}%
                </span>
              )}
            </div>
            {entry.companyName && (
              <p className="text-[10px] text-slate-400 mt-0.5 mb-0">{entry.companyName}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-black text-slate-500 uppercase tracking-widest mb-0.5 mt-0">Amount</p>
          <p className="text-base font-black text-emerald-400 mt-0 mb-0 leading-none">₹{fmt(entry.amount)}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="px-3.5 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">State:</span>
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-px rounded-[5px]">
            {entry.state || '-'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Payment Date:</span>
          <span className="text-[10px] font-bold text-slate-700 font-mono">{entry.date || '-'}</span>
        </div>
        {entry.month && (
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Billing:</span>
            <span className="text-[10px] font-bold text-slate-700">{entry.month}</span>
          </div>
        )}
      </div>

      {/* Invoice Adjustments — only Paid / Partial */}
      {hasAdjs && (
        <div className="p-3.5">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[1.5px] mb-2 mt-0">
            Invoice Adjustments ({adjs.length})
          </p>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100">
                {['#', 'Month', 'Invoice No', 'Invoice Date', 'Monthly Bill', 'Status', 'Monthly Remaining', 'Adjusted Amt', 'Pending Bill'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-[8px] font-black text-slate-500 uppercase tracking-[0.8px] border-b border-slate-200 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adjs.map((adj, i) => {
                const isFullyPaid   = adj.amountStatus === 'Fully Paid'
                const isPartialPaid = adj.amountStatus === 'Partially Paid'
                const rowBg = isFullyPaid ? 'bg-emerald-50/30' : 'bg-amber-50/30'
                const rowMonthlyTotal = (Number(adj.adjustedAmount) || 0) + (Number(adj.remainingAmount) || 0)
                return (
                  <tr key={i} className={`${i % 2 === 0 ? rowBg : 'bg-white'} border-b border-slate-50`}>
                    <td className="px-2 py-1.5 font-bold text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1.5 font-extrabold text-slate-900">{adj.month}</td>
                    <td className="px-2 py-1.5 font-bold text-blue-600 font-mono text-[9px]">
                      {adj.invoiceNumber && adj.invoiceNumber !== '-' ? adj.invoiceNumber : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-slate-500">
                      {adj.invoiceDate && adj.invoiceDate !== '-' ? adj.invoiceDate : '—'}
                    </td>
                    <td className="px-2 py-1.5 font-black text-violet-700 text-right whitespace-nowrap">
                      ₹{fmt(adj.monthlyAmount)}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-[0.5px] whitespace-nowrap border
                        ${isFullyPaid
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                        {isFullyPaid ? 'Fully Paid' : 'Partial'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 font-black text-violet-700 text-right whitespace-nowrap">
                      ₹{fmt(rowMonthlyTotal)}
                    </td>
                    <td className={`px-2 py-1.5 font-black text-right whitespace-nowrap
                      ${isFullyPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                      ₹{fmt(adj.adjustedAmount)}
                    </td>
                    <td className="px-2 py-1.5 text-red-700 font-bold text-right whitespace-nowrap">
                      {Number(adj.remainingAmount) > 0 ? `₹${fmt(adj.remainingAmount)}` : ' ₹0'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!hasAdjs && (
        <div className="px-3.5 py-2 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 italic m-0">No paid or partial adjustments recorded</p>
        </div>
      )}
    </div>
  )
}


// ─── Report Modal ─────────────────────────────────────────────
const ReportModal = React.memo(({ record, onClose }) => {
  const t  = typeInfo(record.paymentType)
  const pm = getPaymentMethodMeta(record.paymentMethod)
  const PmIcon = pm.icon

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'dist-report-print'
    style.innerHTML = `
      @media print {
        body > * { visibility: hidden !important; }
        #dist-report-printable, #dist-report-printable * { visibility: visible !important; }
        #dist-report-printable {
          position: fixed !important; top: 0 !important; left: 0 !important;
          width: 100vw !important; padding: 20px !important;
          background: white !important; z-index: 99999 !important;
          font-size: 11px !important;
        }
        @page { margin: 15mm; size: A4; }
      }
    `
    document.head.appendChild(style)
    return () => { document.getElementById('dist-report-print')?.remove() }
  }, [])

  const entries        = (record.entries || []).filter(e => Number(e.amount) > 0)
  const totalAllocated = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const splitCount     = entries.filter(e => e.isSplit).length
  const uniqueOrders   = new Set(entries.map(e => e.orderId)).size
  const now            = new Date()
  const generatedOn    = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const generatedAt    = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const recordRef      = record._id?.slice(-8).toUpperCase() || 'N/A'

  const pmIconBg = pm.color === 'blue'
    ? 'bg-blue-100'
    : pm.color === 'violet'
    ? 'bg-violet-100'
    : pm.color === 'orange'
    ? 'bg-orange-100'
    : 'bg-emerald-100'

  const typePillStyle = t.value === 'receivedDetails'
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : t.value === 'tdsProvision'
    ? 'bg-amber-50 text-amber-800 border-amber-200'
    : 'bg-violet-50 text-violet-800 border-violet-200'

  const typeDotStyle = t.value === 'receivedDetails'
    ? 'bg-emerald-400'
    : t.value === 'tdsProvision'
    ? 'bg-amber-400'
    : 'bg-violet-500'

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 overflow-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{ maxWidth: '860px', maxHeight: '97vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Payment Distribution Report</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Ref #{recordRef}</p>
            </div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${t.badgeCls}`}>{t.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all">
              <Printer className="w-3.5 h-3.5" />Print / PDF
            </button>
            <button onClick={onClose} className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/10">
              <X className="w-3.5 h-3.5" />Close
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-auto flex-1 bg-slate-100 p-4">
          <div id="dist-report-printable" className="bg-white rounded-xl shadow-sm mx-auto max-w-[800px] font-sans">

            {/* ── PDF HEADER ── */}
            <div className="px-7 pt-6 pb-5 border-b-2 border-slate-100">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="w-[42px] h-[42px] bg-slate-900 rounded-[10px] flex items-center justify-center flex-shrink-0">
                      <Banknote className="w-[22px] h-[22px] text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl font-black text-slate-900 m-0 tracking-tight leading-none">
                        PAYMENT DISTRIBUTION REPORT
                      </h1>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1 mb-0 uppercase tracking-[1.5px]">
                        Confidential · Internal Use Only
                      </p>
                    </div>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${typePillStyle}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${typeDotStyle}`} />
                    {t.label}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 mt-0">Generated</p>
                  <p className="text-[13px] font-bold text-slate-800 mb-0.5 mt-0">{generatedOn}</p>
                  <p className="text-[10px] text-slate-500 mb-1.5 mt-0">{generatedAt}</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-[6px] px-2.5 py-1 inline-block">
                    <p className="text-[9px] font-mono font-bold text-slate-500 m-0">#{recordRef}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-7 py-5">

              {/* ── INFO GRID 4-col ── */}
              <div className="grid grid-cols-4 gap-2.5 mb-3.5">
                {[
                  { label: 'Company Group', value: record.companyGroup, cls: 'bg-blue-50 border-blue-200 text-blue-800' },
                  { label: 'Payment Date',  value: record.paymentDate,  cls: 'bg-slate-50 border-slate-200 text-slate-800' },
                  { label: 'Billing Month', value: record.billingMonth, cls: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
                  { label: 'Payment Type',  value: t.label,             cls: 'bg-slate-50 border-slate-200 text-slate-800' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className={`border rounded-lg px-3 py-2.5 ${cls}`}>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-0">{label}</p>
                    <p className="text-[13px] font-black m-0 leading-snug">{value || '—'}</p>
                  </div>
                ))}
              </div>

              {/* ── PAYMENT METHOD ── */}
              <div className="bg-slate-50 border border-slate-200 rounded-[10px] px-4 py-3 mb-3.5">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className={`w-[34px] h-[34px] rounded-lg ${pmIconBg} flex items-center justify-center flex-shrink-0`}>
                    <PmIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 mt-0">Payment Method</p>
                    <p className="text-[13px] font-black uppercase text-slate-900 m-0">{pm.label}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {record.bankName && (
                    <div className="bg-white border border-slate-200 rounded-[6px] px-2.5 py-1.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 mt-0">Bank</p>
                      <p className="text-[11px] font-bold text-slate-700 m-0">{record.bankName}</p>
                    </div>
                  )}
                  {record.chequeNumber && (
                    <div className="bg-white border border-slate-200 rounded-[6px] px-2.5 py-1.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 mt-0">Cheque No.</p>
                      <p className="text-[11px] font-mono font-bold text-blue-600 m-0">{record.chequeNumber}</p>
                    </div>
                  )}
                  {record.chequeDate && (
                    <div className="bg-white border border-slate-200 rounded-[6px] px-2.5 py-1.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 mt-0">Cheque Date</p>
                      <p className="text-[11px] font-mono font-bold text-blue-600 m-0">{record.chequeDate}</p>
                    </div>
                  )}
                  {record.neftId && (
                    <div className="bg-white border border-slate-200 rounded-[6px] px-2.5 py-1.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 mt-0">NEFT ID</p>
                      <p className="text-[11px] font-mono font-bold text-violet-700 m-0">{record.neftId}</p>
                    </div>
                  )}
                  {record.transactionId && (
                    <div className="bg-white border border-slate-200 rounded-[6px] px-2.5 py-1.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 mt-0">Transaction ID</p>
                      <p className="text-[11px] font-mono font-bold text-orange-600 m-0 break-all">{record.transactionId}</p>
                    </div>
                  )}
                  {record.paymentNote && (
                    <div className="bg-white border border-slate-200 rounded-[6px] px-2.5 py-1.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 mt-0">Note</p>
                      <p className="text-[11px] text-slate-700 m-0">{record.paymentNote}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── TOTAL AMOUNT BANNER ── */}
              <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl px-5 py-4 mb-3.5 relative overflow-hidden">
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-[9px] font-black text-emerald-200 uppercase tracking-[2px] mb-1 mt-0">
                      Total Amount Distributed
                    </p>
                    <p className="text-[32px] font-black text-white m-0 tracking-tight leading-none">
                      ₹{fmt(record.totalAmount)}
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    {[
                      { label: 'Orders',     value: uniqueOrders   },
                      { label: 'Entries',    value: entries.length },
                      { label: 'Split Rows', value: splitCount     },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white/15 rounded-lg px-3.5 py-2 text-center">
                        <p className="text-xl font-black text-white m-0 leading-none">{value}</p>
                        <p className="text-[8px] font-bold text-emerald-200 uppercase tracking-[0.5px] mt-1 mb-0">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {record.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5 mb-3.5">
                  <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1 mt-0">Reference / Notes</p>
                  <p className="text-[11px] text-amber-900 leading-relaxed m-0 whitespace-pre-wrap">{record.notes}</p>
                </div>
              )}

              {/* ── DISTRIBUTION BREAKDOWN ── */}
              <div className="mb-5">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[2px] m-0 whitespace-nowrap">
                    Distribution Breakdown
                  </h2>
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                    {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
                  </span>
                  {splitCount > 0 && (
                    <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                      {splitCount} split
                    </span>
                  )}
                </div>

                {entries.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-[10px] border border-dashed border-slate-200 text-slate-400">
                    <p className="text-[13px] font-bold m-0">No entries recorded</p>
                  </div>
                ) : (
                  <>
                    <div>
                      {entries.map((entry, idx) => (
                        <PdfEntryCard
                          key={`${entry.orderId}-${entry.state}-${idx}`}
                          entry={entry}
                          index={idx}
                        />
                      ))}
                    </div>

                    {/* Grand total */}
                    <div className="flex items-center justify-between px-4.5 py-3 bg-slate-900 rounded-[10px] mt-1">
                      <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[1.5px] mb-0.5 mt-0">
                          Grand Total — {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} · {uniqueOrders} order{uniqueOrders !== 1 ? 's' : ''}
                        </p>
                        {Math.abs(totalAllocated - record.totalAmount) > 0.01 && (
                          <p className="text-[9px] text-amber-400 font-bold m-0">
                            ⚠ Sum ₹{fmt(totalAllocated)} vs Recorded ₹{fmt(record.totalAmount)}
                          </p>
                        )}
                      </div>
                      <p className="text-[22px] font-black text-white m-0">₹{fmt(totalAllocated)}</p>
                    </div>
                  </>
                )}
              </div>

              {/* ── FOOTER ── */}
              <div className="flex items-center justify-between pt-3.5 border-t-2 border-dashed border-slate-200">
                <div>
                  <p className="text-[9px] text-slate-400 font-medium mb-0.5 mt-0">
                    This is a system-generated report. No signature required.
                  </p>
                  <p className="text-[9px] text-slate-400 m-0">
                    Generated on {generatedOn} at {generatedAt} · Record #{recordRef}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-slate-900 rounded-[7px] flex items-center justify-center flex-shrink-0">
                    <Banknote className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Billing Management System
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
ReportModal.displayName = 'ReportModal'

// ─── Confirm Delete Popover ────────────────────────────────────
const DeleteConfirm = ({ onConfirm, onCancel }) => (
  <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border border-red-200 rounded-xl shadow-xl p-3 w-52" onClick={e => e.stopPropagation()}>
    <p className="text-xs font-bold text-slate-700 mb-2">Delete this record?</p>
    <p className="text-[10px] text-slate-400 mb-3">This cannot be undone.</p>
    <div className="flex gap-2">
      <button onClick={onCancel} className="flex-1 px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
      <button onClick={onConfirm} className="flex-1 px-2.5 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg">Delete</button>
    </div>
  </div>
)

// ─── Stat Card ────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, iconCls, borderCls }) => (
  <div className={`bg-white rounded-2xl border shadow-sm p-5 ${borderCls || 'border-slate-200'}`}>
    <div className="mb-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconCls || 'bg-slate-100'}`}>
        <Icon style={{ width: '18px', height: '18px' }} />
      </div>
    </div>
    <p className="text-2xl font-black text-slate-900 leading-none mb-1">{value}</p>
    {sub && <p className="text-xs font-semibold text-slate-400 mb-1">{sub}</p>}
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
  </div>
)

// ─── Main Page ────────────────────────────────────────────────
export default function PaymentReportComp() {
  const [records, setRecords]       = useState([])
  const [groups, setGroups]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [groupQuery, setGroupQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [textSearch, setTextSearch] = useState('')
  const [viewRecord, setViewRecord] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [toast, setToast]           = useState(null)
  const groupInputRef               = useRef(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (groupQuery.trim()) params.set('companyGroup', groupQuery.trim())
      if (typeFilter)        params.set('paymentType', typeFilter)
      const res  = await fetch(`/api/billing/distributed?${params}`)
      const json = await res.json()
      if (json.success) {
        setRecords(json.data  || [])
        setGroups(json.groups || [])
      } else {
        showToast(json.error || 'Failed to load records', 'error')
      }
    } catch (e) {
      console.error('[DistributedPage] fetch error', e)
      showToast('Failed to load records', 'error')
    } finally {
      setLoading(false)
    }
  }, [groupQuery, typeFilter, showToast])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const filteredRecords = useMemo(() => {
    if (!textSearch.trim()) return records
    const q = textSearch.toLowerCase().trim()
    return records.filter(r =>
      r.companyGroup?.toLowerCase().includes(q) ||
      r.billingMonth?.toLowerCase().includes(q) ||
      r.paymentDate?.includes(q) ||
      r.notes?.toLowerCase().includes(q) ||
      r.paymentMethod?.toLowerCase().includes(q) ||
      r.entries?.some(e =>
        e.orderId?.toLowerCase().includes(q) ||
        e.companyName?.toLowerCase().includes(q) ||
        e.state?.toLowerCase().includes(q)
      )
    )
  }, [records, textSearch])

  const stats = useMemo(() => {
    const totalAmt     = filteredRecords.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0)
    const totalEntries = filteredRecords.reduce((s, r) => s + (r.entryCount || 0), 0)
    const byType = PAYMENT_TYPES.map(t => ({
      ...t,
      count:  filteredRecords.filter(r => r.paymentType === t.value).length,
      amount: filteredRecords.filter(r => r.paymentType === t.value).reduce((s, r) => s + (Number(r.totalAmount) || 0), 0),
    }))
    return { total: filteredRecords.length, totalAmt, totalEntries, byType }
  }, [filteredRecords])

  const hasFilters = groupQuery || typeFilter || textSearch

  const handleDelete = async (id) => {
    try {
      const res  = await fetch(`/api/billing/distributed?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) { showToast('Record deleted'); fetchRecords() }
      else showToast(json.error || 'Delete failed', 'error')
    } catch (e) { showToast('Delete failed', 'error') }
    setDeletingId(null)
  }

  return (
    <div className="min-h-screen bg-slate-50/80 p-4 lg:p-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[99999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-bold border ${toast.type === 'error' ? 'bg-red-600 text-white border-red-700' : 'bg-emerald-600 text-white border-emerald-700'}`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-5">

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Distribution Records</h1>
            </div>
            <p className="text-sm text-slate-400 font-medium ml-10">Search, filter and view all payment distribution reports</p>
          </div>
          <button
            onClick={fetchRecords}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-500' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FileText}    label="Total Records"  value={stats.total}                                             iconCls="bg-slate-100 text-slate-600"   borderCls="border-slate-200" />
          <StatCard icon={IndianRupee} label="Total Amount"   value={fmtShort(stats.totalAmt)} sub={`₹${fmt(stats.totalAmt)}`} iconCls="bg-emerald-100 text-emerald-600" borderCls="border-emerald-200" />
          <StatCard icon={Hash}        label="Order Entries"  value={stats.totalEntries}                                      iconCls="bg-violet-100 text-violet-600"  borderCls="border-violet-200" />
          <StatCard icon={Building2}   label="Company Groups" value={groups.length}                                           iconCls="bg-blue-100 text-blue-600"      borderCls="border-blue-200" />
        </div>

        {/* Type Summary Strip */}
        <div className="grid grid-cols-3 gap-3">
          {stats.byType.map(t => (
            <div
              key={t.value}
              className={`rounded-xl border p-4 bg-white shadow-sm cursor-pointer transition-all hover:shadow-md ${typeFilter === t.value ? 'ring-2 ring-offset-1 ring-slate-900' : ''}`}
              onClick={() => setTypeFilter(v => v === t.value ? '' : t.value)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${t.badgeCls}`}>{t.label}</span>
                <span className="text-xs font-bold text-slate-400">{t.count} records</span>
              </div>
              <p className="text-xl font-black text-slate-900">{fmtShort(t.amount)}</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">₹{fmt(t.amount)}</p>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Search & Filter</h2>
            {hasFilters && (
              <span className="text-[10px] font-black text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full uppercase">Filters active</span>
            )}
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Company Group</label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input ref={groupInputRef} type="text" value={groupQuery} onChange={e => setGroupQuery(e.target.value)}
                    placeholder="Search company group…" list="grp-suggestions"
                    className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white font-medium text-slate-700 placeholder:text-slate-300" />
                  <datalist id="grp-suggestions">{groups.map(g => <option key={g} value={g} />)}</datalist>
                  {groupQuery && (
                    <button onClick={() => setGroupQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded-md">
                      <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
              <div className="min-w-[340px]">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Payment Type</label>
                <div className="flex gap-1.5">
                  <button onClick={() => setTypeFilter('')} className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-black border transition-all ${!typeFilter ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>All</button>
                  {PAYMENT_TYPES.map(t => (
                    <button key={t.value} onClick={() => setTypeFilter(v => v === t.value ? '' : t.value)}
                      className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-black border transition-all whitespace-nowrap ${typeFilter === t.value ? t.activeCls + ' shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                      {t.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Quick Search</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input type="text" value={textSearch} onChange={e => setTextSearch(e.target.value)}
                    placeholder="Order ID, company, month, date…"
                    className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white font-medium text-slate-700 placeholder:text-slate-300" />
                  {textSearch && (
                    <button onClick={() => setTextSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded-md">
                      <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
              {hasFilters && (
                <button onClick={() => { setGroupQuery(''); setTypeFilter(''); setTextSearch('') }}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 text-rose-600 text-sm rounded-xl border border-rose-200 hover:bg-rose-100 font-bold transition-all self-end">
                  <X className="w-3.5 h-3.5" />Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-xl bg-violet-100 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-violet-600" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Records</h2>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
              {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
              {filteredRecords.length !== records.length && ` (of ${records.length})`}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                <p className="text-sm text-slate-400 font-semibold">Loading records…</p>
              </div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-500 mb-1">No records found</p>
              <p className="text-xs text-slate-400 text-center max-w-xs">
                {hasFilters ? 'Try clearing some filters, or' : ''} Submit payments from the Bulk Update page to create distribution records.
              </p>
              {hasFilters && (
                <button onClick={() => { setGroupQuery(''); setTypeFilter(''); setTextSearch('') }}
                  className="mt-3 text-xs font-bold text-violet-600 hover:text-violet-800 underline">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['#', 'Company Group', 'Billing Month', 'Payment Date', 'Method', 'Type', 'Total Amount', 'Entries', 'Submitted At', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((rec, idx) => {
                    const t      = typeInfo(rec.paymentType)
                    const pm     = getPaymentMethodMeta(rec.paymentMethod)
                    const PmIcon = pm.icon
                    return (
                      <tr key={rec._id} className="hover:bg-violet-50/30 transition-colors group relative">
                        <td className="px-4 py-3.5 text-xs font-black text-slate-300">{idx + 1}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                              <Building2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-600 transition-colors" />
                            </div>
                            <span className="font-black text-slate-800">{rec.companyGroup}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100">{rec.billingMonth}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">{rec.paymentDate}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${pm.bg} ${pm.text}`}>
                            <PmIcon className="w-3 h-3" />{pm.label}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border ${t.badgeCls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${t.dotCls}`} />{t.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-base font-black text-emerald-700">₹{fmt(rec.totalAmount)}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg">{rec.entryCount || 0} entries</span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-400 font-medium whitespace-nowrap">{fmtCreatedAt(rec.createdAt)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 relative">
                            <button onClick={() => setViewRecord(rec)}
                              className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black transition-all shadow-sm hover:shadow whitespace-nowrap">
                              <Eye className="w-3.5 h-3.5" />View Report
                            </button>
                            <div className="relative">
                              <button onClick={() => setDeletingId(v => v === rec._id ? null : rec._id)}
                                className="p-2 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-500 transition-colors border border-transparent hover:border-red-200">
                                <X className="w-3.5 h-3.5" />
                              </button>
                              {deletingId === rec._id && (
                                <DeleteConfirm onConfirm={() => handleDelete(rec._id)} onCancel={() => setDeletingId(null)} />
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {deletingId && <div className="fixed inset-0 z-40" onClick={() => setDeletingId(null)} />}
      {viewRecord && <ReportModal record={viewRecord} onClose={() => setViewRecord(null)} />}
    </div>
  )
}
