'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Download, X, Eye, EyeOff, Info, ArrowLeft, FileText, FileSpreadsheet } from 'lucide-react'
import { useRouter } from 'next/navigation'

const INDIAN_STATES = [
  "Delhi","Maharashtra","Karnataka","Tamil Nadu","Uttar Pradesh",
  "Haryana","Punjab","Gujarat","West Bengal","Rajasthan","Other"
]
const ENTITIES    = ["WIBRO","GTEL","GISPL"]
const ALL_MONTHS  = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]

// ─── Date helpers ─────────────────────────────────────────────
const parseAnyDate = (s) => {
  if (!s) return null
  if (typeof s === 'object' && s instanceof Date) return s
  if (s.includes('T') || s.includes('Z')) {
    const d = new Date(s)
    return isNaN(d) ? null : d
  }
  const p = s.split('-')
  if (p.length !== 3) return null
  const [dd, mm, yyyy] = p.map(Number)
  if (!dd || !mm || !yyyy) return null
  return new Date(yyyy, mm - 1, dd)
}

const getCurrentYear  = () => new Date().getFullYear()
const getCurrentMonth = () => new Date().getMonth()
const getDaysInMonth  = (m, y) => new Date(y, m + 1, 0).getDate()
const getLastDayOfMonth = (m, y) => {
  const d = getDaysInMonth(m, y)
  return `${String(d).padStart(2,'0')}-${String(m+1).padStart(2,'0')}-${y}`
}
const todayDDMMYYYY = () => {
  const n = new Date()
  return `${String(n.getDate()).padStart(2,'0')}-${String(n.getMonth()+1).padStart(2,'0')}-${n.getFullYear()}`
}
const toInputFmt  = (s) => { if (!s) return ''; const [d,m,y] = s.split('-'); return `${y}-${m}-${d}` }
const toStorageFmt = (s) => { if (!s) return ''; const [y,m,d] = s.split('-'); return `${d}-${m}-${y}` }
const fmtMonthYear = (m, y) => `${MONTH_NAMES[m]} ${y}`

const getDefaultDateRange = () => {
  const y = getCurrentYear(), m = getCurrentMonth()+1, d = new Date().getDate()
  return { from: `${y}-01-01`, to: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` }
}
const getYearOptions     = () => ["All", ...Array.from({length:6}, (_,i) => getCurrentYear()-i)]
const getAvailMonths     = (y) => y === getCurrentYear() ? ALL_MONTHS.slice(0, getCurrentMonth()+1) : ALL_MONTHS

// ─── Amount helpers ───────────────────────────────────────────
const sumField = (arr, field) => (!arr?.length) ? 0 : arr.reduce((s,i) => s+(Number(i[field])||0), 0)
const sumAmount       = (arr) => sumField(arr, 'amount')
const sumTotalWithGst = (arr) => arr?.length ? arr.reduce((s,i) => s+(Number(i.totalWithGst)||Number(i.amount)||0), 0) : 0

const fmt = (n) => (n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})

// ─── Split billing detection ──────────────────────────────────
const isSplit = (order) => {
  const s1 = order.billing1?.state||'', s2 = order.billing2?.state||''
  return order.product === 'NLD' && s1 !== s2 && s2 !== ''
}

// ─── Credit-pool balance algorithm ────
const creditPoolBalance = (months) => {
  if (!months?.length) return 0
  const sorted = [...months].sort((a,b)=>new Date(a.year,a.month)-new Date(b.year,b.month))
  const pool0  = sorted.reduce((s,m) => s + m.received + m.creditNotes + m.tdsConfirm, 0)
  let pool = pool0, running = 0
  sorted.forEach(m => {
    const charges = m.totalWithGst + m.miscSell
    const credits = m.received + m.creditNotes + m.tdsConfirm
    running += charges - credits
    pool = Math.max(0, pool - charges)
  })
  return running
}

// ─── Text truncation with popup ────────────────────────────────
const TextPopup = React.memo(({ text, onClose }) => {
  useEffect(()=>{ 
    const h=e=>{if(e.key==='Escape')onClose()}
    document.addEventListener('keydown',h)
    return ()=>document.removeEventListener('keydown',h) 
  },[onClose])
  
  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[70vh] overflow-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <p className="font-semibold text-slate-800">Full Text</p>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400"/></button>
        </div>
        <p className="px-5 py-4 text-sm text-slate-700 break-words whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  )
})
TextPopup.displayName = 'TextPopup'

const TruncatedText = React.memo(({ text, limit = 18, className = '' }) => {
  const [showPopup, setShowPopup] = useState(false)
  
  if (!text) return <span className={className}>-</span>
  if (text.length <= limit) return <span className={className}>{text}</span>
  
  return (
    <>
      <span className={className}>
        {text.slice(0, limit)}
        <button 
          onClick={() => setShowPopup(true)}
          className="text-blue-600 hover:text-blue-700 hover:underline ml-1 font-medium"
        >
          ..more
        </button>
      </span>
      {showPopup && <TextPopup text={text} onClose={() => setShowPopup(false)} />}
    </>
  )
})
TruncatedText.displayName = 'TruncatedText'

// ─── NEW: Array Details Popup ─────────────────────────────────
const ArrayDetailsPopup = React.memo(({ data, title, onClose }) => {
  useEffect(()=>{ 
    const h=e=>{if(e.key==='Escape')onClose()}
    document.addEventListener('keydown',h)
    return ()=>document.removeEventListener('keydown',h) 
  },[onClose])

  if (!data || data.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[10002] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={e=>e.stopPropagation()}>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white"/>
            </button>
          </div>
          <div className="p-8 text-center">
            <p className="text-slate-500">No data available</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[10002] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={e=>e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10 rounded-t-xl">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white"/>
          </button>
        </div>
        
        <div className="p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">Amount</th>
                {data[0]?.cgst !== undefined && <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">CGST</th>}
                {data[0]?.sgst !== undefined && <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">SGST</th>}
                {data[0]?.igst !== undefined && <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">IGST</th>}
                {data[0]?.totalWithGst !== undefined && <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">Basic + GST</th>}
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-3 text-sm text-slate-800 font-semibold">{item.date || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-bold text-right">₹{fmt(item.amount || 0)}</td>
                  {data[0]?.cgst !== undefined && <td className="px-4 py-3 text-sm text-slate-700 text-right">₹{fmt(item.cgst || 0)}</td>}
                  {data[0]?.sgst !== undefined && <td className="px-4 py-3 text-sm text-slate-700 text-right">₹{fmt(item.sgst || 0)}</td>}
                  {data[0]?.igst !== undefined && <td className="px-4 py-3 text-sm text-slate-700 text-right">₹{fmt(item.igst || 0)}</td>}
                  {data[0]?.totalWithGst !== undefined && <td className="px-4 py-3 text-sm text-indigo-700 font-bold text-right">₹{fmt(item.totalWithGst || 0)}</td>}
                  <td className="px-4 py-3 text-sm text-slate-600">{item.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-slate-300">
              <tr className="font-bold">
                <td className="px-4 py-3 text-sm text-slate-900">TOTAL</td>
                <td className="px-4 py-3 text-sm text-slate-900 text-right">₹{fmt(sumAmount(data))}</td>
                {data[0]?.cgst !== undefined && <td className="px-4 py-3 text-sm text-slate-700 text-right">₹{fmt(sumField(data, 'cgst'))}</td>}
                {data[0]?.sgst !== undefined && <td className="px-4 py-3 text-sm text-slate-700 text-right">₹{fmt(sumField(data, 'sgst'))}</td>}
                {data[0]?.igst !== undefined && <td className="px-4 py-3 text-sm text-slate-700 text-right">₹{fmt(sumField(data, 'igst'))}</td>}
                {data[0]?.totalWithGst !== undefined && <td className="px-4 py-3 text-sm text-indigo-700 text-right">₹{fmt(sumTotalWithGst(data))}</td>}
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
})
ArrayDetailsPopup.displayName = 'ArrayDetailsPopup'

// ─── Month Detail View Popup ─────────────────────────────────
const MonthDetailView = ({ monthData, rawData, onClose }) => {
  const [detailsPopup, setDetailsPopup] = useState(null)

  if (!monthData) return null

  const showDetails = (data, title) => {
    setDetailsPopup({ data, title })
  }
  
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[10001] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
            <div>
              <h3 className="text-xl font-bold text-white">Month Details</h3>
              <p className="text-blue-100 text-sm mt-0.5">{monthData.monthYear}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white"/>
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Billing Days</p>
                <p className="text-2xl font-bold text-slate-900">{monthData.billingDays}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Start Date</p>
                <p className="text-lg font-bold text-slate-900">
                  {String(monthData.startDay).padStart(2,'0')}-{String(monthData.month+1).padStart(2,'0')}-{monthData.year}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">End Date</p>
                <p className="text-lg font-bold text-slate-900">
                  {String(monthData.endDay).padStart(2,'0')}-{String(monthData.month+1).padStart(2,'0')}-{monthData.year}
                </p>
              </div>
            </div>
            
            {/* Billing Details */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-200">Billing Amounts</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded">
                  <span className="text-sm text-slate-600">Monthly Basic Bill:</span>
                  <span className="text-sm font-bold text-slate-900">₹{fmt(monthData.monthlyBilling)}</span>
                </div>
                {monthData.cgst > 0 && (
                  <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded">
                    <span className="text-sm text-slate-600">CGST (9%):</span>
                    <span className="text-sm font-bold text-slate-900">₹{fmt(monthData.cgst)}</span>
                  </div>
                )}
                {monthData.sgst > 0 && (
                  <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded">
                    <span className="text-sm text-slate-600">SGST (9%):</span>
                    <span className="text-sm font-bold text-slate-900">₹{fmt(monthData.sgst)}</span>
                  </div>
                )}
                {monthData.igst > 0 && (
                  <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded">
                    <span className="text-sm text-slate-600">IGST (18%):</span>
                    <span className="text-sm font-bold text-slate-900">₹{fmt(monthData.igst)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 px-3 bg-indigo-50 rounded border-2 border-indigo-200">
                  <span className="text-sm font-bold text-indigo-700">Basic + GST:</span>
                  <span className="text-sm font-bold text-indigo-900">₹{fmt(monthData.totalWithGst)}</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-purple-50 rounded">
                  <span className="text-sm text-purple-600">Misc+GST Sell:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-purple-900">₹{fmt(monthData.miscSell)}</span>
                    {rawData?.miscellaneousSell?.length > 0 && (
                      <button 
                        onClick={() => showDetails(rawData.miscellaneousSell, 'Miscellaneous Sell Details')}
                        className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium"
                      >
                        View Details
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Payments */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-200">Payments & Adjustments</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between items-center py-2 px-3 bg-green-50 rounded">
                  <span className="text-sm text-green-600">Received:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-green-900">₹{fmt(monthData.received)}</span>
                    {rawData?.receivedDetails?.length > 0 && (
                      <button 
                        onClick={() => showDetails(rawData.receivedDetails, 'Payment Received Details')}
                        className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded font-medium"
                      >
                        View Details
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-cyan-50 rounded">
                  <span className="text-sm text-cyan-600">Credit Notes:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-cyan-900">₹{fmt(monthData.creditNotes)}</span>
                    {rawData?.creditNotes?.length > 0 && (
                      <button 
                        onClick={() => showDetails(rawData.creditNotes, 'Credit Notes Details')}
                        className="text-xs px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-medium"
                      >
                        View Details
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded">
                  <span className="text-sm text-blue-600">TDS Confirm:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-blue-900">₹{fmt(monthData.tdsConfirm)}</span>
                    {rawData?.tdsConfirm?.length > 0 && (
                      <button 
                        onClick={() => showDetails(rawData.tdsConfirm, 'TDS Confirm Details')}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                      >
                        View Details
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-orange-50 rounded">
                  <span className="text-sm text-orange-600">TDS Provision:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-orange-900">₹{fmt(monthData.tdsProvision)}</span>
                    {rawData?.tdsProvision?.length > 0 && (
                      <button 
                        onClick={() => showDetails(rawData.tdsProvision, 'TDS Provision Details')}
                        className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded font-medium"
                      >
                        View Details
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Balances */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-200">Balance Summary</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between items-center py-3 px-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                  <span className="text-sm font-bold text-yellow-700">Running Balance:</span>
                  <span className={`text-lg font-extrabold ${monthData.running>=0?'text-green-700':'text-red-700'}`}>
                    ₹{fmt(monthData.running)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-rose-50 rounded-lg border-2 border-rose-200">
                  <span className="text-sm font-bold text-rose-700">Remaining Adjustment:</span>
                  <span className={`text-lg font-extrabold ${monthData.remAdj>0?'text-red-700':'text-green-700'}`}>
                    ₹{fmt(monthData.remAdj)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Invoice Info */}
            {monthData.invoiceNumber && monthData.invoiceNumber !== '-' && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs font-bold text-blue-600 uppercase mb-1">Invoice Number</p>
                <p className="text-base font-bold text-blue-900">{monthData.invoiceNumber}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Details Popup */}
      {detailsPopup && (
        <ArrayDetailsPopup 
          data={detailsPopup.data} 
          title={detailsPopup.title} 
          onClose={() => setDetailsPopup(null)} 
        />
      )}
    </>
  )
}

// ─── Main data loader per row ─────────────────────────────────
const loadOrderBreakdown = async (order, toDateStr, splitState) => {
  const pcdDate = parseAnyDate(order.pcdDate)
  const termDate = order.terminateDate ? parseAnyDate(order.terminateDate) : null
  const toDate  = parseAnyDate(toDateStr)

  const breakdownBase = {
    months: [], totalBalance: 0,
    orderDetails: {
      orderId: order.orderId, 
      lsiId: order.lsiId, 
      state: splitState,
      splitFactor: isSplit(order) ? 2 : 1,
      pcdDate: order.pcdDate, 
      terminateDate: order.terminateDate,
      capacity: Number(order.capacity)||0, 
      baseRate: Number(order.amount)||0,
      companyName: order.companyName,
      endA: order.endA || '-',
      endB: order.endB || '-',
    }
  }

  if (!pcdDate || !toDate) {
    return breakdownBase
  }

  // Fetch billing records
  let billingData = []
  try {
    const r = await fetch(`/api/billing/monthly?orderId=${order.orderId}`)
    const j = await r.json()
    if (j.success) {
      billingData = j.data
    }
  } catch(e) {
    console.error(`[loadBreakdown] fetch exception:`, e)
  }

  // Determine service window
  let serviceEnd = toDate
  if (termDate) {
    const lastServiceDay = new Date(termDate)
    lastServiceDay.setDate(lastServiceDay.getDate() - 1)
    serviceEnd = lastServiceDay
    if (serviceEnd < pcdDate) return breakdownBase
  }

  let cur = new Date(pcdDate.getFullYear(), pcdDate.getMonth(), 1)

  while (cur <= serviceEnd && cur <= toDate) {
    const m = cur.getMonth(), y = cur.getFullYear()
    const monthName = fmtMonthYear(m, y)
    const rec = billingData.find(b => b.month === monthName && b.state === splitState)

    let totalWithGst, monthlyBilling, cgst = 0, sgst = 0, igst = 0, miscSell, received, creditNotes, tdsProvision, tdsConfirm, invoiceNumber, billingDays, startDay, endDay, isSelfGST = false
    let rawData = null

    if (rec) {
      totalWithGst  = Number(rec.totalWithGst) || 0
      monthlyBilling = Number(rec.monthlyBilling) || 0
      cgst = Number(rec.cgst) || 0
      sgst = Number(rec.sgst) || 0
      igst = Number(rec.igst) || 0
      isSelfGST = rec.isSelfGST || false
      miscSell      = sumTotalWithGst(rec.miscellaneousSell)
      received      = sumAmount(rec.receivedDetails)
      creditNotes   = sumAmount(rec.creditNotes)
      tdsProvision  = sumAmount(rec.tdsProvision)
      tdsConfirm    = sumAmount(rec.tdsConfirm)
      invoiceNumber = rec.invoiceNumber || '-'
      billingDays   = rec.billingDays || getDaysInMonth(m, y)
      startDay      = Number((rec.startDate||'').split('-')[0]) || 1
      endDay        = Number((rec.endDate||'').split('-')[0])   || getDaysInMonth(m, y)
      
      // Store raw data for popup
      rawData = {
        miscellaneousSell: rec.miscellaneousSell || [],
        receivedDetails: rec.receivedDetails || [],
        creditNotes: rec.creditNotes || [],
        tdsConfirm: rec.tdsConfirm || [],
        tdsProvision: rec.tdsProvision || []
      }
    } else {
      const daysInM = getDaysInMonth(m, y)
      const isPcd   = y === pcdDate.getFullYear() && m === pcdDate.getMonth()
      const isTerm  = termDate && y === serviceEnd.getFullYear() && m === serviceEnd.getMonth()

      let splitPct  = 1
      if (isSplit(order)) {
        splitPct = splitState === (order.billing1?.state||'')
          ? (Number(order.splitFactor?.state1Percentage)||50) / 100
          : (Number(order.splitFactor?.state2Percentage)||50) / 100
      }

      const cap  = Number(order.capacity) || 0
      const rate = Number(order.amount)   || 0
      const baseMonthly = cap * rate * splitPct
      const gstRate     = 0.18
      const grandTotal  = baseMonthly * (1 + gstRate)

      startDay = isPcd ? pcdDate.getDate() : 1
      endDay   = isTerm ? serviceEnd.getDate() : daysInM
      billingDays = endDay - startDay + 1
      totalWithGst  = (grandTotal / daysInM) * billingDays
      monthlyBilling = totalWithGst / (1 + gstRate)
      igst = totalWithGst - monthlyBilling
      miscSell = received = creditNotes = tdsProvision = tdsConfirm = 0
      invoiceNumber = '-'
      rawData = {
        miscellaneousSell: [],
        receivedDetails: [],
        creditNotes: [],
        tdsConfirm: [],
        tdsProvision: []
      }
    }

    breakdownBase.months.push({
      monthYear: monthName, month: m, year: y, billingDays, startDay, endDay,
      monthlyBilling, cgst, sgst, igst, totalWithGst, miscSell,
      received, creditNotes, tdsProvision, tdsConfirm, invoiceNumber, isSelfGST,
      rawData
    })

    if (termDate && y === serviceEnd.getFullYear() && m === serviceEnd.getMonth()) break
    cur = new Date(y, m+1, 1)
  }

  breakdownBase.totalBalance = creditPoolBalance(breakdownBase.months)
  return breakdownBase
}

// ─── Breakdown popup (full month table) ──────────────────────
const BreakdownTable = ({ bd, onClose }) => {
  const router = useRouter()
  const [viewingMonth, setViewingMonth] = useState(null)
  
  if (!bd) return null
  const od = bd.orderDetails
  const sorted = [...bd.months].sort((a,b)=>new Date(a.year,a.month)-new Date(b.year,b.month))

  // Check if we have CGST/SGST or IGST
  const hasCGST = sorted.some(m => (m.cgst ?? 0) > 0)
  const hasSGST = sorted.some(m => (m.sgst ?? 0) > 0)
  const hasIGST = sorted.some(m => (m.igst ?? 0) > 0)

  // Running balance rows
  const pool0 = sorted.reduce((s,m)=>s+m.received+m.creditNotes+m.tdsConfirm, 0)
  let pool = pool0, running = 0, cumUnpaid = 0
  const rows = sorted.map(m => {
    const charges = m.totalWithGst + m.miscSell
    const credits = m.received + m.creditNotes + m.tdsConfirm
    running += charges - credits
    let remAdj = 0
    if (pool >= charges) { pool -= charges; remAdj = cumUnpaid }
    else { cumUnpaid += charges - pool; pool = 0; remAdj = cumUnpaid }
    return { ...m, running, remAdj }
  })

  const T = rows.reduce((a,m)=>({
    mb: a.mb+m.monthlyBilling, 
    cgst: a.cgst+(m.cgst||0),
    sgst: a.sgst+(m.sgst||0),
    igst: a.igst+(m.igst||0),
    total: a.total+m.totalWithGst,
    misc: a.misc+m.miscSell, 
    recv: a.recv+m.received, 
    cn: a.cn+m.creditNotes,
    tdsp: a.tdsp+m.tdsProvision, 
    tdsc: a.tdsc+m.tdsConfirm
  }),{mb:0,cgst:0,sgst:0,igst:0,total:0,misc:0,recv:0,cn:0,tdsp:0,tdsc:0})

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/10 to-slate-50 py-6">
        <div className="max-w-[1800px] mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5"/>Monthly Billing Breakdown
                  </h2>
                  <p className="text-blue-100 text-sm mt-0.5">
                    Order: <b className="text-white">{od.orderId}</b> — State: <b className="text-white">{od.state}</b>
                  </p>
                </div>
                
                {/* Quick Info Chips */}
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <p className="text-[10px] font-bold text-blue-100 uppercase">Capacity</p>
                    <p className="text-sm font-bold text-white">{od.capacity} Mbps</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <p className="text-[10px] font-bold text-blue-100 uppercase">Base Rate</p>
                    <p className="text-sm font-bold text-white">₹{od.baseRate}</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <p className="text-[10px] font-bold text-blue-100 uppercase">Split</p>
                    <p className="text-sm font-bold text-white">{od.splitFactor === 2 ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={onClose} 
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium text-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4"/>Back
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
                    <th className="px-3 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Month</th>
                    <th className="px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Days</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Period</th>
                    <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Basic Bill</th>
                    {hasCGST && <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">CGST (9%)</th>}
                    {hasSGST && <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">SGST (9%)</th>}
                    {hasIGST && <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">IGST (18%)</th>}
                    <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Basic + GST</th>
                    <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Misc+GST Bill</th>
                    <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Received</th>
                    <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Credit Notes</th>
                    <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">TDS Conf</th>
                    <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">TDS Prov</th>
                    <th className="px-3 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider bg-yellow-50">Total Balance</th>
                    <th className="px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider bg-green-50">Remaining Adj</th>
                    <th className="px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((m,i)=>(
                    <tr key={i} className={`transition-all ${i % 2 === 0 ? 'bg-white hover:bg-blue-50/50' : 'bg-gray-50/50 hover:bg-blue-50/50'}`}>
                      <td className="px-3 py-3 font-semibold text-slate-900">{m.monthYear}</td>
                      <td className="px-3 py-3 text-center font-bold text-slate-700">{m.billingDays}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        <div>{String(m.startDay).padStart(2,'0')}-{String(m.month+1).padStart(2,'0')}-{m.year}</div>
                        <div>{String(m.endDay).padStart(2,'0')}-{String(m.month+1).padStart(2,'0')}-{m.year}</div>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-800">₹{fmt(m.monthlyBilling)}</td>
                      {hasCGST && <td className="px-3 py-3 text-right text-slate-600">₹{fmt(m.cgst||0)}</td>}
                      {hasSGST && <td className="px-3 py-3 text-right text-slate-600">₹{fmt(m.sgst||0)}</td>}
                      {hasIGST && <td className="px-3 py-3 text-right text-slate-600">₹{fmt(m.igst||0)}</td>}
                      <td className="px-3 py-3 text-right font-bold text-indigo-700">₹{fmt(m.totalWithGst)}</td>
                      <td className="px-3 py-3 text-right font-bold text-purple-600">₹{fmt(m.miscSell)}</td>
                      <td className="px-3 py-3 text-right font-bold text-green-600">₹{fmt(m.received)}</td>
                      <td className="px-3 py-3 text-right font-bold text-cyan-600">₹{fmt(m.creditNotes)}</td>
                      <td className="px-3 py-3 text-right font-bold text-blue-600">₹{fmt(m.tdsConfirm)}</td>
                      <td className="px-3 py-3 text-right font-bold text-orange-500">₹{fmt(m.tdsProvision)}</td>
                      <td className={`px-3 py-3 text-right font-extrabold bg-yellow-50 ${m.running>=0?'text-green-700':'text-red-700'}`}>
                        ₹{fmt(m.running)}
                      </td>
                      <td className={`px-3 py-3 text-center font-bold bg-green-50 ${m.remAdj>0?'text-rose-700':'text-emerald-700'}`}>
                        {m.remAdj > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <X className="w-4 h-4"/>₹{fmt(m.remAdj)}
                          </span>
                        ) : (
                          <span className="text-emerald-700">₹{fmt(0)}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center">
                          <button 
                            onClick={() => setViewingMonth(m)}
                            className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-blue-700" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gradient-to-r from-gray-100 to-blue-100 border-t-2 border-gray-300">
                  <tr className="font-bold">
                    <td colSpan="3" className="px-3 py-4 text-sm text-gray-900">TOTAL</td>
                    <td className="px-3 py-4 text-right text-sm text-slate-900">₹{fmt(T.mb)}</td>
                    {hasCGST && <td className="px-3 py-4 text-right text-sm text-gray-700">₹{fmt(T.cgst)}</td>}
                    {hasSGST && <td className="px-3 py-4 text-right text-sm text-gray-700">₹{fmt(T.sgst)}</td>}
                    {hasIGST && <td className="px-3 py-4 text-right text-sm text-gray-700">₹{fmt(T.igst)}</td>}
                    <td className="px-3 py-4 text-right text-sm text-indigo-700">₹{fmt(T.total)}</td>
                    <td className="px-3 py-4 text-right text-sm text-purple-700">₹{fmt(T.misc)}</td>
                    <td className="px-3 py-4 text-right text-sm text-green-700">₹{fmt(T.recv)}</td>
                    <td className="px-3 py-4 text-right text-sm text-cyan-700">₹{fmt(T.cn)}</td>
                    <td className="px-3 py-4 text-right text-sm text-blue-700">₹{fmt(T.tdsc)}</td>
                    <td className="px-3 py-4 text-right text-sm text-orange-600">₹{fmt(T.tdsp)}</td>
                    <td className={`px-3 py-4 text-right text-lg font-extrabold bg-yellow-100 ${rows[rows.length-1]?.running>=0?'text-green-700':'text-red-700'}`}>
                      ₹{fmt(rows[rows.length-1]?.running||0)}
                    </td>
                    <td className="px-3 py-4 bg-green-100" colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {/* Month Detail Popup */}
      {viewingMonth && <MonthDetailView monthData={viewingMonth} rawData={viewingMonth.rawData} onClose={() => setViewingMonth(null)} />}
    </>
  )
}

// ─── Simplified table row ─────────────────────────────────────
const OrderRow = React.memo(({ order, toDateStr, splitState, onViewBreakdown, onBalanceReady, rowKey, hideLsi }) => {
  const router = useRouter()
  const [bd, setBd] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const result = await loadOrderBreakdown(order, toDateStr, splitState)
      if (cancelled) return
      setBd(result)
      setLoading(false)
      onBalanceReady?.(rowKey, result.totalBalance)
    })()
    return () => { cancelled = true }
  }, [order._id, toDateStr, splitState, rowKey, onBalanceReady])

  if (loading) return (
    <tr className="border-b border-slate-100">
      <td colSpan={hideLsi ? 8 : 9} className="px-4 py-3 text-center text-slate-400 text-sm">
        <div className="flex items-center justify-center gap-2">
          <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-blue-500"/>
          <span>Loading {order.orderId}…</span>
        </div>
      </td>
    </tr>
  )

  if (!bd) return null

  const bal = bd.totalBalance
  const splitPct = isSplit(order) 
    ? (splitState === (order.billing1?.state||'') 
        ? Number(order.splitFactor?.state1Percentage)||50 
        : Number(order.splitFactor?.state2Percentage)||50)
    : 100

  return (
    <tr className="hover:bg-blue-50/30 transition-colors border-b border-slate-100">
      <td className="px-4 py-3">
        <span className="text-sm font-bold text-blue-600">{order.orderId}</span>
      </td>
      {!hideLsi && (
        <td className="px-4 py-3">
          <TruncatedText text={order.lsiId} limit={18} className="text-sm text-orange-600 font-semibold" />
        </td>
      )}
      <td className="px-4 py-3">
        <TruncatedText text={order.endA} limit={18} className="text-sm text-slate-700" />
      </td>
      <td className="px-4 py-3">
        <TruncatedText text={order.endB} limit={18} className="text-sm text-slate-700" />
      </td>
      <td className="px-4 py-3 max-w-[200px]">
        <TruncatedText text={order.companyName} limit={18} className="text-sm font-semibold text-slate-800" />
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded">
          {splitState || order.billing1?.state || '-'}
        </span>
      </td>
      <td className="px-4 py-3 text-right bg-yellow-50/60">
        <div className="flex items-center justify-end gap-2">
          <span className={`text-base font-extrabold ${bal>=0?'text-emerald-600':'text-rose-600'}`}>
            ₹{fmt(bal)}
          </span>
          <button 
            onClick={()=>onViewBreakdown(bd)} 
            title="View breakdown"
            className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Info className="w-4 h-4 text-blue-500"/>
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex px-3 py-1 bg-purple-50 text-purple-700 text-sm font-bold rounded">
          {splitPct}%
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <button 
          onClick={()=>router.push(`/billing/generator?orderId=${order.orderId}`)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
        >
          <FileSpreadsheet className="w-4 h-4"/>Generate
        </button>
      </td>
    </tr>
  )
})
OrderRow.displayName = 'OrderRow'

// ─── Main component ────────────────────────────────────────────
export default function OutstandingReportComp() {
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [viewBreakdown, setViewBD] = useState(null)
  const [rowBalances, setRowBalances] = useState({})
  const [hideLsi, setHideLsi] = useState(true)

  const defaultRange = getDefaultDateRange()
  const todayDMY = todayDDMMYYYY()
  const curYear = getCurrentYear()
  const curMonthIdx = getCurrentMonth()

  const [activeTab, setActiveTab] = useState('period')
  const [statusFilter, setStatusFilter] = useState('active')
  const [filters, setFilters] = useState({ 
    search:'', state:'', company:'', entity:'', 
    from: defaultRange.from, to: defaultRange.to 
  })
  const [selYear, setSelYear] = useState(curYear)
  const [selMonth, setSelMonth] = useState('All')

  // Load orders
  useEffect(() => {
    fetch('/api/billing/orders')
      .then(r=>r.json())
      .then(j => {
        if (j.success) {
          setOrders(j.data)
        }
      })
      .catch(e => console.error('[OutstandingReport] fetch error:', e))
  }, [])

  const handleBalanceReady = useCallback((key, bal) => {
    setRowBalances(prev => ({...prev, [key]: bal}))
  }, [])

  // Reset balances when filters change
  const filterKey = useMemo(()=>JSON.stringify({filters,statusFilter,activeTab,selYear,selMonth}),
    [filters,statusFilter,activeTab,selYear,selMonth])
  useEffect(()=>{ setRowBalances({}) },[filterKey])

  // Sync toDate from period selector
  useEffect(() => {
    if (activeTab !== 'period') return
    if (selYear === 'All') {
      setFilters(p=>({...p, from:'', to: toInputFmt(todayDMY)}))
    } else {
      const y = selYear
      const mIdx = selMonth === 'All' ? (y === curYear ? curMonthIdx : 11) : ALL_MONTHS.indexOf(selMonth)
      setFilters(p=>({...p, from:'', to: toInputFmt(getLastDayOfMonth(mIdx, y))}))
    }
  }, [selMonth, selYear, activeTab, todayDMY, curYear, curMonthIdx])

  const yearOptions = useMemo(()=>getYearOptions(),[])
  const availMonths = useMemo(()=>selYear==='All'?[]:getAvailMonths(parseInt(selYear)),[selYear])
  const uniqueCompanies = useMemo(()=>[...new Set(orders.map(o=>o.companyName))].filter(Boolean),[orders])

  const handleYearChange = (y) => {
    if (y==='All') { setSelYear(y); setSelMonth('All') }
    else { const yn=parseInt(y); setSelYear(yn); setSelMonth(yn===curYear?ALL_MONTHS[curMonthIdx]:'All') }
  }

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (!order.orderId?.toLowerCase().includes(s) && !order.lsiId?.toLowerCase().includes(s)) return false
      }
      if (filters.company && !order.companyName?.toLowerCase().includes(filters.company.toLowerCase())) return false
      if (filters.entity && order.entity !== filters.entity) return false
      if (filters.state && order.billing1?.state !== filters.state && order.billing2?.state !== filters.state) return false

      const matchStatus = statusFilter === 'active' ? order.status === 'PCD' : order.status === 'Terminate'
      if (!matchStatus) return false

      const pcdDate = parseAnyDate(order.pcdDate)
      const termDate = order.terminateDate ? parseAnyDate(order.terminateDate) : null

      if (!pcdDate) return false

      let matchDate = true
      if (activeTab === 'period' && selYear !== 'All') {
        const yn = parseInt(selYear)
        const mIdx = selMonth === 'All' ? (yn===curYear?curMonthIdx:11) : ALL_MONTHS.indexOf(selMonth)
        const endOfPeriod = new Date(yn, mIdx+1, 0, 23, 59, 59)
        matchDate = pcdDate <= endOfPeriod
      } else if (activeTab === 'dateRange' && filters.from && filters.to) {
        const from = new Date(filters.from); from.setHours(0,0,0,0)
        const to = new Date(filters.to); to.setHours(23,59,59,999)
        matchDate = pcdDate <= to && (!termDate || termDate >= from)
      }

      return matchDate
    })
  }, [orders, filters, statusFilter, activeTab, selYear, selMonth, curYear, curMonthIdx])

  const expectedRows = useMemo(()=>filteredOrders.reduce((c,o)=>c+(isSplit(o)?2:1),0),[filteredOrders])
  const totalBalance = useMemo(()=>Object.values(rowBalances).reduce((s,b)=>s+b,0),[rowBalances])
  const isCalc = useMemo(()=>expectedRows>0&&Object.keys(rowBalances).length<expectedRows,[rowBalances,expectedRows])

  const toDateStr = useMemo(()=>toStorageFmt(filters.to)||todayDMY,[filters.to,todayDMY])

  const clearFilters = useCallback(()=>{
    const dr = getDefaultDateRange()
    setFilters({search:'',state:'',company:'',entity:'',from:dr.from,to:dr.to})
    setActiveTab('period'); setSelYear(curYear); setSelMonth(ALL_MONTHS[curMonthIdx]); setStatusFilter('active')
  },[curYear,curMonthIdx])

  const hasFilters = filters.search||filters.state||filters.company||filters.entity
  const periodLabel = selYear==='All' ? 'All Time' : selMonth==='All' ? `Up to Dec ${selYear}` : `Up to ${selMonth} ${selYear}`

  if (viewBreakdown) return <BreakdownTable bd={viewBreakdown} onClose={()=>setViewBD(null)}/>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/10 to-slate-50">
      <div className="max-w-[1900px] mx-auto p-4 lg:p-6">

        {/* Controls */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mb-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-slate-900">Outstanding Balance Report</h1>
            <p className="text-sm text-slate-500 mt-0.5">Cumulative balances per order up to selected period</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"/>
              <input 
                type="text" 
                placeholder="Search Order / LSI…" 
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.search} 
                onChange={e=>setFilters(p=>({...p,search:e.target.value}))}
              />
            </div>
            <select 
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 min-w-[120px]" 
              value={filters.state} 
              onChange={e=>setFilters(p=>({...p,state:e.target.value}))}
            >
              <option value="">All States</option>
              {INDIAN_STATES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select 
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 min-w-[140px]" 
              value={filters.company} 
              onChange={e=>setFilters(p=>({...p,company:e.target.value}))}
            >
              <option value="">All Companies</option>
              {uniqueCompanies.map(c=><option key={c} value={c}>{c.slice(0,25)}</option>)}
            </select>
            <select 
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 min-w-[110px]" 
              value={filters.entity} 
              onChange={e=>setFilters(p=>({...p,entity:e.target.value}))}
            >
              <option value="">All Entities</option>
              {ENTITIES.map(e=><option key={e} value={e}>{e}</option>)}
            </select>
            <select 
              className="px-3 py-2 border border-emerald-300 rounded-lg text-sm bg-emerald-50 text-emerald-700 font-semibold focus:ring-2 focus:ring-emerald-400 min-w-[140px]" 
              value={statusFilter} 
              onChange={e=>setStatusFilter(e.target.value)}
            >
              <option value="active">Active (PCD)</option>
              <option value="inactive">Inactive (Terminate)</option>
            </select>
            {hasFilters && (
              <button 
                onClick={clearFilters} 
                className="flex items-center gap-1 px-3 py-2 bg-rose-50 text-rose-600 text-sm rounded-lg border border-rose-200 hover:bg-rose-100"
              >
                <X className="w-3.5 h-3.5"/>Clear
              </button>
            )}
            <div className="flex-1"/>
            
            {/* Stats */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Orders</p>
              <p className="text-2xl font-extrabold text-slate-900">{filteredOrders.length}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-center min-w-[160px]">
              <p className="text-[10px] font-bold text-emerald-500 uppercase">Total Balance</p>
              {isCalc ? (
                <div className="flex items-center justify-center gap-2 mt-1">
                  <div className="animate-spin h-5 w-5 rounded-full border-b-2 border-emerald-600"/>
                  <span className="text-sm font-semibold text-emerald-600">Calculating…</span>
                </div>
              ) : (
                <p className="text-xl font-extrabold text-emerald-700">₹{fmt(totalBalance)}</p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 mb-4">
            <div className="flex">
              {[['period','Period Selector'],['dateRange','Date Range']].map(([t,l])=>(
                <button 
                  key={t} 
                  onClick={()=>{setActiveTab(t); const dr=getDefaultDateRange(); setFilters(p=>({...p,from:dr.from,to:dr.to}))}}
                  className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab===t?'text-teal-600 border-teal-600':'text-slate-500 border-transparent hover:text-slate-700'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-0.5">
              <button 
                onClick={()=>setHideLsi(!hideLsi)} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200"
              >
                {hideLsi?<Eye className="w-4 h-4"/>:<EyeOff className="w-4 h-4"/>} {hideLsi?'Show':'Hide'} LSI
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                <Download className="w-4 h-4"/>Export
              </button>
            </div>
          </div>

          {/* Period selector */}
          {activeTab === 'period' && (
            <div className="flex flex-wrap items-center gap-4 px-1">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Year</label>
                <select 
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  value={selYear} 
                  onChange={e=>handleYearChange(e.target.value)}
                >
                  {yearOptions.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {selYear !== 'All' && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1 min-w-[360px]">
                  <label className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Month</label>
                  <div className="flex gap-1.5 flex-wrap">
                    <button 
                      onClick={()=>setSelMonth('All')} 
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selMonth==='All'?'bg-teal-500 text-white':'bg-white text-slate-700 border border-slate-200 hover:border-teal-300'}`}
                    >
                      All
                    </button>
                    {ALL_MONTHS.map(m=>{
                      const ok=availMonths.includes(m)
                      return (
                        <button 
                          key={m} 
                          onClick={()=>ok&&setSelMonth(m)} 
                          disabled={!ok}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${selMonth===m?'bg-teal-500 text-white':ok?'bg-white text-slate-700 border border-slate-200 hover:border-teal-300':'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'}`}
                        >
                          {m}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="bg-teal-50 border-2 border-teal-200 rounded-lg px-3 py-1.5">
                <span className="text-sm font-bold text-teal-700">Showing: {periodLabel}</span>
              </div>
            </div>
          )}

          {/* Date range */}
          {activeTab === 'dateRange' && (
            <div className="flex flex-wrap gap-4 px-1">
              {[['From','from'],['To','to']].map(([l,k])=>(
                <div key={k} className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-600">{l}:</label>
                  <input 
                    type="date" 
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filters[k]} 
                    max={toInputFmt(todayDMY)}
                    onChange={e=>setFilters(p=>({...p,[k]:e.target.value}))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Simplified Table */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Order ID</th>
                  {!hideLsi && <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">LSI ID</th>}
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">End A</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">End B</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">State</th>
                  <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider bg-yellow-50">Balance</th>
                  <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Split</th>
                  <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredOrders.map((order, idx) => {
                  const split = isSplit(order)
                  if (split) {
                    const s1 = order.billing1?.state||''
                    const s2 = order.billing2?.state||''
                    return (
                      <React.Fragment key={`${order._id}-${idx}`}>
                        <OrderRow 
                          rowKey={`${order._id}-${s1}-${idx}`} 
                          order={order} 
                          toDateStr={toDateStr} 
                          splitState={s1} 
                          onViewBreakdown={setViewBD} 
                          onBalanceReady={handleBalanceReady}
                          hideLsi={hideLsi}
                        />
                        <OrderRow 
                          rowKey={`${order._id}-${s2}-${idx}`} 
                          order={order} 
                          toDateStr={toDateStr} 
                          splitState={s2} 
                          onViewBreakdown={setViewBD} 
                          onBalanceReady={handleBalanceReady}
                          hideLsi={hideLsi}
                        />
                      </React.Fragment>
                    )
                  }
                  return (
                    <OrderRow 
                      key={`${order._id}-${idx}`} 
                      rowKey={`${order._id}-main-${idx}`} 
                      order={order} 
                      toDateStr={toDateStr} 
                      splitState={order.billing1?.state||''} 
                      onViewBreakdown={setViewBD} 
                      onBalanceReady={handleBalanceReady}
                      hideLsi={hideLsi}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-16">
              <p className="text-slate-500 text-base font-medium">No orders found</p>
              <p className="text-slate-400 text-sm mt-1">Check status filter (Active/Inactive) or date range</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
