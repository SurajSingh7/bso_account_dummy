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
// ✅ FIX: handles BOTH ISO ("2025-07-09T18:30:00.000Z") AND "DD-MM-YYYY"
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
const getCurrentMonth = () => new Date().getMonth()   // 0-based
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

// ─── Credit-pool balance algorithm (matches Monthly Bill Generator) ────
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

// ─── Main data loader per row ─────────────────────────────────
// Instead of recalculating, we READ the billing records directly.
// For months without records (not yet generated), we estimate from order fields.
const loadOrderBreakdown = async (order, toDateStr, splitState) => {
  const pcdDate = parseAnyDate(order.pcdDate)
  const termDate = order.terminateDate ? parseAnyDate(order.terminateDate) : null
  const toDate  = parseAnyDate(toDateStr)   // DD-MM-YYYY string

  console.log(`[loadBreakdown] orderId=${order.orderId} state="${splitState}" pcd=${order.pcdDate} to=${toDateStr}`)

  const breakdownBase = {
    months: [], totalBalance: 0,
    orderDetails: {
      orderId: order.orderId, lsiId: order.lsiId, state: splitState,
      splitFactor: isSplit(order) ? 2 : 1,
      pcdDate: order.pcdDate, terminateDate: order.terminateDate,
      capacity: Number(order.capacity)||0, baseRate: Number(order.amount)||0,
    }
  }

  if (!pcdDate || !toDate) {
    console.warn(`[loadBreakdown] SKIP — cannot parse dates pcd="${order.pcdDate}" to="${toDateStr}"`)
    return breakdownBase
  }

  // Fetch billing records
  let billingData = []
  try {
    const r = await fetch(`/api/billing/monthly?orderId=${order.orderId}`)
    const j = await r.json()
    if (j.success) {
      billingData = j.data
      console.log(`[loadBreakdown] orderId=${order.orderId} — ${billingData.length} billing records fetched`)
      const stateRecords = billingData.filter(b => b.state === splitState)
      console.log(`  └─ records matching state="${splitState}": ${stateRecords.length}`)
      if (!stateRecords.length && billingData.length) {
        console.log(`  └─ available states: ${[...new Set(billingData.map(b=>b.state))].join(', ')}`)
      }
    } else {
      console.error(`[loadBreakdown] API error:`, j.error)
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

  const effectiveStart = new Date(Math.max(pcdDate.getTime(), new Date(pcdDate.getFullYear(), pcdDate.getMonth(), 1).getTime()))
  let cur = new Date(pcdDate.getFullYear(), pcdDate.getMonth(), 1)

  while (cur <= serviceEnd && cur <= toDate) {
    const m = cur.getMonth(), y = cur.getFullYear()
    const monthName = fmtMonthYear(m, y)
    const rec = billingData.find(b => b.month === monthName && b.state === splitState)

    let totalWithGst, monthlyBilling, gstAmt, miscSell, received, creditNotes, tdsProvision, tdsConfirm, invoiceNumber, billingDays, startDay, endDay

    if (rec) {
      // ✅ Use billing record values directly — most accurate
      totalWithGst  = Number(rec.totalWithGst) || 0
      monthlyBilling = Number(rec.monthlyBilling) || 0
      gstAmt        = (Number(rec.igst)||0) + (Number(rec.cgst)||0) + (Number(rec.sgst)||0)
      miscSell      = sumTotalWithGst(rec.miscellaneousSell)
      received      = sumAmount(rec.receivedDetails)
      creditNotes   = sumAmount(rec.creditNotes)
      tdsProvision  = sumAmount(rec.tdsProvision)
      tdsConfirm    = sumAmount(rec.tdsConfirm)
      invoiceNumber = rec.invoiceNumber || '-'
      billingDays   = rec.billingDays || getDaysInMonth(m, y)
      startDay      = Number((rec.startDate||'').split('-')[0]) || 1
      endDay        = Number((rec.endDate||'').split('-')[0])   || getDaysInMonth(m, y)

      console.log(`  [${monthName}] from billing record: total=${totalWithGst.toFixed(2)} misc=${miscSell.toFixed(2)} recv=${received.toFixed(2)} cn=${creditNotes.toFixed(2)} tdsp=${tdsProvision.toFixed(2)} tdsc=${tdsConfirm.toFixed(2)}`)
    } else {
      // Estimate for months without billing records (future / not yet generated)
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
      const gstRate     = 0.18  // simplified; real code reads gstDetails per state
      const grandTotal  = baseMonthly * (1 + gstRate)

      startDay = isPcd ? pcdDate.getDate() : 1
      endDay   = isTerm ? serviceEnd.getDate() : daysInM
      billingDays = endDay - startDay + 1
      totalWithGst  = (grandTotal / daysInM) * billingDays
      monthlyBilling = totalWithGst / (1 + gstRate)
      gstAmt        = totalWithGst - monthlyBilling
      miscSell = received = creditNotes = tdsProvision = tdsConfirm = 0
      invoiceNumber = '-'
      console.log(`  [${monthName}] ESTIMATED (no billing record): total=${totalWithGst.toFixed(2)}`)
    }

    breakdownBase.months.push({
      monthYear: monthName, month: m, year: y, billingDays, startDay, endDay,
      monthlyBilling, gst: gstAmt, totalWithGst, miscSell,
      received, creditNotes, tdsProvision, tdsConfirm, invoiceNumber
    })

    if (termDate && y === serviceEnd.getFullYear() && m === serviceEnd.getMonth()) break
    cur = new Date(y, m+1, 1)
  }

  breakdownBase.totalBalance = creditPoolBalance(breakdownBase.months)
  console.log(`[loadBreakdown] orderId=${order.orderId} state="${splitState}" months=${breakdownBase.months.length} balance=${breakdownBase.totalBalance.toFixed(2)}`)
  return breakdownBase
}

// ─── Truncated text ────────────────────────────────────────────
const TextPopup = React.memo(({ text, onClose }) => {
  useEffect(()=>{ const h=e=>{if(e.key==='Escape')onClose()}; document.addEventListener('keydown',h); return ()=>document.removeEventListener('keydown',h) },[onClose])
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

const Trunc = React.memo(({ text, limit, cls='' }) => {
  const [show, setShow] = useState(false)
  if (!text) return <span className={cls}>-</span>
  if (text.length <= limit) return <span className={cls}>{text}</span>
  return (
    <>
      <span className={cls}>{text.slice(0,limit)}<span className="text-blue-600 cursor-pointer hover:underline ml-1" onClick={()=>setShow(true)}>..more</span></span>
      {show && <TextPopup text={text} onClose={()=>setShow(false)}/>}
    </>
  )
})
Trunc.displayName = 'Trunc'

// ─── Breakdown popup (full month table) ──────────────────────
const BreakdownTable = ({ bd, onClose }) => {
  if (!bd) return null
  const od = bd.orderDetails
  const sorted = [...bd.months].sort((a,b)=>new Date(a.year,a.month)-new Date(b.year,b.month))

  // running balance rows
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
    mb: a.mb+m.monthlyBilling, gst: a.gst+m.gst, total: a.total+m.totalWithGst,
    misc: a.misc+m.miscSell, recv: a.recv+m.received, cn: a.cn+m.creditNotes,
    tdsp: a.tdsp+m.tdsProvision, tdsc: a.tdsc+m.tdsConfirm
  }),{mb:0,gst:0,total:0,misc:0,recv:0,cn:0,tdsp:0,tdsc:0})

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] overflow-y-auto py-8 px-4">
      <div className="max-w-[1400px] mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileText className="w-5 h-5"/>Monthly Billing Breakdown</h2>
            <p className="text-blue-100 text-sm mt-0.5">Order: <b className="text-white">{od.orderId}</b> — State: <b className="text-white">{od.state}</b></p>
          </div>
          <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium text-sm transition-all">
            <ArrowLeft className="w-4 h-4"/>Back
          </button>
        </div>

        {/* Order info bar */}
        <div className="grid grid-cols-6 gap-3 px-6 py-4 bg-slate-50 border-b border-slate-200">
          {[['Order ID',od.orderId],['LSI ID',od.lsiId||'-'],['Capacity',`${od.capacity} Mbps`],['Base Rate',`₹${od.baseRate}`],['PCD Date',od.pcdDate?.split('T')[0]||od.pcdDate],['Terminate',od.terminateDate?.split('T')[0]||od.terminateDate||'Active']].map(([l,v])=>(
            <div key={l} className="bg-white rounded-lg p-3 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{l}</p>
              <p className="text-sm font-bold text-slate-800">{v}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-300">
                {['Month','Days','Period','Monthly Billing','GST','Total + GST','Misc+GST Sell','Received','Credit Notes','TDS Prov','TDS Conf','Running Balance','Remaining Adj'].map(h=>(
                  <th key={h} className="px-3 py-3 text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap text-right first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((m,i)=>(
                <tr key={i} className="hover:bg-blue-50/30">
                  <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{m.monthYear}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-slate-700">{m.billingDays}</td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{String(m.startDay).padStart(2,'0')}-{String(m.month+1).padStart(2,'0')}-{m.year}<br/>{String(m.endDay).padStart(2,'0')}-{String(m.month+1).padStart(2,'0')}-{m.year}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-800">₹{fmt(m.monthlyBilling)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">₹{fmt(m.gst)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-indigo-700">₹{fmt(m.totalWithGst)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-purple-600">₹{fmt(m.miscSell)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-green-600">₹{fmt(m.received)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-cyan-600">₹{fmt(m.creditNotes)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-orange-500">₹{fmt(m.tdsProvision)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-blue-600">₹{fmt(m.tdsConfirm)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-800">₹{fmt(m.running)}</td>
                  <td className={`px-3 py-2.5 text-right font-bold ${m.remAdj>0?'text-rose-700 bg-rose-50':'text-emerald-700 bg-emerald-50'}`}>₹{fmt(m.remAdj)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 border-t-2 border-emerald-300 font-bold">
                <td colSpan="3" className="px-3 py-3 text-slate-900 font-bold">TOTAL</td>
                <td className="px-3 py-3 text-right text-slate-900">₹{fmt(T.mb)}</td>
                <td className="px-3 py-3 text-right text-slate-600">₹{fmt(T.gst)}</td>
                <td className="px-3 py-3 text-right text-indigo-700 text-base">₹{fmt(T.total)}</td>
                <td className="px-3 py-3 text-right text-purple-700">₹{fmt(T.misc)}</td>
                <td className="px-3 py-3 text-right text-green-700">₹{fmt(T.recv)}</td>
                <td className="px-3 py-3 text-right text-cyan-700">₹{fmt(T.cn)}</td>
                <td className="px-3 py-3 text-right text-orange-600">₹{fmt(T.tdsp)}</td>
                <td className="px-3 py-3 text-right text-blue-700">₹{fmt(T.tdsc)}</td>
                <td className="px-3 py-3 text-right text-slate-900 text-base">₹{fmt(rows[rows.length-1]?.running||0)}</td>
                <td className={`px-3 py-3 text-right text-base font-bold ${(rows[rows.length-1]?.remAdj||0)>0?'text-rose-700':'text-emerald-700'}`}>₹{fmt(rows[rows.length-1]?.remAdj||0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Single table row ─────────────────────────────────────────
const OrderRow = React.memo(({ order, hideLsiColumn, toDateStr, splitState, onViewBreakdown, onBalanceReady, rowKey }) => {
  const router = useRouter()
  const [bd, setBd]       = useState(null)
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
  }, [order._id, toDateStr, splitState])

  if (loading) return (
    <tr className="border-b border-slate-100">
      <td colSpan={hideLsiColumn ? 14 : 15} className="px-4 py-3 text-center text-slate-400 text-sm">
        <div className="flex items-center justify-center gap-2">
          <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-blue-500"/>
          <span>Loading {order.orderId}…</span>
        </div>
      </td>
    </tr>
  )

  if (!bd) return null

  // Aggregate column values
  const T = bd.months.reduce((a,m)=>({
    mb:    a.mb   + m.monthlyBilling,
    gst:   a.gst  + m.gst,
    total: a.total+ m.totalWithGst,
    misc:  a.misc + m.miscSell,
    recv:  a.recv + m.received,
    cn:    a.cn   + m.creditNotes,
    tdsp:  a.tdsp + m.tdsProvision,
    tdsc:  a.tdsc + m.tdsConfirm,
  }),{mb:0,gst:0,total:0,misc:0,recv:0,cn:0,tdsp:0,tdsc:0})

  const bal = bd.totalBalance
  const termDate = order.terminateDate ? parseAnyDate(order.terminateDate) : null
  const isActive = !termDate

  return (
    <tr className="hover:bg-blue-50/30 transition-colors border-b border-slate-100 last:border-0">
      {/* Order ID */}
      <td className="px-3 py-3 whitespace-nowrap">
        <span className="text-[13px] font-bold text-blue-600">{order.orderId}</span>
      </td>
      {/* LSI ID */}
      {!hideLsiColumn && (
        <td className="px-3 py-3">
          <span className="text-[12px] font-semibold text-orange-500">{order.lsiId||'-'}</span>
        </td>
      )}
      {/* Company */}
      <td className="px-3 py-3 max-w-[130px]">
        <Trunc text={order.companyName} limit={15} cls="text-[12px] font-semibold text-slate-700"/>
      </td>
      {/* State */}
      <td className="px-3 py-3">
        <span className="inline-flex px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded whitespace-nowrap">
          {splitState || order.billing1?.state || '-'}
        </span>
      </td>
      {/* Monthly Billing */}
      <td className="px-3 py-3 text-right">
        <span className="text-[12px] font-bold text-slate-800">₹{fmt(T.mb)}</span>
      </td>
      {/* GST */}
      <td className="px-3 py-3 text-right">
        <span className="text-[12px] text-slate-500">₹{fmt(T.gst)}</span>
      </td>
      {/* Total + GST */}
      <td className="px-3 py-3 text-right">
        <span className="text-[12px] font-bold text-indigo-700">₹{fmt(T.total)}</span>
      </td>
      {/* Misc + GST Sell */}
      <td className="px-3 py-3 text-right">
        <span className="text-[12px] font-semibold text-purple-600">₹{fmt(T.misc)}</span>
      </td>
      {/* Received */}
      <td className="px-3 py-3 text-right">
        <span className="text-[12px] font-bold text-green-600">₹{fmt(T.recv)}</span>
      </td>
      {/* Credit Notes */}
      <td className="px-3 py-3 text-right">
        <span className="text-[12px] font-bold text-cyan-600">₹{fmt(T.cn)}</span>
      </td>
      {/* TDS Prov */}
      <td className="px-3 py-3 text-right">
        <span className="text-[12px] text-orange-500">₹{fmt(T.tdsp)}</span>
      </td>
      {/* TDS Conf */}
      <td className="px-3 py-3 text-right">
        <span className="text-[12px] text-blue-500">₹{fmt(T.tdsc)}</span>
      </td>
      {/* Balance */}
      <td className="px-3 py-3 text-right bg-yellow-50/60">
        <div className="flex items-center justify-end gap-1">
          <span className={`text-[13px] font-extrabold ${bal>=0?'text-emerald-600':'text-rose-600'}`}>₹{fmt(bal)}</span>
          <button onClick={()=>onViewBreakdown(bd)} title="View breakdown" className="p-1 hover:bg-blue-100 rounded transition-colors">
            <Info className="w-3.5 h-3.5 text-blue-500"/>
          </button>
        </div>
      </td>
      {/* Service Period */}
      <td className="px-3 py-3">
        <div className="text-[11px] text-slate-600 font-medium whitespace-nowrap">
          <div>{order.pcdDate?.split('T')[0]||order.pcdDate}</div>
          <div className="text-slate-400">→ {termDate ? order.terminateDate?.split('T')[0]||order.terminateDate : 'Active'}</div>
          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${isActive?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}`}>
            {isActive ? 'Active' : 'Terminated'}
          </span>
        </div>
      </td>
      {/* Action */}
      <td className="px-3 py-3 text-center">
        <button onClick={()=>router.push(`/billing/generator?orderId=${order.orderId}`)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all">
          <FileSpreadsheet className="w-3.5 h-3.5"/>G
        </button>
      </td>
    </tr>
  )
})
OrderRow.displayName = 'OrderRow'

// ─── Main component ────────────────────────────────────────────
export default function OutstandingReportComp() {
  const router = useRouter()
  const [orders, setOrders]           = useState([])
  const [hideLsiCol, setHideLsiCol]   = useState(true)
  const [viewBreakdown, setViewBD]    = useState(null)
  const [rowBalances, setRowBalances] = useState({})

  const defaultRange    = getDefaultDateRange()
  const todayDMY        = todayDDMMYYYY()
  const curYear         = getCurrentYear()
  const curMonthIdx     = getCurrentMonth()

  const [activeTab,    setActiveTab]    = useState('period')
  const [statusFilter, setStatusFilter] = useState('active')
  const [filters, setFilters] = useState({ search:'', state:'', company:'', entity:'', from: defaultRange.from, to: defaultRange.to })
  const [selYear,  setSelYear]  = useState(curYear)
  const [selMonth, setSelMonth] = useState('All')

  // Load orders
  useEffect(() => {
    console.log('[OutstandingReport] fetching orders...')
    fetch('/api/billing/orders')
      .then(r=>r.json())
      .then(j => {
        console.log(`[OutstandingReport] orders fetched: success=${j.success} count=${j.data?.length??0}`)
        if (j.success) {
          setOrders(j.data)
          if (j.data?.length) console.log('[OutstandingReport] sample order status:', j.data[0].status, '| pcdDate:', j.data[0].pcdDate)
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
  useEffect(()=>{ console.log('[OutstandingReport] filters changed — resetting balances'); setRowBalances({}) },[filterKey])

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
  }, [selMonth, selYear, activeTab])

  const yearOptions     = useMemo(()=>getYearOptions(),[])
  const availMonths     = useMemo(()=>selYear==='All'?[]:getAvailMonths(parseInt(selYear)),[selYear])
  const uniqueCompanies = useMemo(()=>[...new Set(orders.map(o=>o.companyName))].filter(Boolean),[orders])

  const handleYearChange = (y) => {
    if (y==='All') { setSelYear(y); setSelMonth('All') }
    else { const yn=parseInt(y); setSelYear(yn); setSelMonth(yn===curYear?ALL_MONTHS[curMonthIdx]:'All') }
  }

  // ✅ FILTER — with ISO-safe parseAnyDate
  const filteredOrders = useMemo(() => {
    const result = orders.filter(order => {
      // text search
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (!order.orderId?.toLowerCase().includes(s) && !order.lsiId?.toLowerCase().includes(s)) return false
      }
      if (filters.company && !order.companyName?.toLowerCase().includes(filters.company.toLowerCase())) return false
      if (filters.entity  && order.entity !== filters.entity) return false
      if (filters.state   && order.billing1?.state !== filters.state && order.billing2?.state !== filters.state) return false

      // status
      const matchStatus = statusFilter === 'active' ? order.status === 'PCD' : order.status === 'Terminate'
      if (!matchStatus) {
        console.log(`[filter] SKIP orderId=${order.orderId} status="${order.status}" (want: ${statusFilter})`)
        return false
      }

      // ✅ date — uses parseAnyDate which handles ISO format
      const pcdDate  = parseAnyDate(order.pcdDate)
      const termDate = order.terminateDate ? parseAnyDate(order.terminateDate) : null

      if (!pcdDate) {
        console.warn(`[filter] SKIP orderId=${order.orderId} — cannot parse pcdDate="${order.pcdDate}"`)
        return false
      }

      let matchDate = true
      if (activeTab === 'period' && selYear !== 'All') {
        const yn = parseInt(selYear)
        const mIdx = selMonth === 'All' ? (yn===curYear?curMonthIdx:11) : ALL_MONTHS.indexOf(selMonth)
        const endOfPeriod = new Date(yn, mIdx+1, 0, 23, 59, 59)
        matchDate = pcdDate <= endOfPeriod
        console.log(`[filter] orderId=${order.orderId} pcd=${pcdDate.toDateString()} endOfPeriod=${endOfPeriod.toDateString()} match=${matchDate}`)
      } else if (activeTab === 'dateRange' && filters.from && filters.to) {
        const from = new Date(filters.from); from.setHours(0,0,0,0)
        const to   = new Date(filters.to);   to.setHours(23,59,59,999)
        matchDate  = pcdDate <= to && (!termDate || termDate >= from)
      }

      return matchDate
    })

    console.log(`[OutstandingReport] filteredOrders count=${result.length} (from total=${orders.length})`)
    return result
  }, [orders, filters, statusFilter, activeTab, selYear, selMonth])

  const expectedRows  = useMemo(()=>filteredOrders.reduce((c,o)=>c+(isSplit(o)?2:1),0),[filteredOrders])
  const totalBalance  = useMemo(()=>Object.values(rowBalances).reduce((s,b)=>s+b,0),[rowBalances])
  const isCalc        = useMemo(()=>expectedRows>0&&Object.keys(rowBalances).length<expectedRows,[rowBalances,expectedRows])

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

        {/* ── Controls ── */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mb-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-slate-900">Outstanding Balance Report</h1>
            <p className="text-[13px] text-slate-400 mt-0.5">Cumulative balances per order up to selected period</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"/>
              <input type="text" placeholder="Search Order / LSI…" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.search} onChange={e=>setFilters(p=>({...p,search:e.target.value}))}/>
            </div>
            <select className="px-3 py-2 border border-slate-300 rounded-lg text-[13px] bg-white focus:ring-2 focus:ring-blue-500 min-w-[120px]" value={filters.state} onChange={e=>setFilters(p=>({...p,state:e.target.value}))}>
              <option value="">All States</option>
              {INDIAN_STATES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select className="px-3 py-2 border border-slate-300 rounded-lg text-[13px] bg-white focus:ring-2 focus:ring-blue-500 min-w-[140px]" value={filters.company} onChange={e=>setFilters(p=>({...p,company:e.target.value}))}>
              <option value="">All Companies</option>
              {uniqueCompanies.map(c=><option key={c} value={c}>{c.slice(0,25)}</option>)}
            </select>
            <select className="px-3 py-2 border border-slate-300 rounded-lg text-[13px] bg-white focus:ring-2 focus:ring-blue-500 min-w-[110px]" value={filters.entity} onChange={e=>setFilters(p=>({...p,entity:e.target.value}))}>
              <option value="">All Entities</option>
              {ENTITIES.map(e=><option key={e} value={e}>{e}</option>)}
            </select>
            <select className="px-3 py-2 border border-emerald-300 rounded-lg text-[13px] bg-emerald-50 text-emerald-700 font-semibold focus:ring-2 focus:ring-emerald-400 min-w-[140px]" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="active">Active (PCD)</option>
              <option value="inactive">Inactive (Terminate)</option>
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 bg-rose-50 text-rose-600 text-[13px] rounded-lg border border-rose-200 hover:bg-rose-100">
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
                <button key={t} onClick={()=>{setActiveTab(t); const dr=getDefaultDateRange(); setFilters(p=>({...p,from:dr.from,to:dr.to}))}}
                  className={`px-5 py-2.5 text-[13px] font-semibold border-b-2 transition-all ${activeTab===t?'text-teal-600 border-teal-600':'text-slate-500 border-transparent hover:text-slate-700'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-0.5">
              <button onClick={()=>setHideLsiCol(!hideLsiCol)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-[12px] font-medium rounded-lg hover:bg-slate-200">
                {hideLsiCol?<Eye className="w-4 h-4"/>:<EyeOff className="w-4 h-4"/>} {hideLsiCol?'Show':'Hide'} LSI
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-[12px] font-medium rounded-lg hover:bg-blue-700">
                <Download className="w-4 h-4"/>Export
              </button>
            </div>
          </div>

          {/* Period selector */}
          {activeTab === 'period' && (
            <div className="flex flex-wrap items-center gap-4 px-1">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Year</label>
                <select className="border border-slate-300 rounded-lg px-3 py-1.5 text-[13px] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  value={selYear} onChange={e=>handleYearChange(e.target.value)}>
                  {yearOptions.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {selYear !== 'All' && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1 min-w-[360px]">
                  <label className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Month</label>
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={()=>setSelMonth('All')} className={`px-3 py-1 rounded-lg text-[12px] font-bold transition-all ${selMonth==='All'?'bg-teal-500 text-white':'bg-white text-slate-700 border border-slate-200 hover:border-teal-300'}`}>All</button>
                    {ALL_MONTHS.map(m=>{const ok=availMonths.includes(m); return (
                      <button key={m} onClick={()=>ok&&setSelMonth(m)} disabled={!ok}
                        className={`px-2.5 py-1 rounded-lg text-[12px] font-bold transition-all ${selMonth===m?'bg-teal-500 text-white':ok?'bg-white text-slate-700 border border-slate-200 hover:border-teal-300':'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'}`}>
                        {m}
                      </button>
                    )})}
                  </div>
                </div>
              )}
              <div className="bg-teal-50 border-2 border-teal-200 rounded-lg px-3 py-1.5">
                <span className="text-[13px] font-bold text-teal-700">Showing: {periodLabel}</span>
              </div>
            </div>
          )}

          {/* Date range */}
          {activeTab === 'dateRange' && (
            <div className="flex flex-wrap gap-4 px-1">
              {[['From','from'],['To','to']].map(([l,k])=>(
                <div key={k} className="flex items-center gap-2">
                  <label className="text-[13px] font-semibold text-slate-600">{l}:</label>
                  <input type="date" className="px-3 py-2 border border-slate-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={filters[k]} max={toInputFmt(todayDMY)}
                    onChange={e=>setFilters(p=>({...p,[k]:e.target.value}))}/>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-200">
                  <th className="px-3 py-3 text-left   text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Order ID</th>
                  {!hideLsiCol && <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">LSI ID</th>}
                  <th className="px-3 py-3 text-left   text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Company</th>
                  <th className="px-3 py-3 text-left   text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">State</th>
                  <th className="px-3 py-3 text-right  text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Monthly Billing</th>
                  <th className="px-3 py-3 text-right  text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">GST</th>
                  <th className="px-3 py-3 text-right  text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Total + GST</th>
                  <th className="px-3 py-3 text-right  text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Misc+GST Sell</th>
                  <th className="px-3 py-3 text-right  text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Received</th>
                  <th className="px-3 py-3 text-right  text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Credit Notes</th>
                  <th className="px-3 py-3 text-right  text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">TDS Prov</th>
                  <th className="px-3 py-3 text-right  text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">TDS Conf</th>
                  <th className="px-3 py-3 text-right  text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap bg-yellow-50">Balance</th>
                  <th className="px-3 py-3 text-left   text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Service Period</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredOrders.map((order, idx) => {
                  const split = isSplit(order)
                  if (split) {
                    const s1 = order.billing1?.state||''
                    const s2 = order.billing2?.state||''
                    return (
                      <React.Fragment key={`${order._id}-${idx}`}>
                        <OrderRow rowKey={`${order._id}-${s1}-${idx}`} order={order} hideLsiColumn={hideLsiCol} toDateStr={toDateStr} splitState={s1} onViewBreakdown={setViewBD} onBalanceReady={handleBalanceReady}/>
                        <OrderRow rowKey={`${order._id}-${s2}-${idx}`} order={order} hideLsiColumn={hideLsiCol} toDateStr={toDateStr} splitState={s2} onViewBreakdown={setViewBD} onBalanceReady={handleBalanceReady}/>
                      </React.Fragment>
                    )
                  }
                  return <OrderRow key={`${order._id}-${idx}`} rowKey={`${order._id}-main-${idx}`} order={order} hideLsiColumn={hideLsiCol} toDateStr={toDateStr} splitState={order.billing1?.state||''} onViewBreakdown={setViewBD} onBalanceReady={handleBalanceReady}/>
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