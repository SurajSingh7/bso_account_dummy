'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Download, X, Eye, EyeOff, Info, ArrowLeft, FileText, Receipt } from 'lucide-react'

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
const todayDDMMYYYY = () => {
  const n = new Date()
  return `${String(n.getDate()).padStart(2,'0')}-${String(n.getMonth()+1).padStart(2,'0')}-${n.getFullYear()}`
}
const toInputFmt   = (s) => { if (!s) return ''; const [d,m,y] = s.split('-'); return `${y}-${m}-${d}` }
const fmtMonthYear = (m, y) => `${MONTH_NAMES[m]} ${y}`

const getDefaultDateRange = () => {
  const y = getCurrentYear(), m = getCurrentMonth()+1, d = new Date().getDate()
  return { from: `${y}-01-01`, to: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` }
}
const getYearOptions  = () => ["All", ...Array.from({length:6}, (_,i) => getCurrentYear()-i)]
const getAvailMonths  = (y) => y === getCurrentYear() ? ALL_MONTHS.slice(0, getCurrentMonth()+1) : ALL_MONTHS

// ─── Amount helpers ───────────────────────────────────────────
const sumField  = (arr, field) => (!arr?.length) ? 0 : arr.reduce((s,i) => s+(Number(i[field])||0), 0)
const sumAmount = (arr) => sumField(arr, 'amount')
// Credit notes: use totalWithGst (includes GST), fallback to amount
const sumCreditNotes = (arr) => (!arr?.length) ? 0 : arr.reduce((s,i) => s+(Number(i.totalWithGst)||Number(i.amount)||0), 0)
const fmt = (n) => (n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})

// ─── Split billing detection ──────────────────────────────────
const isSplit = (order) => {
  const s1 = order.billing1?.state||'', s2 = order.billing2?.state||''
  return order.product === 'NLD' && s1 !== s2 && s2 !== ''
}

// ─── Text truncation with popup ───────────────────────────────
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
        <button onClick={()=>setShowPopup(true)} className="text-blue-600 hover:text-blue-700 hover:underline ml-1 font-medium">..more</button>
      </span>
      {showPopup && <TextPopup text={text} onClose={()=>setShowPopup(false)}/>}
    </>
  )
})
TruncatedText.displayName = 'TruncatedText'

// ─── Array Details Popup ──────────────────────────────────────
const ArrayDetailsPopup = React.memo(({ data, title, onClose, isCreditNote = false }) => {
  useEffect(()=>{
    const h=e=>{if(e.key==='Escape')onClose()}
    document.addEventListener('keydown',h)
    return ()=>document.removeEventListener('keydown',h)
  },[onClose])

  if (!data || data.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[10002] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={e=>e.stopPropagation()}>
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5 text-white"/></button>
          </div>
          <div className="p-8 text-center"><p className="text-slate-500">No data available</p></div>
        </div>
      </div>
    )
  }

  const total = isCreditNote
    ? data.reduce((s,i)=>s+(Number(i.totalWithGst)||Number(i.amount)||0),0)
    : data.reduce((s,i)=>s+(Number(i.amount)||0),0)

  return (
    <div className="fixed inset-0 bg-black/60 z-[10002] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={e=>e.stopPropagation()}>
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10 rounded-t-xl">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5 text-white"/></button>
        </div>
        <div className="p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Date</th>
                {isCreditNote && (
                  <>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">Base Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">GST</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-cyan-700 uppercase">Total (with GST)</th>
                  </>
                )}
                {!isCreditNote && <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">Amount</th>}
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Notes</th>
                {isCreditNote && <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Invoice</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((item,idx)=>{
                const baseAmt  = Number(item.amount)||0
                const gstAmt   = Number(item.cgst||0)+Number(item.sgst||0)+Number(item.igst||0)
                const totalAmt = Number(item.totalWithGst)||baseAmt
                return (
                  <tr key={idx} className={idx%2===0?'bg-white':'bg-slate-50'}>
                    <td className="px-4 py-3 text-sm text-slate-800 font-semibold">{item.date||'-'}</td>
                    {isCreditNote && (
                      <>
                        <td className="px-4 py-3 text-sm text-slate-700 text-right">₹{fmt(baseAmt)}</td>
                        <td className="px-4 py-3 text-sm text-slate-500 text-right">₹{fmt(gstAmt)}</td>
                        <td className="px-4 py-3 text-sm text-cyan-800 font-bold text-right">₹{fmt(totalAmt)}</td>
                      </>
                    )}
                    {!isCreditNote && (
                      <td className="px-4 py-3 text-sm text-slate-900 font-bold text-right">₹{fmt(baseAmt)}</td>
                    )}
                    <td className="px-4 py-3 text-sm text-slate-600">{item.notes||'-'}</td>
                    {isCreditNote && <td className="px-4 py-3 text-sm text-slate-500">{item.invoiceNumber||'-'}</td>}
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-slate-300">
              <tr className="font-bold">
                <td className="px-4 py-3 text-sm text-slate-900">TOTAL</td>
                {isCreditNote && <td colSpan={2} className="px-4 py-3"/>}
                <td className="px-4 py-3 text-sm text-slate-900 text-right">₹{fmt(total)}</td>
                <td className="px-4 py-3"/>
                {isCreditNote && <td className="px-4 py-3"/>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
})
ArrayDetailsPopup.displayName = 'ArrayDetailsPopup'

// ─── Month Detail View Popup (Receipt focused) ────────────────
const ReceiptMonthDetailView = ({ monthData, rawData, onClose }) => {
  const [detailsPopup, setDetailsPopup] = useState(null)
  if (!monthData) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[10001] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}>
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
            <div>
              <h3 className="text-xl font-bold text-white">Receipt Details</h3>
              <p className="text-emerald-100 text-sm mt-0.5">{monthData.monthYear}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5 text-white"/></button>
          </div>

          <div className="p-6 space-y-5">
            {/* Summary Chips */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <p className="text-xs font-bold text-emerald-500 uppercase mb-1">Total Receipts (Month)</p>
                <p className="text-2xl font-bold text-emerald-900">₹{fmt(monthData.totalReceipts)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Billing Month</p>
                <p className="text-xl font-bold text-slate-900">{monthData.monthYear}</p>
              </div>
            </div>

            {/* Receipt Breakdown */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-200">Receipt Breakdown</h4>
              <div className="space-y-2">

                {/* Received */}
                <div className="flex justify-between items-center py-2 px-3 bg-green-50 rounded border border-green-100">
                  <span className="text-sm text-green-700 font-semibold">Received</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-green-900">₹{fmt(monthData.received)}</span>
                    {rawData?.receivedDetails?.length > 0 && (
                      <button onClick={()=>setDetailsPopup({data:rawData.receivedDetails,title:'Payment Received Details',isCreditNote:false})}
                        className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded font-medium">
                        View Details
                      </button>
                    )}
                  </div>
                </div>

                {/* Credit Notes — shows totalWithGst */}
                <div className="flex justify-between items-center py-2 px-3 bg-cyan-50 rounded border border-cyan-100">
                  <div>
                    <span className="text-sm text-cyan-700 font-semibold">Credit Notes</span>
                    <span className="ml-2 text-[10px] font-bold text-cyan-500 uppercase bg-cyan-100 px-1.5 py-0.5 rounded">incl. GST</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-cyan-900">₹{fmt(monthData.creditNotes)}</span>
                    {rawData?.creditNotes?.length > 0 && (
                      <button onClick={()=>setDetailsPopup({data:rawData.creditNotes,title:'Credit Notes Details (incl. GST)',isCreditNote:true})}
                        className="text-xs px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-medium">
                        View Details
                      </button>
                    )}
                  </div>
                </div>

                {/* TDS Confirm */}
                <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded border border-blue-100">
                  <span className="text-sm text-blue-700 font-semibold">TDS Confirmed</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-blue-900">₹{fmt(monthData.tdsConfirm)}</span>
                    {rawData?.tdsConfirm?.length > 0 && (
                      <button onClick={()=>setDetailsPopup({data:rawData.tdsConfirm,title:'TDS Confirm Details',isCreditNote:false})}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium">
                        View Details
                      </button>
                    )}
                  </div>
                </div>

                {/* TDS Provision */}
                <div className="flex justify-between items-center py-2 px-3 bg-orange-50 rounded border border-orange-100">
                  <span className="text-sm text-orange-700 font-semibold">TDS Provision</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-orange-900">₹{fmt(monthData.tdsProvision)}</span>
                    {rawData?.tdsProvision?.length > 0 && (
                      <button onClick={()=>setDetailsPopup({data:rawData.tdsProvision,title:'TDS Provision Details',isCreditNote:false})}
                        className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded font-medium">
                        View Details
                      </button>
                    )}
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center py-3 px-3 bg-emerald-100 rounded border-2 border-emerald-300 mt-2">
                  <span className="text-sm font-extrabold text-emerald-800">Grand Total Receipts</span>
                  <span className="text-lg font-extrabold text-emerald-900">₹{fmt(monthData.totalReceipts)}</span>
                </div>
              </div>
            </div>

            {/* Invoice */}
            {monthData.invoiceNumber && monthData.invoiceNumber !== '-' && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs font-bold text-blue-600 uppercase mb-1">Invoice Number</p>
                <p className="text-base font-bold text-blue-900">{monthData.invoiceNumber}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {detailsPopup && (
        <ArrayDetailsPopup
          data={detailsPopup.data}
          title={detailsPopup.title}
          isCreditNote={detailsPopup.isCreditNote}
          onClose={()=>setDetailsPopup(null)}
        />
      )}
    </>
  )
}

// ─── Data loader ──────────────────────────────────────────────
const loadOrderReceipts = async (order, filterMonths, splitState) => {
  const pcdDate  = parseAnyDate(order.pcdDate)
  const termDate = order.terminateDate ? parseAnyDate(order.terminateDate) : null

  const base = {
    months: [],
    totalReceived:    0,
    totalCreditNotes: 0,
    totalTdsConfirm:  0,
    totalTdsProvision:0,
    totalReceipts:    0,
    orderDetails: {
      orderId:    order.orderId,
      lsiId:      order.lsiId,
      state:      splitState,
      splitFactor: isSplit(order) ? 2 : 1,
      pcdDate:    order.pcdDate,
      terminateDate: order.terminateDate,
      capacity:   Number(order.capacity)||0,
      baseRate:   Number(order.amount)||0,
      companyName: order.companyName,
      endA: order.endA || '-',
      endB: order.endB || '-',
    }
  }

  if (!pcdDate) return base

  // Fetch billing records
  let billingData = []
  try {
    const r = await fetch(`/api/billing/monthly?orderId=${order.orderId}`)
    const j = await r.json()
    if (j.success) billingData = j.data
  } catch(e) {
    console.error(`[loadReceipts] fetch exception:`, e)
  }

  // Service window
  let serviceEnd = new Date()
  if (termDate) {
    const lastServiceDay = new Date(termDate)
    lastServiceDay.setDate(lastServiceDay.getDate() - 1)
    serviceEnd = lastServiceDay
    if (serviceEnd < pcdDate) return base
  }

  let cur = new Date(pcdDate.getFullYear(), pcdDate.getMonth(), 1)

  while (cur <= serviceEnd) {
    const m = cur.getMonth(), y = cur.getFullYear()
    const monthName = fmtMonthYear(m, y)

    const shouldInclude = filterMonths.some(fm => fm.month === m && fm.year === y)

    if (shouldInclude) {
      const rec = billingData.find(b => b.month === monthName && b.state === splitState)

      let received = 0, creditNotes = 0, tdsConfirm = 0, tdsProvision = 0, invoiceNumber = '-'
      let rawData = { receivedDetails:[], creditNotes:[], tdsConfirm:[], tdsProvision:[] }

      if (rec) {
        received     = sumAmount(rec.receivedDetails)
        // ✅ FIX: Credit notes use totalWithGst (includes GST amount)
        creditNotes  = sumCreditNotes(rec.creditNotes)
        tdsConfirm   = sumAmount(rec.tdsConfirm)
        tdsProvision = sumAmount(rec.tdsProvision)
        invoiceNumber = rec.invoiceNumber || '-'
        rawData = {
          receivedDetails: rec.receivedDetails  || [],
          // ✅ Pass raw credit notes as-is so popup can show base + GST + total
          creditNotes:     rec.creditNotes      || [],
          tdsConfirm:      rec.tdsConfirm       || [],
          tdsProvision:    rec.tdsProvision     || [],
        }
      }

      const totalReceipts = received + creditNotes + tdsConfirm

      base.months.push({
        monthYear: monthName, month: m, year: y,
        received, creditNotes, tdsConfirm, tdsProvision,
        totalReceipts, invoiceNumber, rawData
      })
    }

    if (termDate && y === serviceEnd.getFullYear() && m === serviceEnd.getMonth()) break
    cur = new Date(y, m+1, 1)
  }

  base.totalReceived     = base.months.reduce((s,m)=>s+m.received,    0)
  base.totalCreditNotes  = base.months.reduce((s,m)=>s+m.creditNotes,  0)
  base.totalTdsConfirm   = base.months.reduce((s,m)=>s+m.tdsConfirm,   0)
  base.totalTdsProvision = base.months.reduce((s,m)=>s+m.tdsProvision, 0)
  base.totalReceipts     = base.totalReceived + base.totalCreditNotes + base.totalTdsConfirm

  return base
}

// ─── Breakdown Table (month-by-month receipts) ───────────────
const ReceiptBreakdownTable = ({ bd, onClose }) => {
  const [viewingMonth, setViewingMonth] = useState(null)

  if (!bd) return null
  const od = bd.orderDetails
  const sorted = [...bd.months].sort((a,b)=>new Date(a.year,a.month)-new Date(b.year,b.month))

  const T = sorted.reduce((a,m)=>({
    recv: a.recv + m.received,
    cn:   a.cn   + m.creditNotes,
    tdsc: a.tdsc + m.tdsConfirm,
    tdsp: a.tdsp + m.tdsProvision,
    total:a.total+ m.totalReceipts,
  }),{recv:0,cn:0,tdsc:0,tdsp:0,total:0})

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/10 to-slate-50 py-6">
        <div className="max-w-[1800px] mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">

            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 flex items-center gap-4">
              <button onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium text-sm transition-all shrink-0">
                <ArrowLeft className="w-4 h-4"/>Back
              </button>
              <div className="flex items-center gap-6 flex-1">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Receipt className="w-5 h-5"/>Monthly Receipt Breakdown
                  </h2>
                  <p className="text-emerald-100 text-sm mt-0.5">
                    Order: <b className="text-white">{od.orderId}</b> — State: <b className="text-white">{od.state}</b>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <p className="text-[10px] font-bold text-emerald-100 uppercase">Company</p>
                    <p className="text-sm font-bold text-white">{od.companyName?.slice(0,20) || '-'}</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <p className="text-[10px] font-bold text-emerald-100 uppercase">Split</p>
                    <p className="text-sm font-bold text-white">{od.splitFactor===2?'Yes':'No'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Bar */}
            <div className="grid grid-cols-4 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50">
              {[
                { label:'Total Received',           value:T.recv,  color:'text-green-700',  bg:'bg-green-50' },
                { label:'Total Credit Notes+GST',value:T.cn,    color:'text-cyan-700',   bg:'bg-cyan-50'  },
                { label:'Total TDS Confirm',         value:T.tdsc,  color:'text-blue-700',   bg:'bg-blue-50'  },
                { label:'Total TDS Provision',       value:T.tdsp,  color:'text-orange-600', bg:'bg-orange-50'},
              ].map(({label,value,color,bg})=>(
                <div key={label} className={`px-5 py-3 ${bg}`}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{label}</p>
                  <p className={`text-lg font-extrabold ${color}`}>₹{fmt(value)}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-emerald-50 border-b-2 border-gray-200">
                    <th className="px-3 py-4 text-left   text-xs font-bold text-gray-700 uppercase tracking-wider">Month</th>
                    <th className="px-3 py-4 text-right  text-xs font-bold text-gray-700 uppercase tracking-wider">Received</th>
                    <th className="px-3 py-4 text-right  text-xs font-bold text-gray-700  uppercase tracking-wider">Credit Notes+Gst<br/></th>
                    <th className="px-3 py-4 text-right  text-xs font-bold text-gray-700 uppercase tracking-wider">TDS Confirm</th>
                    <th className="px-3 py-4 text-right  text-xs font-bold text-gray-700 uppercase tracking-wider">TDS Provision</th>
                    <th className="px-3 py-4 text-right  text-xs font-bold text-gray-700 uppercase tracking-wider bg-emerald-50">Total Receipts</th>
                    <th className="px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Invoice</th>
                    <th className="px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map((m,i)=>(
                    <tr key={i} className={`transition-all ${i%2===0?'bg-white hover:bg-emerald-50/40':'bg-gray-50/50 hover:bg-emerald-50/40'}`}>
                      <td className="px-3 py-3 font-semibold text-slate-900">{m.monthYear}</td>
                      <td className="px-3 py-3 text-right font-bold text-green-700">₹{fmt(m.received)}</td>
                      <td className="px-3 py-3 text-right font-bold text-cyan-700">₹{fmt(m.creditNotes)}</td>
                      <td className="px-3 py-3 text-right font-bold text-blue-700">₹{fmt(m.tdsConfirm)}</td>
                      <td className="px-3 py-3 text-right font-bold text-orange-600">₹{fmt(m.tdsProvision)}</td>
                      <td className="px-3 py-3 text-right font-extrabold text-emerald-700 bg-emerald-50">₹{fmt(m.totalReceipts)}</td>
                      <td className="px-3 py-3 text-center text-xs text-slate-500">{m.invoiceNumber}</td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={()=>setViewingMonth(m)}
                          className="p-2 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors" title="View Details">
                          <Eye className="w-4 h-4 text-emerald-700"/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gradient-to-r from-gray-100 to-emerald-100 border-t-2 border-gray-300">
                  <tr className="font-bold">
                    <td className="px-3 py-4 text-sm text-gray-900">TOTAL</td>
                    <td className="px-3 py-4 text-right text-sm text-green-700">₹{fmt(T.recv)}</td>
                    <td className="px-3 py-4 text-right text-sm text-cyan-700">₹{fmt(T.cn)}</td>
                    <td className="px-3 py-4 text-right text-sm text-blue-700">₹{fmt(T.tdsc)}</td>
                    <td className="px-3 py-4 text-right text-sm text-orange-600">₹{fmt(T.tdsp)}</td>
                    <td className="px-3 py-4 text-right text-lg font-extrabold text-emerald-700 bg-emerald-100">₹{fmt(T.total)}</td>
                    <td colSpan="2" className="px-3 py-4"/>
                  </tr>
                </tfoot>
              </table>
            </div>

          </div>
        </div>
      </div>
      {viewingMonth && (
        <ReceiptMonthDetailView monthData={viewingMonth} rawData={viewingMonth.rawData} onClose={()=>setViewingMonth(null)}/>
      )}
    </>
  )
}

// ─── Order Row ────────────────────────────────────────────────
const OrderReceiptRow = React.memo(({ order, filterMonths, splitState, onViewBreakdown, onDataReady, rowKey, hideLsi }) => {
  const [bd, setBd]           = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    let cancelled = false
    ;(async()=>{
      setLoading(true)
      const result = await loadOrderReceipts(order, filterMonths, splitState)
      if (cancelled) return
      setBd(result)
      setLoading(false)
      onDataReady?.(rowKey, {
        received:    result.totalReceived,
        creditNotes: result.totalCreditNotes,
        tdsConfirm:  result.totalTdsConfirm,
        tdsProvision:result.totalTdsProvision,
        total:       result.totalReceipts,
      })
    })()
    return ()=>{ cancelled=true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[order._id, JSON.stringify(filterMonths), splitState, rowKey])

  if (loading) return (
    <tr className="border-b border-slate-100">
      <td colSpan={hideLsi?9:10} className="px-4 py-3 text-center text-slate-400 text-sm">
        <div className="flex items-center justify-center gap-2">
          <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-emerald-500"/>
          <span>Loading {order.orderId}…</span>
        </div>
      </td>
    </tr>
  )
  if (!bd) return null

  const splitPct = isSplit(order)
    ? (splitState===(order.billing1?.state||'')
        ? Number(order.splitFactor?.state1Percentage)||50
        : Number(order.splitFactor?.state2Percentage)||50)
    : 100

  const servicePeriod = bd.months.length > 0
    ? bd.months.length === 1
      ? bd.months[0].monthYear
      : `${bd.months[0].monthYear} – ${bd.months[bd.months.length-1].monthYear}`
    : '-'

  return (
    <tr className="hover:bg-emerald-50/30 transition-colors border-b border-slate-100">
      <td className="px-4 py-3">
        <span className="text-sm font-bold text-blue-600">{order.orderId}</span>
      </td>
      {!hideLsi && (
        <td className="px-4 py-3">
          <TruncatedText text={order.lsiId} limit={18} className="text-sm text-orange-600 font-semibold"/>
        </td>
      )}
      <td className="px-4 py-3">
        <TruncatedText text={order.endA} limit={18} className="text-sm text-slate-700"/>
      </td>
      <td className="px-4 py-3">
        <TruncatedText text={order.endB} limit={18} className="text-sm text-slate-700"/>
      </td>
      <td className="px-4 py-3 max-w-[200px]">
        <TruncatedText text={order.companyName} limit={18} className="text-sm font-semibold text-slate-800"/>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded">
          {splitState||order.billing1?.state||'-'}
        </span>
      </td>
      {/* Received */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-extrabold text-green-700">₹{fmt(bd.totalReceived)}</span>
      </td>
      {/* Credit Notes (incl. GST) */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-extrabold text-cyan-700">₹{fmt(bd.totalCreditNotes)}</span>
      </td>
      {/* TDS Confirm */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-extrabold text-blue-700">₹{fmt(bd.totalTdsConfirm)}</span>
      </td>
      {/* TDS Provision */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-extrabold text-orange-600">₹{fmt(bd.totalTdsProvision)}</span>
      </td>
      {/* Total */}
      <td className="px-4 py-3 text-right bg-emerald-50/60">
        <div className="flex items-center justify-end gap-2">
          <span className="text-base font-extrabold text-emerald-700">₹{fmt(bd.totalReceipts)}</span>
          <button onClick={()=>onViewBreakdown(bd)} title="View breakdown"
            className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors">
            <Info className="w-4 h-4 text-emerald-500"/>
          </button>
        </div>
      </td>
      {/* Split % */}
      <td className="px-4 py-3 text-center">
        <span className="inline-flex px-3 py-1 bg-purple-50 text-purple-700 text-sm font-bold rounded">
          {splitPct}%
        </span>
      </td>
      {/* Service Period */}
      <td className="px-4 py-3 text-center text-xs text-slate-500 whitespace-nowrap">{servicePeriod}</td>
    </tr>
  )
})
OrderReceiptRow.displayName = 'OrderReceiptRow'

// ─── Main Component ───────────────────────────────────────────
export default function ReceiptSummaryReport() {
  const [orders, setOrders]           = useState([])
  const [viewBreakdown, setViewBD]    = useState(null)
  const [rowData, setRowData]         = useState({})
  const [hideLsi, setHideLsi]         = useState(true)

  const defaultRange = getDefaultDateRange()
  const todayDMY     = todayDDMMYYYY()
  const curYear      = getCurrentYear()
  const curMonthIdx  = getCurrentMonth()

  const [activeTab,    setActiveTab]    = useState('period')
  const [statusFilter, setStatusFilter] = useState('active')
  const [filters, setFilters] = useState({
    search:'', state:'', company:'', entity:'',
    from: defaultRange.from, to: defaultRange.to
  })
  const [selYear,  setSelYear]  = useState(curYear)
  const [selMonth, setSelMonth] = useState(ALL_MONTHS[curMonthIdx])

  // Load orders
  useEffect(()=>{
    fetch('/api/billing/orders')
      .then(r=>r.json())
      .then(j=>{ if(j.success) setOrders(j.data) })
      .catch(e=>console.error('[ReceiptReport] fetch error:',e))
  },[])

  const handleDataReady = useCallback((key, data)=>{
    setRowData(prev=>({...prev,[key]:data}))
  },[])

  // Reset when filters change
  const filterKey = useMemo(()=>JSON.stringify({filters,statusFilter,activeTab,selYear,selMonth}),
    [filters,statusFilter,activeTab,selYear,selMonth])
  useEffect(()=>{ setRowData({}) },[filterKey])

  const yearOptions     = useMemo(()=>getYearOptions(),[])
  const availMonths     = useMemo(()=>selYear==='All'?[]:getAvailMonths(parseInt(selYear)),[selYear])
  const uniqueCompanies = useMemo(()=>[...new Set(orders.map(o=>o.companyName))].filter(Boolean),[orders])

  const handleYearChange = (y) => {
    if(y==='All'){ setSelYear(y); setSelMonth('All') }
    else { const yn=parseInt(y); setSelYear(yn); setSelMonth(yn===curYear?ALL_MONTHS[curMonthIdx]:'All') }
  }

  // Determine which months to include
  const filterMonths = useMemo(()=>{
    if (activeTab==='period') {
      if (selYear==='All') {
        const allMonths=[]
        const startYear=curYear-5
        for(let y=startYear;y<=curYear;y++){
          const maxM=y===curYear?curMonthIdx:11
          for(let m=0;m<=maxM;m++) allMonths.push({year:y,month:m})
        }
        return allMonths
      }
      const yn=parseInt(selYear)
      if (selMonth==='All') {
        const months=[]
        const maxM=yn===curYear?curMonthIdx:11
        for(let m=0;m<=maxM;m++) months.push({year:yn,month:m})
        return months
      }
      return [{year:yn,month:ALL_MONTHS.indexOf(selMonth)}]
    }
    // dateRange
    if(!filters.from||!filters.to) return []
    const from=new Date(filters.from), to=new Date(filters.to)
    const months=[]
    let c=new Date(from.getFullYear(),from.getMonth(),1)
    const end=new Date(to.getFullYear(),to.getMonth(),1)
    while(c<=end){ months.push({year:c.getFullYear(),month:c.getMonth()}); c=new Date(c.getFullYear(),c.getMonth()+1,1) }
    return months
  },[activeTab,selYear,selMonth,filters.from,filters.to,curYear,curMonthIdx])

  // Filter orders
  const filteredOrders = useMemo(()=>{
    return orders.filter(order=>{
      if(filters.search){
        const s=filters.search.toLowerCase()
        if(!order.orderId?.toLowerCase().includes(s)&&!order.lsiId?.toLowerCase().includes(s)) return false
      }
      if(filters.company&&!order.companyName?.toLowerCase().includes(filters.company.toLowerCase())) return false
      if(filters.entity&&order.entity!==filters.entity) return false
      if(filters.state&&order.billing1?.state!==filters.state&&order.billing2?.state!==filters.state) return false

      const matchStatus=statusFilter==='active'?order.status==='PCD':order.status==='Terminate'
      if(!matchStatus) return false

      const pcdDate=parseAnyDate(order.pcdDate)
      if(!pcdDate) return false

      const hasService=filterMonths.some(fm=>{
        const monthStart=new Date(fm.year,fm.month,1)
        const monthEnd=new Date(fm.year,fm.month+1,0,23,59,59)
        const termDate=order.terminateDate?parseAnyDate(order.terminateDate):null
        const se=termDate?new Date(termDate):new Date()
        se.setDate(se.getDate()-1)
        return pcdDate<=monthEnd&&se>=monthStart
      })
      return hasService
    })
  },[orders,filters,statusFilter,filterMonths])

  const expectedRows = useMemo(()=>filteredOrders.reduce((c,o)=>c+(isSplit(o)?2:1),0),[filteredOrders])

  const totals = useMemo(()=>{
    const d=Object.values(rowData)
    return {
      received:    d.reduce((s,v)=>s+(v.received||0),0),
      creditNotes: d.reduce((s,v)=>s+(v.creditNotes||0),0),
      tdsConfirm:  d.reduce((s,v)=>s+(v.tdsConfirm||0),0),
      tdsProvision:d.reduce((s,v)=>s+(v.tdsProvision||0),0),
      total:       d.reduce((s,v)=>s+(v.total||0),0),
    }
  },[rowData])

  const isCalc = useMemo(()=>expectedRows>0&&Object.keys(rowData).length<expectedRows,[rowData,expectedRows])

  const clearFilters = useCallback(()=>{
    const dr=getDefaultDateRange()
    setFilters({search:'',state:'',company:'',entity:'',from:dr.from,to:dr.to})
    setActiveTab('period'); setSelYear(curYear); setSelMonth(ALL_MONTHS[curMonthIdx]); setStatusFilter('active')
  },[curYear,curMonthIdx])

  const hasFilters = filters.search||filters.state||filters.company||filters.entity
  const periodLabel = selYear==='All'?'All Time':selMonth==='All'?`Jan – Dec ${selYear}`:`${selMonth} ${selYear}`

  if (viewBreakdown) return <ReceiptBreakdownTable bd={viewBreakdown} onClose={()=>setViewBD(null)}/>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/10 to-slate-50">
      <div className="max-w-[1900px] mx-auto p-4 lg:p-6">

        {/* Controls */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mb-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-emerald-600"/>Receipt Summary Report
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Period-based receipts — Received, Credit Notes (incl. GST) &amp; TDS per order</p>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"/>
              <input type="text" placeholder="Search Order / LSI…"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={filters.search} onChange={e=>setFilters(p=>({...p,search:e.target.value}))}/>
            </div>
            <select className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 min-w-[120px]"
              value={filters.state} onChange={e=>setFilters(p=>({...p,state:e.target.value}))}>
              <option value="">All States</option>
              {INDIAN_STATES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 min-w-[140px]"
              value={filters.company} onChange={e=>setFilters(p=>({...p,company:e.target.value}))}>
              <option value="">All Companies</option>
              {uniqueCompanies.map(c=><option key={c} value={c}>{c.slice(0,25)}</option>)}
            </select>
            <select className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 min-w-[110px]"
              value={filters.entity} onChange={e=>setFilters(p=>({...p,entity:e.target.value}))}>
              <option value="">All Entities</option>
              {ENTITIES.map(e=><option key={e} value={e}>{e}</option>)}
            </select>
            <select className="px-3 py-2 border border-emerald-300 rounded-lg text-sm bg-emerald-50 text-emerald-700 font-semibold focus:ring-2 focus:ring-emerald-400 min-w-[140px]"
              value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="active">Active (PCD)</option>
              <option value="inactive">Inactive (Terminate)</option>
            </select>
            {hasFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 bg-rose-50 text-rose-600 text-sm rounded-lg border border-rose-200 hover:bg-rose-100">
                <X className="w-3.5 h-3.5"/>Clear
              </button>
            )}
            <div className="flex-1"/>

            {/* Stats chips */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Orders</p>
              <p className="text-2xl font-extrabold text-slate-900">{filteredOrders.length}</p>
            </div>
            {[
              {label:'Received',             val:totals.received,    color:'text-green-700',  bg:'bg-green-50',  border:'border-green-200'},
              {label:'Credit Notes+ Gst', val:totals.creditNotes, color:'text-cyan-700',   bg:'bg-cyan-50',   border:'border-cyan-200'},
              {label:'TDS Confirm',          val:totals.tdsConfirm,  color:'text-blue-700',   bg:'bg-blue-50',   border:'border-blue-200'},
              {label:'TDS Provision',        val:totals.tdsProvision,color:'text-orange-600', bg:'bg-orange-50', border:'border-orange-200'},
              {label:'Total Receipts',       val:totals.total,       color:'text-emerald-700',bg:'bg-emerald-50',border:'border-emerald-300'},
            ].map(({label,val,color,bg,border})=>(
              <div key={label} className={`${bg} border ${border} rounded-xl px-4 py-2.5 text-center min-w-[130px]`}>
                <p className={`text-[10px] font-bold uppercase ${color} opacity-80`}>{label}</p>
                {isCalc?(
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <div className={`animate-spin h-4 w-4 rounded-full border-b-2 ${color.replace('text','border')}`}/>
                    <span className={`text-xs font-semibold ${color}`}>…</span>
                  </div>
                ):(
                  <p className={`text-base font-extrabold ${color}`}>₹{fmt(val)}</p>
                )}
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 mb-4">
            <div className="flex">
              {[['period','Period Selector'],['dateRange','Date Range']].map(([t,l])=>(
                <button key={t}
                  onClick={()=>{ setActiveTab(t); const dr=getDefaultDateRange(); setFilters(p=>({...p,from:dr.from,to:dr.to})) }}
                  className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${activeTab===t?'text-emerald-600 border-emerald-600':'text-slate-500 border-transparent hover:text-slate-700'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-0.5">
              <button onClick={()=>setHideLsi(!hideLsi)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200">
                {hideLsi?<Eye className="w-4 h-4"/>:<EyeOff className="w-4 h-4"/>} {hideLsi?'Show':'Hide'} LSI
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
                <Download className="w-4 h-4"/>Export
              </button>
            </div>
          </div>

          {/* Period selector */}
          {activeTab==='period' && (
            <div className="flex flex-wrap items-center gap-4 px-1">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Year</label>
                <select className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={selYear} onChange={e=>handleYearChange(e.target.value)}>
                  {yearOptions.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {selYear!=='All' && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1 min-w-[360px]">
                  <label className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Month</label>
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={()=>setSelMonth('All')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selMonth==='All'?'bg-emerald-500 text-white':'bg-white text-slate-700 border border-slate-200 hover:border-emerald-300'}`}>
                      All
                    </button>
                    {ALL_MONTHS.map(m=>{
                      const ok=availMonths.includes(m)
                      return (
                        <button key={m} onClick={()=>ok&&setSelMonth(m)} disabled={!ok}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${selMonth===m?'bg-emerald-500 text-white':ok?'bg-white text-slate-700 border border-slate-200 hover:border-emerald-300':'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'}`}>
                          {m}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg px-3 py-1.5">
                <span className="text-sm font-bold text-emerald-700">Showing: {periodLabel}</span>
              </div>
            </div>
          )}

          {/* Date range */}
          {activeTab==='dateRange' && (
            <div className="flex flex-wrap gap-4 px-1">
              {[['From','from'],['To','to']].map(([l,k])=>(
                <div key={k} className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-600">{l}:</label>
                  <input type="date"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={filters[k]} max={toInputFmt(todayDMY)}
                    onChange={e=>setFilters(p=>({...p,[k]:e.target.value}))}/>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-emerald-50 border-b-2 border-gray-200">
                  <th className="px-4 py-4 text-left   text-xs font-bold text-gray-700 uppercase tracking-wider">Order ID</th>
                  {!hideLsi && <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">LSI ID</th>}
                  <th className="px-4 py-4 text-left   text-xs font-bold text-gray-700 uppercase tracking-wider">End A</th>
                  <th className="px-4 py-4 text-left   text-xs font-bold text-gray-700 uppercase tracking-wider">End B</th>
                  <th className="px-4 py-4 text-left   text-xs font-bold text-gray-700 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-4 text-left   text-xs font-bold text-gray-700 uppercase tracking-wider">State</th>
                  <th className="px-4 py-4 text-right  text-xs font-bold text-gray-700 uppercase tracking-wider">Received</th>
                  <th className="px-4 py-4 text-right  text-xs font-bold text-gray-700  uppercase tracking-wider">
                    Credit Notes+Gst<br/>
                  </th>
                  <th className="px-4 py-4 text-right  text-xs font-bold text-gray-700 uppercase tracking-wider">TDS Confirm</th>
                  <th className="px-4 py-4 text-right  text-xs font-bold text-gray-700 uppercase tracking-wider">TDS Provision</th>
                  <th className="px-4 py-4 text-right  text-xs font-bold text-gray-700 uppercase tracking-wider bg-emerald-50">Total Receipts</th>
                  <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Split</th>
                  <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Service Period</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredOrders.map((order,idx)=>{
                  const split=isSplit(order)
                  if(split){
                    const s1=order.billing1?.state||''
                    const s2=order.billing2?.state||''
                    return (
                      <React.Fragment key={`${order._id}-${idx}`}>
                        <OrderReceiptRow rowKey={`${order._id}-${s1}-${idx}`} order={order} filterMonths={filterMonths}
                          splitState={s1} onViewBreakdown={setViewBD} onDataReady={handleDataReady} hideLsi={hideLsi}/>
                        <OrderReceiptRow rowKey={`${order._id}-${s2}-${idx}`} order={order} filterMonths={filterMonths}
                          splitState={s2} onViewBreakdown={setViewBD} onDataReady={handleDataReady} hideLsi={hideLsi}/>
                      </React.Fragment>
                    )
                  }
                  return (
                    <OrderReceiptRow key={`${order._id}-${idx}`} rowKey={`${order._id}-main-${idx}`}
                      order={order} filterMonths={filterMonths} splitState={order.billing1?.state||''}
                      onViewBreakdown={setViewBD} onDataReady={handleDataReady} hideLsi={hideLsi}/>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredOrders.length===0 && (
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