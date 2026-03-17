'use client'
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Search, ChevronDown, X, Building2, CheckSquare, Square,
  IndianRupee, CalendarDays, StickyNote, Zap, AlertCircle,
  CheckCircle2, Loader2, Filter, Users, RotateCcw,
  Send, SlidersHorizontal, PenLine, ChevronRight,
  Banknote, ArrowLeft, Lock, Info, Eye, CreditCard, Wallet,
  Building, Smartphone
} from 'lucide-react'

const INDIAN_STATES = [
  { key: "AP", name: "Andhra Pradesh" }, { key: "AR", name: "Arunachal Pradesh" },
  { key: "AS", name: "Assam" }, { key: "BR", name: "Bihar" },
  { key: "CG", name: "Chhattisgarh" }, { key: "GA", name: "Goa" },
  { key: "GJ", name: "Gujarat" }, { key: "HR", name: "Haryana" },
  { key: "HP", name: "Himachal Pradesh" }, { key: "JH", name: "Jharkhand" },
  { key: "KA", name: "Karnataka" }, { key: "KL", name: "Kerala" },
  { key: "MP", name: "Madhya Pradesh" }, { key: "MH", name: "Maharashtra" },
  { key: "MN", name: "Manipur" }, { key: "ML", name: "Meghalaya" },
  { key: "MZ", name: "Mizoram" }, { key: "NL", name: "Nagaland" },
  { key: "OD", name: "Odisha" }, { key: "PB", name: "Punjab" },
  { key: "RJ", name: "Rajasthan" }, { key: "SK", name: "Sikkim" },
  { key: "TN", name: "Tamil Nadu" }, { key: "TS", name: "Telangana" },
  { key: "TR", name: "Tripura" }, { key: "UP", name: "Uttar Pradesh" },
  { key: "UK", name: "Uttarakhand" }, { key: "WB", name: "West Bengal" },
  { key: "DL", name: "Delhi" }, { key: "JK", name: "Jammu & Kashmir" },
  { key: "LA", name: "Ladakh" }, { key: "CH", name: "Chandigarh" },
  { key: "DN", name: "Dadra & Nagar Haveli and Daman & Diu" },
  { key: "LD", name: "Lakshadweep" }, { key: "AN", name: "Andaman & Nicobar Islands" },
  { key: "PY", name: "Puducherry" },
]

const ENTITIES = ["WIBRO", "GTEL", "GISPL"]
const AMOUNT_TYPES = [
  { value: 'receivedDetails', label: 'Received', fullLabel: 'Received Details', color: 'emerald', bg: 'bg-emerald-500' },
  { value: 'tdsProvision', label: 'TDS Provision', fullLabel: 'TDS Provision', color: 'amber', bg: 'bg-amber-500' },
  { value: 'tdsConfirm', label: 'TDS Confirm', fullLabel: 'TDS Confirm', color: 'violet', bg: 'bg-violet-500' },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Wallet, color: 'emerald' },
  { value: 'cheque', label: 'Cheque', icon: CreditCard, color: 'blue' },
  { value: 'neft', label: 'NEFT', icon: Building, color: 'violet' },
  { value: 'upi', label: 'UPI', icon: Smartphone, color: 'orange' },
]

const ALL_MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"]
const DIST_MODES = [
  { value: 'auto', label: 'Auto Split', icon: Zap, desc: 'Month-by-month chronological fill — all orders for each month before moving to next' },
  { value: 'manual', label: 'Manual', icon: PenLine, desc: 'Enter amounts manually' },
]

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (n) => (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const todayISO = () => new Date().toISOString().split('T')[0]
const toDisplayDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}` }
const todayDDMMYYYY = () => { const n = new Date(); return `${String(n.getDate()).padStart(2, '0')}-${String(n.getMonth() + 1).padStart(2, '0')}-${n.getFullYear()}` }
const monthOptions = () => {
  const now = new Date(), res = []
  for (let i = 0; i < 24; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); res.push({ value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, label: `${ALL_MONTHS[d.getMonth()]} ${d.getFullYear()}` }) }
  return res
}
const fmtMonthYear = (m, y) => `${ALL_MONTHS[m]} ${y}`
const getDaysInMonth = (m, y) => new Date(y, m + 1, 0).getDate()
const parseAnyDate = (s) => {
  if (!s) return null; if (s instanceof Date) return s
  if (s.includes('T') || s.includes('Z')) { const d = new Date(s); return isNaN(d) ? null : d }
  const p = s.split('-'); if (p.length !== 3) return null
  const [dd, mm, yyyy] = p.map(Number); if (!dd || !mm || !yyyy) return null
  return new Date(yyyy, mm - 1, dd)
}
const sumAmount = (arr) => (!arr?.length) ? 0 : arr.reduce((s, i) => s + (Number(i.amount) || 0), 0)
const sumTotalWithGst = (arr) => (!arr?.length) ? 0 : arr.reduce((s, i) => s + (Number(i.totalWithGst) || Number(i.amount) || 0), 0)
const isSplitOrder = (order) => {
  const s1 = order.billing1?.state || '', s2 = order.billing2?.state || ''
  return order.product === 'NLD' && s1 !== s2 && s2 !== ''
}
const expandOrdersToRows = (orders) => {
  const rows = []
  orders.forEach(order => {
    if (isSplitOrder(order)) {
      const s1 = order.billing1?.state || '', s2 = order.billing2?.state || ''
      const pct1 = Number(order.splitFactor?.state1Percentage) || 50
      const pct2 = Number(order.splitFactor?.state2Percentage) || 50
      rows.push({ order, state: s1, splitPct: pct1, rowKey: `${order.orderId}-${s1}`, isSplit: true })
      rows.push({ order, state: s2, splitPct: pct2, rowKey: `${order.orderId}-${s2}`, isSplit: true })
    } else {
      const state = order.billing1?.state || order.billing2?.state || '-'
      rows.push({ order, state, splitPct: 100, rowKey: `${order.orderId}-${state}`, isSplit: false })
    }
  })
  return rows
}
const billingMonthFromDate = (dateISO) => { if (!dateISO) return monthOptions()[0].value; const [y, m] = dateISO.split('-'); return `${y}-${m}-01` }
const buildPoint1 = (dateISO, amount) => {
  const d = toDisplayDate(dateISO) || '--'
  const a = amount && !isNaN(Number(amount)) && Number(amount) > 0 ? `₹${Number(amount).toLocaleString('en-IN')}` : '₹--'
  return `1. Payment Date: ${d}, Total Amount: ${a}`
}

// ─── Load monthly breakdown ───────────────────────────────────
const loadMonthlyDataForRow = async (order, state, toDateStr) => {
  const pcdDate = parseAnyDate(order.pcdDate)
  const termDate = order.terminateDate ? parseAnyDate(order.terminateDate) : null
  const toDate = parseAnyDate(toDateStr)
  if (!pcdDate || !toDate) return { balance: 0, months: [] }

  let billingData = []
  try {
    const r = await fetch(`/api/billing/monthly?orderId=${order.orderId}`)
    const j = await r.json()
    if (j.success) billingData = j.data
  } catch (e) { console.error('[loadMonthlyDataForRow]', e); return { balance: 0, months: [] } }

  let serviceEnd = toDate
  if (termDate) {
    const lastDay = new Date(termDate); lastDay.setDate(lastDay.getDate() - 1)
    serviceEnd = lastDay < toDate ? lastDay : toDate
    if (serviceEnd < pcdDate) return { balance: 0, months: [] }
  }

  const months = []
  let cur = new Date(pcdDate.getFullYear(), pcdDate.getMonth(), 1)

  while (cur <= serviceEnd && cur <= toDate) {
    const m = cur.getMonth(), y = cur.getFullYear()
    const monthName = fmtMonthYear(m, y)
    const rec = billingData.find(b => b.month === monthName && b.state === state)

    let totalWithGst = 0, monthlyBilling = 0, cgst = 0, sgst = 0, igst = 0,
      miscSell = 0, received = 0, creditNotes = 0, tdsProvision = 0, tdsConfirm = 0,
      billingDays = getDaysInMonth(m, y), startDay = 1, endDay = getDaysInMonth(m, y),
      invoiceNumber = '-', invoiceDate = '-', isSelfGST = false,
      rawData = { miscellaneousSell: [], receivedDetails: [], creditNotes: [], tdsConfirm: [], tdsProvision: [] }

    if (rec) {
      totalWithGst   = Number(rec.totalWithGst)   || 0
      monthlyBilling = Number(rec.monthlyBilling)  || 0
      cgst           = Number(rec.cgst)            || 0
      sgst           = Number(rec.sgst)            || 0
      igst           = Number(rec.igst)            || 0
      isSelfGST      = rec.isSelfGST               || false
      miscSell       = sumTotalWithGst(rec.miscellaneousSell)
      received       = sumAmount(rec.receivedDetails)
      creditNotes    = sumTotalWithGst(rec.creditNotes)
      tdsProvision   = sumAmount(rec.tdsProvision)
      tdsConfirm     = sumAmount(rec.tdsConfirm)
      invoiceNumber  = rec.invoiceNumber           || '-'
      invoiceDate    = rec.invoiceDate             || '-'
      billingDays    = rec.billingDays             || getDaysInMonth(m, y)
      startDay       = Number((rec.startDate || '').split('-')[0]) || 1
      endDay         = Number((rec.endDate   || '').split('-')[0]) || getDaysInMonth(m, y)
      rawData = {
        miscellaneousSell: rec.miscellaneousSell || [],
        receivedDetails:   rec.receivedDetails   || [],
        creditNotes:       rec.creditNotes       || [],
        tdsConfirm:        rec.tdsConfirm        || [],
        tdsProvision:      rec.tdsProvision      || [],
      }
    } else {
      const daysInM = getDaysInMonth(m, y)
      const isPcd   = y === pcdDate.getFullYear() && m === pcdDate.getMonth()
      const isTerm  = termDate && y === serviceEnd.getFullYear() && m === serviceEnd.getMonth()
      let splitPct  = 1
      if (isSplitOrder(order)) {
        splitPct = state === (order.billing1?.state || '')
          ? (Number(order.splitFactor?.state1Percentage) || 50) / 100
          : (Number(order.splitFactor?.state2Percentage) || 50) / 100
      }
      const cap = Number(order.capacity) || 0, rate = Number(order.amount) || 0
      const baseMonthly = cap * rate * splitPct
      startDay       = isPcd  ? pcdDate.getDate()    : 1
      endDay         = isTerm ? serviceEnd.getDate() : daysInM
      billingDays    = endDay - startDay + 1
      totalWithGst   = (baseMonthly * 1.18 / daysInM) * billingDays
      monthlyBilling = totalWithGst / 1.18
      igst           = totalWithGst - monthlyBilling
    }

    const netCharges = (totalWithGst + miscSell) - (received + creditNotes + tdsConfirm)
    months.push({
      monthYear: monthName, month: m, year: y, billingDays, startDay, endDay,
      monthlyBilling, cgst, sgst, igst, totalWithGst, miscSell, received, creditNotes,
      tdsProvision, tdsConfirm, invoiceNumber, invoiceDate, isSelfGST, netCharges, rawData
    })

    if (termDate && cur.getFullYear() === serviceEnd.getFullYear() && cur.getMonth() === serviceEnd.getMonth()) break
    cur = new Date(y, m + 1, 1)
  }

  let running = 0
  const monthsWithRunning = months.map(md => { running += md.netCharges; return { ...md, runningBalance: running } })
  return { balance: running, months: monthsWithRunning }
}

// ─── Helper: compute remAdj per month ─────────────────────────
const computeRemAdjPerMonth = (monthlyData) => {
  const sorted = [...monthlyData].sort((a, b) => new Date(a.year, a.month) - new Date(b.year, b.month))
  const existingPool = sorted.reduce((s, m) => s + m.received + m.creditNotes + m.tdsConfirm, 0)
  let pool = existingPool
  const result = []
  for (const m of sorted) {
    const charges = m.totalWithGst + m.miscSell
    let remAdj = 0
    if (pool >= charges) { pool -= charges; remAdj = 0 }
    else { remAdj = charges - pool; pool = 0 }
    result.push({ year: m.year, month: m.month, monthYear: m.monthYear, remAdj })
  }
  console.log(`[computeRemAdjPerMonth] Pool started at ₹${fmt(existingPool)}, per-month remAdj:`,
    result.map(r => `${r.monthYear}=₹${fmt(r.remAdj)}`).join(', '))
  return result
}

// ─── Auto-Split Algorithm ─────────────────────────────────────
const computeAutoSplitAmounts = (rows, totalAmount) => {
  const toPaise = (n) => Math.round(n * 100)
  const fromPaise = (p) => Math.round(p) / 100

  const checkedRows = rows.filter(r => {
    if (!r.checked || !r.monthlyData?.length || r.balanceLoading) return false
    return toPaise(r.balance || 0) > 0
  })

  // Initialize outputs for ALL checked rows (even zero-balance ones)
  const allocated = {}
  const monthlyAdjustments = {}
  rows.filter(r => r.checked).forEach(r => {
    allocated[r.rowKey] = 0
    monthlyAdjustments[r.rowKey] = []
  })

  if (!checkedRows.length) {
    console.log('[AutoSplit] No eligible checked rows found')
    return { allocated, monthlyAdjustments }
  }

  const rowRemAdj = {}
  checkedRows.forEach(r => { rowRemAdj[r.rowKey] = computeRemAdjPerMonth(r.monthlyData) })

  // Build a fast lookup: rowKey → { "YYYY-MM" → monthData }
  const rowMonthLookup = {}
  checkedRows.forEach(r => {
    rowMonthLookup[r.rowKey] = {}
    r.monthlyData.forEach(md => {
      const key = `${md.year}-${String(md.month + 1).padStart(2, '0')}`
      rowMonthLookup[r.rowKey][key] = md
    })
  })

  const allMonthKeys = new Set()
  checkedRows.forEach(r => {
    r.monthlyData.forEach(md => {
      allMonthKeys.add(`${md.year}-${String(md.month + 1).padStart(2, '0')}`)
    })
  })
  const sortedMonths = [...allMonthKeys].sort()

  console.log('[AutoSplit] ── Starting auto-split ──')
  console.log('[AutoSplit] Total amount: ₹' + totalAmount)
  console.log('[AutoSplit] Eligible rows:', checkedRows.map(r => r.rowKey))
  console.log('[AutoSplit] All months (chronological):', sortedMonths)

  const allocatedPaise = {}
  checkedRows.forEach(r => { allocatedPaise[r.rowKey] = 0 })

  let remainingPaise = toPaise(totalAmount)

  for (const monthKey of sortedMonths) {
    if (remainingPaise <= 0) {
      console.log('[AutoSplit] Budget exhausted at month:', monthKey)
      break
    }

    const [y, m] = monthKey.split('-').map(Number)
    const monthIdx = m - 1

    const monthItems = checkedRows
      .map(r => {
        const remAdjEntry = rowRemAdj[r.rowKey].find(e => e.year === y && e.month === monthIdx)
        const remAdjPaise = remAdjEntry ? Math.max(0, toPaise(remAdjEntry.remAdj)) : 0
        const md = rowMonthLookup[r.rowKey][monthKey] || {}
        return {
          rowKey:        r.rowKey,
          orderId:       r.orderId,
          remAdjPaise,
           totalChargesPaise:  toPaise((md.totalWithGst || 0) + (md.miscSell || 0)),  // ADD THI
          monthYear:     remAdjEntry?.monthYear || monthKey,
          invoiceNumber: md.invoiceNumber || '-',
          invoiceDate:   md.invoiceDate   || '-',
        }
      })
      .filter(x => x.remAdjPaise > 0)

    if (!monthItems.length) {
      console.log(`[AutoSplit] Month ${monthKey}: remAdj=0 for ALL rows — SKIP`)
      continue
    }

    const totalNeededPaise = monthItems.reduce((s, x) => s + x.remAdjPaise, 0)

    console.log(`[AutoSplit] Month ${monthKey}: ${monthItems.length} rows need payment`)
    console.log(`  Rows: ${monthItems.map(x => `${x.rowKey}=₹${fromPaise(x.remAdjPaise)}`).join(', ')}`)
    console.log(`  Total needed: ₹${fromPaise(totalNeededPaise)}, Budget remaining: ₹${fromPaise(remainingPaise)}`)

    if (remainingPaise >= totalNeededPaise) {
      // ── Full month: every row gets paid completely ────────────
      monthItems.forEach(({ rowKey, remAdjPaise,totalChargesPaise, monthYear, invoiceNumber, invoiceDate }) => {
        allocatedPaise[rowKey] += remAdjPaise
        monthlyAdjustments[rowKey].push({
          month:           monthYear,
          invoiceNumber,
          invoiceDate,
          monthlyAmount:   fromPaise(totalChargesPaise),  
          adjustedAmount:  fromPaise(remAdjPaise),
          remainingAmount: 0,
          amountStatus:    'Fully Paid',
        })
        console.log(`  ✅ ${rowKey}: fully paid ₹${fromPaise(remAdjPaise)} for ${monthKey}`)
      })
      remainingPaise -= totalNeededPaise
      console.log(`  Month ${monthKey} done. Budget left: ₹${fromPaise(remainingPaise)}`)
    } else {
      // ── Partial month: fill row-by-row in Order ID ascending order ──
      const sorted = [...monthItems].sort((a, b) => a.orderId.localeCompare(b.orderId))
      console.log(`  ⚡ PARTIAL month ${monthKey} — filling by Order ID asc:`,
        sorted.map(x => `${x.rowKey}=₹${fromPaise(x.remAdjPaise)}`))

      for (const { rowKey, remAdjPaise, totalChargesPaise,monthYear, invoiceNumber, invoiceDate } of sorted) {
        if (remainingPaise <= 0) {
          // This row gets nothing for this month
          monthlyAdjustments[rowKey].push({
            month:           monthYear,
            invoiceNumber,
            invoiceDate,
             monthlyAmount:   fromPaise(totalChargesPaise), 
            adjustedAmount:  0,
            remainingAmount: fromPaise(remAdjPaise),
            amountStatus:    'Not Paid',
          })
          console.log(`  ⚡ ${rowKey}: ₹0 (budget exhausted) for ${monthKey}`)
          continue
        }

        const cover     = Math.min(remAdjPaise, remainingPaise)
        const remaining = remAdjPaise - cover

        allocatedPaise[rowKey] += cover
        remainingPaise -= cover

        monthlyAdjustments[rowKey].push({
          month:           monthYear,
          invoiceNumber,
          invoiceDate,
            monthlyAmount:   fromPaise(totalChargesPaise),   // ADD THIS
          adjustedAmount:  fromPaise(cover),
          remainingAmount: fromPaise(remaining),
          amountStatus:    cover >= remAdjPaise ? 'Fully Paid' : 'Partially Paid',
        })
        console.log(`  ⚡ ${rowKey}: paid ₹${fromPaise(cover)} of ₹${fromPaise(remAdjPaise)} (rem ₹${fromPaise(remaining)}) for ${monthKey}`)
      }
      break
    }
  }

  // ── Leftover rounding cents: tack onto last row's last adjustment ──
  if (remainingPaise > 0) {
    const lastRow = checkedRows.slice().reverse().find(r => allocatedPaise[r.rowKey] > 0)
      || checkedRows[checkedRows.length - 1]
    if (lastRow) {
      allocatedPaise[lastRow.rowKey] += remainingPaise
      const adjs = monthlyAdjustments[lastRow.rowKey]
      if (adjs.length > 0) {
        const last = adjs[adjs.length - 1]
        last.adjustedAmount  = Math.round((last.adjustedAmount  + fromPaise(remainingPaise)) * 100) / 100
        last.remainingAmount = Math.max(0, Math.round((last.remainingAmount - fromPaise(remainingPaise)) * 100) / 100)
        if (last.remainingAmount <= 0.005) { last.remainingAmount = 0; last.amountStatus = 'Fully Paid' }
      }
      console.log(`[AutoSplit] Leftover ₹${fromPaise(remainingPaise)} assigned to: ${lastRow.rowKey}`)
    }
  }

  Object.entries(allocatedPaise).forEach(([k, v]) => { allocated[k] = fromPaise(v) })

  console.log('[AutoSplit] ── Final allocation ──')
  console.log(Object.entries(allocated).map(([k, v]) => `  ${k}: ₹${fmt(v)}`).join('\n'))
  console.log('[AutoSplit] ── Monthly adjustments ──')
  Object.entries(monthlyAdjustments).forEach(([k, adjs]) => {
    if (adjs.length) console.log(`  ${k}:`, adjs.map(a => `${a.month}=₹${fmt(a.adjustedAmount)}(${a.amountStatus})`).join(', '))
  })

  return { allocated, monthlyAdjustments }
}

// ─── Array Details Sub-Popup ───────────────────────────────────
const ArrayDetailsPopup = React.memo(({ data, title, onClose }) => {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 bg-black/60 z-[10004] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10 rounded-t-xl">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5 text-white" /></button>
        </div>
        <div className="p-6">
          {(!data || data.length === 0) ? <p className="text-center text-slate-400 py-8">No data available</p> : (
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">Amount</th>
                  {data[0]?.cgst !== undefined && <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">CGST</th>}
                  {data[0]?.sgst !== undefined && <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">SGST</th>}
                  {data[0]?.igst !== undefined && <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">IGST</th>}
                  {data[0]?.totalWithGst !== undefined && <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase">Basic+GST</th>}
                  {data[0]?.periodStart !== undefined && <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Period</th>}
                  {data[0]?.invoiceNumber !== undefined && <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Invoice No.</th>}
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3 text-sm text-slate-800 font-semibold">{item.date || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-bold text-right">₹{fmt(item.amount || 0)}</td>
                    {data[0]?.cgst !== undefined && <td className="px-4 py-3 text-sm text-right">₹{fmt(item.cgst || 0)}</td>}
                    {data[0]?.sgst !== undefined && <td className="px-4 py-3 text-sm text-right">₹{fmt(item.sgst || 0)}</td>}
                    {data[0]?.igst !== undefined && <td className="px-4 py-3 text-sm text-right">₹{fmt(item.igst || 0)}</td>}
                    {data[0]?.totalWithGst !== undefined && <td className="px-4 py-3 text-sm text-indigo-700 font-bold text-right">₹{fmt(item.totalWithGst || 0)}</td>}
                    {data[0]?.periodStart !== undefined && <td className="px-4 py-3 text-sm">{item.periodStart && item.periodEnd ? `${item.periodStart} to ${item.periodEnd}` : '-'}</td>}
                    {data[0]?.invoiceNumber !== undefined && <td className="px-4 py-3 text-sm font-medium">{item.invoiceNumber || '-'}</td>}
                    <td className="px-4 py-3 text-sm text-slate-600">{item.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr className="font-bold">
                  <td className="px-4 py-3 text-sm">TOTAL</td>
                  <td className="px-4 py-3 text-sm text-right">₹{fmt(data.reduce((s, i) => s + (Number(i.amount) || 0), 0))}</td>
                  {data[0]?.cgst !== undefined && <td className="px-4 py-3 text-sm text-right">₹{fmt(data.reduce((s, i) => s + (Number(i.cgst) || 0), 0))}</td>}
                  {data[0]?.sgst !== undefined && <td className="px-4 py-3 text-sm text-right">₹{fmt(data.reduce((s, i) => s + (Number(i.sgst) || 0), 0))}</td>}
                  {data[0]?.igst !== undefined && <td className="px-4 py-3 text-sm text-right">₹{fmt(data.reduce((s, i) => s + (Number(i.igst) || 0), 0))}</td>}
                  {data[0]?.totalWithGst !== undefined && <td className="px-4 py-3 text-sm text-indigo-700 text-right">₹{fmt(data.reduce((s, i) => s + (Number(i.totalWithGst) || Number(i.amount) || 0), 0))}</td>}
                  {data[0]?.periodStart !== undefined && <td className="px-4 py-3" />}
                  {data[0]?.invoiceNumber !== undefined && <td className="px-4 py-3" />}
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
})
ArrayDetailsPopup.displayName = 'ArrayDetailsPopup'

// ─── Month Detail View ─────────────────────────────────────────
const MonthDetailView = ({ monthData, rawData, onClose }) => {
  const [detailsPopup, setDetailsPopup] = useState(null)
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h)
  }, [onClose])
  if (!monthData) return null
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[10003] flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
            <div>
              <h3 className="text-xl font-bold text-white">Month Details</h3>
              <p className="text-blue-100 text-sm mt-0.5">{monthData.monthYear}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5 text-white" /></button>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Billing Days', val: monthData.billingDays, big: true },
                { label: 'Start Date', val: `${String(monthData.startDay).padStart(2, '0')}-${String(monthData.month + 1).padStart(2, '0')}-${monthData.year}` },
                { label: 'End Date', val: `${String(monthData.endDay).padStart(2, '0')}-${String(monthData.month + 1).padStart(2, '0')}-${monthData.year}` },
              ].map(({ label, val, big }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-1">{label}</p>
                  <p className={`font-bold text-slate-900 ${big ? 'text-2xl' : 'text-lg'}`}>{val}</p>
                </div>
              ))}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-200">Billing Amounts</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded">
                  <span className="text-sm text-slate-600">Monthly Basic Bill:</span>
                  <span className="text-sm font-bold">₹{fmt(monthData.monthlyBilling)}</span>
                </div>
                {monthData.cgst > 0 && <div className="flex justify-between py-2 px-3 bg-slate-50 rounded"><span className="text-sm text-slate-600">CGST (9%):</span><span className="text-sm font-bold">₹{fmt(monthData.cgst)}</span></div>}
                {monthData.sgst > 0 && <div className="flex justify-between py-2 px-3 bg-slate-50 rounded"><span className="text-sm text-slate-600">SGST (9%):</span><span className="text-sm font-bold">₹{fmt(monthData.sgst)}</span></div>}
                {monthData.igst > 0 && <div className="flex justify-between py-2 px-3 bg-slate-50 rounded"><span className="text-sm text-slate-600">IGST (18%):</span><span className="text-sm font-bold">₹{fmt(monthData.igst)}</span></div>}
                <div className="flex justify-between items-center py-2 px-3 bg-indigo-50 rounded border-2 border-indigo-200">
                  <span className="text-sm font-bold text-indigo-700">Basic + GST:</span>
                  <span className="text-sm font-bold text-indigo-900">₹{fmt(monthData.totalWithGst)}</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-purple-50 rounded">
                  <span className="text-sm text-purple-600">Misc+GST Sell:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-purple-900">₹{fmt(monthData.miscSell)}</span>
                    {rawData?.miscellaneousSell?.length > 0 && <button onClick={() => setDetailsPopup({ data: rawData.miscellaneousSell, title: 'Miscellaneous Sell Details' })} className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium">View</button>}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-200">Payments & Adjustments</h4>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Received',      val: monthData.received,     color: 'green',  key: 'receivedDetails', title: 'Payment Received Details' },
                  { label: 'Credit Notes',  val: monthData.creditNotes,  color: 'cyan',   key: 'creditNotes',     title: 'Credit Notes Details' },
                  { label: 'TDS Confirm',   val: monthData.tdsConfirm,   color: 'blue',   key: 'tdsConfirm',      title: 'TDS Confirm Details' },
                  { label: 'TDS Provision', val: monthData.tdsProvision, color: 'orange', key: 'tdsProvision',    title: 'TDS Provision Details' },
                ].map(({ label, val, color, key, title }) => (
                  <div key={key} className={`flex justify-between items-center py-2 px-3 bg-${color}-50 rounded`}>
                    <span className={`text-sm text-${color}-600`}>{label}:</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold text-${color}-900`}>₹{fmt(val)}</span>
                      {rawData?.[key]?.length > 0 && <button onClick={() => setDetailsPopup({ data: rawData[key], title })} className={`text-xs px-2 py-1 bg-${color}-600 hover:bg-${color}-700 text-white rounded font-medium`}>View</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-700 uppercase mb-3 pb-2 border-b border-slate-200">Balance Summary</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between items-center py-3 px-4 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                  <span className="text-sm font-bold text-yellow-700">Running Balance:</span>
                  <span className={`text-lg font-extrabold ${(monthData.runningBalance || 0) >= 0 ? 'text-red-700' : 'text-green-700'}`}>₹{fmt(monthData.runningBalance || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-3 px-4 bg-rose-50 rounded-lg border-2 border-rose-200">
                  <span className="text-sm font-bold text-rose-700">Remaining Adj:</span>
                  <span className={`text-lg font-extrabold ${(monthData.remAdj || 0) > 0 ? 'text-red-700' : 'text-green-700'}`}>₹{fmt(monthData.remAdj || 0)}</span>
                </div>
              </div>
            </div>
            {((monthData.invoiceNumber && monthData.invoiceNumber !== '-') ||
              (monthData.invoiceDate && monthData.invoiceDate !== '-')) && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-blue-600 uppercase mb-1">Invoice Number</p>
                  <p className="text-base font-bold text-blue-900">{monthData.invoiceNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-600 uppercase mb-1">Invoice Date</p>
                  <p className="text-base font-bold text-blue-900">{monthData.invoiceDate || '-'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {detailsPopup && <ArrayDetailsPopup data={detailsPopup.data} title={detailsPopup.title} onClose={() => setDetailsPopup(null)} />}
    </>
  )
}

// ─── Monthly Breakdown Popup ───────────────────────────────────
const MonthlyBreakdownPopup = React.memo(({ rowInfo, onClose }) => {
  const { orderId, state, companyName, months, balance, order, allocatedAmount } = rowInfo
  const [viewingMonth, setViewingMonth] = useState(null)

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const sorted = useMemo(() => [...months].sort((a, b) => new Date(a.year, a.month) - new Date(b.year, b.month)), [months])
  const hasCGST = sorted.some(m => (m.cgst || 0) > 0)
  const hasSGST = sorted.some(m => (m.sgst || 0) > 0)
  const hasIGST = sorted.some(m => (m.igst || 0) > 0)

  const rows = useMemo(() => {
    const existingPool = sorted.reduce((s, m) => s + m.received + m.creditNotes + m.tdsConfirm, 0)
    const pendingPayment = Number(allocatedAmount) || 0
    const totalPool = existingPool + pendingPayment
    console.log(`[MonthlyBreakdownPopup] orderId=${orderId} state=${state}`)
    console.log(`  existingPool=₹${fmt(existingPool)}, pendingPayment=₹${fmt(pendingPayment)}, totalPool=₹${fmt(totalPool)}`)
    let pool = totalPool, running = 0, cumUnpaid = 0
    return sorted.map(m => {
      const charges = m.totalWithGst + m.miscSell
      const credits  = m.received + m.creditNotes + m.tdsConfirm
      running += charges - credits
      let remAdj = 0
      if (pool >= charges) { pool -= charges; remAdj = 0; cumUnpaid = 0 }
      else { const uncovered = charges - pool; pool = 0; cumUnpaid += uncovered; remAdj = cumUnpaid }
      console.log(`  Month ${m.monthYear}: charges=₹${fmt(charges)}, pool after=₹${fmt(pool)}, remAdj=₹${fmt(remAdj)}`)
      return { ...m, running, remAdj }
    })
  }, [sorted, allocatedAmount, orderId, state])

  const T = rows.reduce((a, m) => ({
    mb:   a.mb   + m.monthlyBilling,
    cgst: a.cgst + (m.cgst || 0),
    sgst: a.sgst + (m.sgst || 0),
    igst: a.igst + (m.igst || 0),
    total: a.total + m.totalWithGst,
    misc:  a.misc  + m.miscSell,
    recv:  a.recv  + m.received,
    cn:    a.cn    + m.creditNotes,
    tdsc:  a.tdsc  + m.tdsConfirm,
    tdsp:  a.tdsp  + m.tdsProvision,
  }), { mb: 0, cgst: 0, sgst: 0, igst: 0, total: 0, misc: 0, recv: 0, cn: 0, tdsc: 0, tdsp: 0 })

  const capacity = order?.capacity || 0
  const baseRate  = order?.amount   || 0
  const isSplit   = order ? isSplitOrder(order) : false

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[10002] flex items-center justify-center p-2" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-h-[95vh] overflow-hidden flex flex-col" style={{ maxWidth: '1750px' }} onClick={e => e.stopPropagation()}>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-6">
              <div>
                <h2 className="text-xl font-bold text-white">Monthly Billing Breakdown</h2>
                <p className="text-blue-100 text-sm mt-0.5">
                  Order: <b className="text-white">{orderId}</b> — State: <b className="text-white">{state}</b>
                  {companyName && <> — <span className="text-blue-200">{companyName}</span></>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { label: 'Capacity', val: `${capacity} Mbps` },
                  { label: 'Base Rate', val: `₹${baseRate}` },
                  { label: 'Split', val: isSplit ? 'Yes' : 'No' },
                  ...(Number(allocatedAmount) > 0 ? [{ label: 'New Payment', val: `₹${fmt(Number(allocatedAmount))}` }] : []),
                ].map(({ label, val }) => (
                  <div key={label} className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                    <p className="text-[10px] font-bold text-blue-100 uppercase">{label}</p>
                    <p className="text-sm font-bold text-white">{val}</p>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium text-sm transition-all">
              <X className="w-4 h-4" />Close
            </button>
          </div>
          <div className="overflow-auto flex-1">
            {rows.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No monthly data available</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
                    <th className="px-3 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Month</th>
                    <th className="px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Days</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Period</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Invoice No</th>
                    <th className="px-3 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Invoice Date</th>
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
                    <th className="px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider bg-green-50">
                      Remaining Adj
                      {Number(allocatedAmount) > 0 && <span className="ml-1 text-[9px] font-black text-emerald-600 bg-emerald-100 px-1 py-0.5 rounded">+₹{fmt(Number(allocatedAmount))}</span>}
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((m, i) => (
                    <tr key={i} className={`transition-all ${i % 2 === 0 ? 'bg-white hover:bg-blue-50/50' : 'bg-gray-50/50 hover:bg-blue-50/50'}`}>
                      <td className="px-3 py-3 font-semibold text-slate-900 whitespace-nowrap">{m.monthYear}</td>
                      <td className="px-3 py-3 text-center font-bold text-slate-700">{m.billingDays}</td>
                      <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                        <div>{String(m.startDay).padStart(2, '0')}-{String(m.month + 1).padStart(2, '0')}-{m.year}</div>
                        <div>{String(m.endDay).padStart(2, '0')}-{String(m.month + 1).padStart(2, '0')}-{m.year}</div>
                      </td>
                      <td className="px-3 py-3 text-xs font-medium whitespace-nowrap">
                        {m.invoiceNumber && m.invoiceNumber !== '-' ? <span className="text-blue-700">{m.invoiceNumber}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs font-medium whitespace-nowrap">
                        {m.invoiceDate && m.invoiceDate !== '-' ? <span className="text-blue-600">{m.invoiceDate}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-800">₹{fmt(m.monthlyBilling)}</td>
                      {hasCGST && <td className="px-3 py-3 text-right text-slate-600">₹{fmt(m.cgst || 0)}</td>}
                      {hasSGST && <td className="px-3 py-3 text-right text-slate-600">₹{fmt(m.sgst || 0)}</td>}
                      {hasIGST && <td className="px-3 py-3 text-right text-slate-600">₹{fmt(m.igst || 0)}</td>}
                      <td className="px-3 py-3 text-right font-bold text-indigo-700">₹{fmt(m.totalWithGst)}</td>
                      <td className="px-3 py-3 text-right font-bold text-purple-600">₹{fmt(m.miscSell)}</td>
                      <td className="px-3 py-3 text-right font-bold text-green-600">₹{fmt(m.received)}</td>
                      <td className="px-3 py-3 text-right font-bold text-cyan-600">₹{fmt(m.creditNotes)}</td>
                      <td className="px-3 py-3 text-right font-bold text-blue-600">₹{fmt(m.tdsConfirm)}</td>
                      <td className="px-3 py-3 text-right font-bold text-orange-500">₹{fmt(m.tdsProvision)}</td>
                      <td className={`px-3 py-3 text-right font-extrabold bg-yellow-50 ${m.running >= 0 ? 'text-red-700' : 'text-green-700'}`}>₹{fmt(m.running)}</td>
                      <td className="px-3 py-3 text-center font-bold bg-green-50">
                        {m.remAdj > 0.005
                          ? <span className="inline-flex items-center gap-1 text-red-700"><X className="w-4 h-4" />₹{fmt(m.remAdj)}</span>
                          : <span className="text-emerald-700 flex items-center justify-center gap-1"><CheckCircle2 className="w-4 h-4" />₹{fmt(0)}</span>
                        }
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center">
                          <button onClick={() => setViewingMonth(m)} className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors" title="View Details">
                            <Eye className="w-4 h-4 text-blue-700" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-gray-100 to-blue-100 border-t-2 border-gray-300 font-bold">
                    <td colSpan="5" className="px-3 py-4 text-sm text-gray-900">TOTAL</td>
                    <td className="px-3 py-4 text-right text-sm text-slate-900">₹{fmt(T.mb)}</td>
                    {hasCGST && <td className="px-3 py-4 text-right text-sm text-gray-700">₹{fmt(T.cgst)}</td>}
                    {hasSGST && <td className="px-3 py-4 text-right text-sm text-gray-700">₹{fmt(T.sgst)}</td>}
                    {hasIGST && <td className="px-3 py-4 text-right text-sm text-gray-700">₹{fmt(T.igst)}</td>}
                    <td className="px-3 py-4 text-right text-sm text-indigo-700">₹{fmt(T.total)}</td>
                    <td className="px-3 py-4 text-right text-sm text-purple-700">₹{fmt(T.misc)}</td>
                    <td className="px-3 py-4 text-right text-sm text-green-700">₹{fmt(T.recv)}</td>
                    <td className="px-3 py-4 text-right text-sm text-cyan-700">₹{fmt(T.cn)}</td>
                    <td className="px-3 py-4 text-right text-sm text-blue-700">₹{fmt(T.tdsc)}</td>
                    <td className="px-3 py-4 text-right text-sm text-orange-500">₹{fmt(T.tdsp)}</td>
                    <td className={`px-3 py-4 text-right text-lg font-extrabold bg-yellow-100 ${rows[rows.length - 1]?.running >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                      ₹{fmt(rows[rows.length - 1]?.running || 0)}
                    </td>
                    <td className="px-3 py-4 bg-green-100" colSpan="2" />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
      {viewingMonth && <MonthDetailView monthData={viewingMonth} rawData={viewingMonth.rawData} onClose={() => setViewingMonth(null)} />}
    </>
  )
})
MonthlyBreakdownPopup.displayName = 'MonthlyBreakdownPopup'

// ─── Searchable Dropdown ──────────────────────────────────────
const SearchableDropdown = ({ options, value, onChange, placeholder, className = '' }) => {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const filtered = useMemo(() => options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())), [options, query])
  const selected = options.find(o => o.value === value)
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => { setOpen(v => !v); setQuery('') }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all">
        <span className={selected ? 'text-slate-800 font-medium' : 'text-slate-400'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {value && <button onClick={() => { onChange(''); setOpen(false) }} className="w-full px-3 py-2 text-left text-sm text-rose-500 hover:bg-rose-50 flex items-center gap-2 border-b border-slate-100"><X className="w-3.5 h-3.5" />Clear</button>}
            {filtered.length === 0 ? <p className="px-3 py-4 text-sm text-slate-400 text-center">No results</p>
              : filtered.map(o => (
                <button key={o.value} onClick={() => { onChange(o.value); setOpen(false) }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-violet-50 ${value === o.value ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-slate-700'}`}>
                  {o.label}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Company Group Dropdown ───────────────────────────────────
const CompanyGroupDropdown = ({ groups, selectedGroup, onSelect }) => {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const filtered = useMemo(() => groups.filter(g => g.groupName.toLowerCase().includes(query.toLowerCase()) || g.companies.some(c => c.toLowerCase().includes(query.toLowerCase()))), [groups, query])
  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => { setOpen(v => !v); setQuery('') }}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white hover:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-violet-500 flex-shrink-0" />
          {selectedGroup
            ? <span className="text-slate-800 font-semibold truncate">{selectedGroup.groupName}<span className="ml-2 text-xs font-normal text-slate-400">({selectedGroup.orderCount})</span></span>
            : <span className="text-slate-400 font-normal">Select company group…</span>}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search company or group…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '16rem', minHeight: filtered.length >= 5 ? '16rem' : `${Math.max(filtered.length, 1) * 52 + (selectedGroup ? 40 : 0)}px` }}>
            {selectedGroup && <button onClick={() => { onSelect(null); setOpen(false) }} className="w-full px-4 py-2.5 text-left text-sm text-rose-500 hover:bg-rose-50 flex items-center gap-2 border-b border-slate-100"><X className="w-3.5 h-3.5" />Clear selection</button>}
            {filtered.length === 0 ? <p className="px-4 py-6 text-sm text-slate-400 text-center">No groups found</p>
              : filtered.map((group, idx) => (
                <button key={idx} onClick={() => { onSelect(group); setOpen(false) }} className={`w-full px-4 py-3 text-left hover:bg-violet-50/60 transition-colors border-b border-slate-50 last:border-0 ${selectedGroup?.groupName === group.groupName ? 'bg-violet-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${selectedGroup?.groupName === group.groupName ? 'text-violet-700' : 'text-slate-800'}`}>{group.groupName}</span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{group.orderCount}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{group.companies.slice(0, 3).join(', ')}{group.companies.length > 3 ? ` +${group.companies.length - 3} more` : ''}</p>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inline Distribution Table ────────────────────────────────
const InlineDistributionTable = ({ billingRows, paymentData, amountType, onBack, onSubmit, loading }) => {
  const typeInfo = AMOUNT_TYPES.find(t => t.value === amountType)
  const todayStr = todayDDMMYYYY()

  const [rows, setRows] = useState(() =>
    billingRows.map(({ order, state, splitPct, rowKey, isSplit }) => ({
      rowKey, orderId: order.orderId, companyName: order.companyName,
      state, entity: order.entity || '-', splitPct, isSplit, order,
      checked: false, amount: '', notes: paymentData.notes,
      balance: null, balanceLoading: true, monthlyData: null,
      monthlyAdjustments: [],
    }))
  )
  const [distMode, setDistMode] = useState('manual')
  const [breakdownRow, setBreakdownRow] = useState(null)

  useEffect(() => {
    console.log('[InlineDistributionTable] Loading monthly data for', billingRows.length, 'rows')
    billingRows.forEach(({ order, state, rowKey }) => {
      loadMonthlyDataForRow(order, state, todayStr)
        .then(({ balance, months }) => {
          console.log(`[InlineDistributionTable] Loaded ${rowKey}: balance=₹${balance}, months=${months.length}`)
          setRows(prev => prev.map(r => r.rowKey === rowKey ? { ...r, balance, balanceLoading: false, monthlyData: months } : r))
        })
        .catch(err => {
          console.error(`[InlineDistributionTable] Failed to load ${rowKey}:`, err)
          setRows(prev => prev.map(r => r.rowKey === rowKey ? { ...r, balance: 0, balanceLoading: false, monthlyData: [] } : r))
        })
    })
  }, []) // eslint-disable-line

  const applyMode = useCallback((currentRows, mode) => {
    if (mode === 'auto') {
      if (currentRows.some(r => r.checked && r.balanceLoading)) {
        console.log('[applyMode] Some checked rows still loading — skipping auto-split')
        return currentRows
      }
      console.log('[applyMode] Running auto-split for totalAmount=', paymentData.amount)
      const { allocated, monthlyAdjustments } = computeAutoSplitAmounts(currentRows, paymentData.amount)
      return currentRows.map(r => !r.checked
        ? { ...r, amount: '', monthlyAdjustments: [] }
        : { ...r, amount: String(allocated[r.rowKey] ?? 0), monthlyAdjustments: monthlyAdjustments[r.rowKey] || [] }
      )
    }
    return currentRows.map(r => ({ ...r, monthlyAdjustments: [] }))
  }, [paymentData.amount])

  const loadingKey = rows.map(r => r.balanceLoading).join(',')
  useEffect(() => {
    if (distMode === 'auto') {
      console.log('[loadingKey effect] Balance loading changed, re-running auto-split')
      setRows(prev => applyMode(prev, 'auto'))
    }
  }, [loadingKey]) // eslint-disable-line

  const toggle = (key) => {
    console.log('[toggle] rowKey=', key)
    setRows(prev => { const u = prev.map(r => r.rowKey !== key ? r : { ...r, checked: !r.checked }); return applyMode(u, distMode) })
  }
  const toggleAll = () => setRows(prev => {
    const allC = prev.every(r => r.checked)
    console.log('[toggleAll] allChecked was', allC, '→ setting to', !allC)
    const u = prev.map(r => ({ ...r, checked: !allC }))
    return applyMode(u, distMode)
  })
  const setAmt = (key, val) => setRows(prev => prev.map(r => r.rowKey !== key ? r : { ...r, amount: val }))
  const setNote = (key, val) => setRows(prev => prev.map(r => r.rowKey !== key ? r : { ...r, notes: val }))

  const handleModeChange = (mode) => {
    console.log('[handleModeChange] mode=', mode)
    setDistMode(mode)
    setRows(prev => applyMode(prev, mode))
  }
  const handleReset = () => {
    console.log('[handleReset] Resetting all rows')
    setRows(prev => prev.map(r => ({ ...r, checked: false, amount: '', notes: paymentData.notes, monthlyAdjustments: [] })))
    setDistMode('manual')
  }

  const totalAlloc = useMemo(() => Math.round(rows.filter(r => r.checked).reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100, [rows])
  const remaining = Math.round((paymentData.amount - totalAlloc) * 100) / 100
  const isOverAllocated = remaining < 0
  const checkedCount = rows.filter(r => r.checked).length
  const anyAmountMissing = rows.filter(r => r.checked).some(r => r.amount === '' || r.amount === null || r.amount === undefined)
  const isFullyDistributed = Math.abs(remaining) < 0.005
  const canSubmit = !loading && checkedCount > 0 && !anyAmountMissing && !isOverAllocated && isFullyDistributed
  const allMonthlyLoaded = rows.every(r => !r.balanceLoading)

  const displayMonth = (() => { const [y, m] = paymentData.month.split('-'); return `${ALL_MONTHS[parseInt(m) - 1]} ${y}` })()
  const pct = paymentData.amount > 0 ? Math.min(100, (totalAlloc / paymentData.amount) * 100) : 0

  const handleSubmit = () => {
    if (!canSubmit) return
    const entries = rows.filter(r => r.checked && Number(r.amount) >= 0).map(r => ({
      orderId:            r.orderId,
      companyName:        r.companyName,
      state:              r.state,
      entity:             r.entity,
      splitPct:           r.splitPct,
      isSplit:            r.isSplit,
      amount:             Number(r.amount),
      notes:              r.notes,
      date:               toDisplayDate(paymentData.date),
      month:              displayMonth,
      monthlyAdjustments: distMode === 'auto' ? (r.monthlyAdjustments || []) : [],
    }))
    console.log('[handleSubmit] Submitting entries:', entries)
    onSubmit(entries)
  }

  const openBreakdown = (row) => {
    const allocatedAmount = Number(row.amount) || 0
    console.log(`[openBreakdown] ${row.rowKey} allocatedAmount=₹${allocatedAmount}`)
    setBreakdownRow({
      orderId: row.orderId, state: row.state, companyName: row.companyName,
      months: row.monthlyData || [], balance: row.balance || 0,
      order: row.order, allocatedAmount,
    })
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-slate-300 transition-colors"><ArrowLeft className="w-3.5 h-3.5" />Back</button>
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center"><Users className="w-4 h-4 text-white" /></div>
              <div>
                <h3 className="text-base font-bold text-white">Distribute Payment</h3>
                <p className="text-slate-400 text-xs">{typeInfo?.fullLabel} · {displayMonth} · {toDisplayDate(paymentData.date)}</p>
              </div>
            </div>
            <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-slate-300 transition-colors"><X className="w-3.5 h-3.5" />Discard</button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400 font-medium">Allocation Progress</span>
                <span className={`text-xs font-bold ${isOverAllocated ? 'text-red-400' : 'text-slate-300'}`}>{Math.round(pct)}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${isOverAllocated ? 'bg-red-500' : pct === 100 ? 'bg-emerald-400' : 'bg-violet-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
            <div className="flex gap-3">
              {[
                { label: 'Total', value: `₹${fmt(paymentData.amount)}`, cls: 'text-white' },
                { label: 'Allocated', value: `₹${fmt(totalAlloc)}`, cls: 'text-emerald-400' },
                { label: 'Remaining', value: `₹${fmt(remaining)}`, cls: isOverAllocated ? 'text-red-400 font-extrabold' : isFullyDistributed && checkedCount > 0 ? 'text-emerald-400' : 'text-amber-400' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="text-right">
                  <p className="text-[10px] uppercase text-slate-500 font-bold">{label}</p>
                  <p className={`text-sm font-bold tabular-nums ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
          {isOverAllocated && (
            <div className="mt-2.5 flex items-center gap-2 bg-red-500/20 border border-red-500/40 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-red-300">Over-allocated by ₹{fmt(Math.abs(remaining))} — reduce amounts before submitting</span>
            </div>
          )}
        </div>

        {/* Mode bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1 mr-1"><SlidersHorizontal className="w-3 h-3" />Mode</span>
          {DIST_MODES.map(({ value, label, icon: Icon, desc }) => (
            <button key={value} onClick={() => handleModeChange(value)} title={desc}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${distMode === value ? (value === 'auto' ? 'bg-violet-600 border-violet-600 text-white shadow-sm' : 'bg-slate-700 border-slate-700 text-white shadow-sm') : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
          {distMode === 'auto' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 border border-violet-200 rounded-lg">
              <Zap className="w-3 h-3 text-violet-500" />
              <span className="text-[10px] font-bold text-violet-600">All orders filled together per month · oldest month first · smallest order first in partial months</span>
              {!allMonthlyLoaded && <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />}
            </div>
          )}
          <div className="flex-1" />
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-400 text-slate-600 text-xs font-bold rounded-lg transition-colors"><RotateCcw className="w-3 h-3" />Reset</button>
          <span className="text-xs text-slate-500 font-medium pl-1">{checkedCount}/{rows.length} selected</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-200">
                <th className="px-3 py-3 w-10">
                  <button onClick={toggleAll}>
                    {rows.length > 0 && rows.every(r => r.checked) ? <CheckSquare className="w-4 h-4 text-violet-600" /> : <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />}
                  </button>
                </th>
                {['Order ID', 'Company', 'State', 'Split%', 'Entity', 'Date', 'Month'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
                <th className="px-3 py-3 text-right text-[11px] font-bold text-amber-600 uppercase tracking-wide whitespace-nowrap">Outstanding</th>
                <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Amount (₹)</th>
                <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(row => (
                <tr key={row.rowKey} className={`transition-colors ${row.checked ? 'bg-violet-50/40' : 'hover:bg-slate-50/60'} ${row.isSplit ? 'border-l-[3px] border-l-violet-300' : ''}`}>
                  <td className="px-3 py-2.5">
                    <button onClick={() => toggle(row.rowKey)}>
                      {row.checked ? <CheckSquare className="w-4 h-4 text-violet-600" /> : <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-violet-700">{row.orderId}</span>
                      {row.isSplit && <span className="text-[9px] font-black text-violet-500 bg-violet-100 px-1.5 py-0.5 rounded uppercase tracking-wide">split</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-700 text-sm">{row.companyName}</td>
                  <td className="px-3 py-2.5"><span className="inline-flex px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md">{row.state}</span></td>
                  <td className="px-3 py-2.5 text-center"><span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-md ${row.isSplit ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-500'}`}>{row.splitPct}%</span></td>
                  <td className="px-3 py-2.5"><span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-md">{row.entity}</span></td>
                  <td className="px-3 py-2.5"><span className="text-xs text-slate-500 font-mono bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">{toDisplayDate(paymentData.date)}</span></td>
                  <td className="px-3 py-2.5"><span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">{displayMonth}</span></td>
                  <td className="px-3 py-2.5 bg-amber-50/50">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.balanceLoading
                        ? <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" /><span className="text-xs text-slate-400">…</span></div>
                        : <>
                          <span className={`text-sm font-bold tabular-nums ${(row.balance || 0) >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₹{fmt(row.balance || 0)}</span>
                          <button onClick={() => openBreakdown(row)} title="View full monthly breakdown" className="p-1 hover:bg-amber-200 rounded-lg transition-colors flex-shrink-0">
                            <Info className="w-3.5 h-3.5 text-amber-600" />
                          </button>
                        </>
                      }
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">₹</span>
                      <input type="number" disabled={!row.checked} value={row.amount} onChange={e => setAmt(row.rowKey, e.target.value)} placeholder="0"
                        className={`w-32 pl-6 pr-2 py-1.5 border rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 transition-all ${row.checked ? 'border-violet-300 bg-white text-slate-900 focus:ring-violet-400' : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'}`} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <input type="text" disabled={!row.checked} value={row.notes} onChange={e => setNote(row.rowKey, e.target.value)} placeholder="2. Add note…"
                      className={`w-44 px-2.5 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all ${row.checked ? 'border-violet-300 bg-white text-slate-700 focus:ring-violet-400' : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {isOverAllocated && <div className="flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /><span className="text-xs font-bold">Over-allocated by ₹{fmt(Math.abs(remaining))}</span></div>}
            {!isOverAllocated && isFullyDistributed && checkedCount > 0 && <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /><span className="text-xs font-bold">Fully distributed!</span></div>}
            {!isOverAllocated && remaining > 0 && checkedCount > 0 && <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg"><AlertCircle className="w-3.5 h-3.5" /><span className="text-xs font-bold">₹{fmt(remaining)} unallocated</span></div>}
            {checkedCount === 0 && <div className="flex items-center gap-1.5 text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg"><AlertCircle className="w-3.5 h-3.5" /><span className="text-xs font-bold">Select at least one order</span></div>}
          </div>
          <div className="flex gap-2.5">
            <button onClick={onBack} className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-sm font-semibold text-slate-700 transition-colors flex items-center gap-2"><ArrowLeft className="w-4 h-4" />Back</button>
            <button onClick={handleSubmit} disabled={!canSubmit}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${canSubmit ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm hover:shadow cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? 'Saving…' : `Submit${checkedCount > 0 ? ` (${checkedCount})` : ''}`}
            </button>
          </div>
        </div>
      </div>

      {breakdownRow && <MonthlyBreakdownPopup rowInfo={breakdownRow} onClose={() => setBreakdownRow(null)} />}
    </>
  )
}

// ─── Main Component ────────────────────────────────────────────
export default function BulkUpdate() {
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [amountType, setAmountType] = useState('')
  const [filters, setFilters] = useState({ state: '', entity: '' })
  const months = useMemo(() => monthOptions(), [])

  const initialDate = todayISO()
  const [form, setForm] = useState({
    date: initialDate,
    month: billingMonthFromDate(initialDate),
    amount: '',
    notes: buildPoint1(initialDate, ''),
    paymentMethod: 'cash',
    bankName: '',
    chequeNumber: '',
    chequeDate: '',
    neftId: '',
    transactionId: '',
    paymentNote: ''
  })
  const [formErr, setFormErr] = useState('')
  const [paymentData, setPaymentData] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    console.log('[BulkUpdate] Fetching orders from /api/billing/orders')
    fetch('/api/billing/orders').then(r => r.json()).then(j => {
      if (j.success) {
        console.log('[BulkUpdate] Orders loaded:', j.data.length)
        setOrders(j.data)
      }
    }).catch(console.error).finally(() => setLoadingOrders(false))
  }, [])

  const groups = useMemo(() => {
    const map = {}
    orders.forEach(o => {
      const key = o.groupName || o.companyName || 'Unknown'
      if (!map[key]) map[key] = { groupName: key, companies: [], orders: [] }
      if (!map[key].companies.includes(o.companyName)) map[key].companies.push(o.companyName)
      map[key].orders.push(o)
    })
    return Object.values(map).map(g => ({ ...g, orderCount: g.orders.length })).sort((a, b) => a.groupName.localeCompare(b.groupName))
  }, [orders])

  const filteredBillingRows = useMemo(() => {
    if (!selectedGroup) return []
    const filteredOrders = selectedGroup.orders.filter(o => {
      if (filters.entity && o.entity !== filters.entity) return false
      if (filters.state) { const s1 = o.billing1?.state || '', s2 = o.billing2?.state || ''; if (s1 !== filters.state && s2 !== filters.state) return false }
      return true
    })
    const allRows = expandOrdersToRows(filteredOrders)
    if (filters.state) return allRows.filter(r => r.state === filters.state)
    return allRows
  }, [selectedGroup, filters])

  const distinctOrderCount = useMemo(() => new Set(filteredBillingRows.map(r => r.order.orderId)).size, [filteredBillingRows])
  const canProceed = selectedGroup && amountType && filteredBillingRows.length > 0
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  const getUserExtra = (note) => { const lines = (note || '').split('\n'); return lines.slice(1).join('\n') }

  const handleField = (k, v) => {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      if (k === 'date') { next.month = billingMonthFromDate(v); const e = getUserExtra(prev.notes); next.notes = buildPoint1(v, prev.amount) + (e ? `\n${e}` : '') }
      if (k === 'amount') { const e = getUserExtra(prev.notes); next.notes = buildPoint1(prev.date, v) + (e ? `\n${e}` : '') }
      if (k === 'paymentMethod') {
        next.bankName = ''
        next.chequeNumber = ''
        next.chequeDate = ''
        next.neftId = ''
        next.transactionId = ''
        next.paymentNote = ''
      }
      return next
    })
    setFormErr('')
  }

  const handleDistribute = () => {
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) { setFormErr('Please enter a valid amount'); return }
    console.log('[handleDistribute] paymentData set:', form)
    setPaymentData({ ...form, amount: Number(form.amount) })
  }
  const handleBack = () => { setPaymentData(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const handleSubmit = async (entries) => {
    setSubmitting(true)
    console.log('[handleSubmit] Submitting', entries.length, 'entries')

    const capturedPaymentData = paymentData
    const capturedGroup = selectedGroup
    const capturedAmountType = amountType

    try {
      const results = await Promise.allSettled(entries.map(async ({ orderId, state, amount, notes, date, month }) => {
        const res = await fetch('/api/billing/monthly?action=add-entry', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, state, month, amountType, entry: { date, amount: Number(amount), notes } }),
        })
        const j = await res.json()
        if (!j.success) throw new Error(`${orderId}/${state}: ${j.error}`)
        return j
      }))

      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failedItems = results.filter(r => r.status === 'rejected').map(r => r.reason?.message || 'unknown error')

      if (succeeded > 0 && capturedGroup && capturedPaymentData) {
        try {
          const distRes = await fetch('/api/billing/distributed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyGroup:  capturedGroup.groupName,
              paymentType:   capturedAmountType,
              paymentDate:   entries[0]?.date  || '',
              billingMonth:  entries[0]?.month || '',
              totalAmount:   capturedPaymentData.amount,
              notes:         capturedPaymentData.notes || '',
              paymentMethod: capturedPaymentData.paymentMethod || 'cash',
              bankName:      capturedPaymentData.bankName      || '',
              chequeNumber:  capturedPaymentData.chequeNumber  || '',
              chequeDate:    capturedPaymentData.chequeDate    || '',
              neftId:        capturedPaymentData.neftId        || '',
              transactionId: capturedPaymentData.transactionId || '',
              paymentNote:   capturedPaymentData.paymentNote   || '',
              entryCount:    entries.length,
              entries: entries.map(e => ({
                orderId:     e.orderId,
                companyName: e.companyName  || '',
                state:       e.state,
                entity:      e.entity       || '',
                splitPct:    e.splitPct     || 100,
                isSplit:     e.isSplit      || false,
                amount:      Number(e.amount),
                notes:       e.notes        || '',
                date:        e.date,
                month:       e.month,
                monthlyAdjustments: (e.monthlyAdjustments || []).map(adj => ({
                  month:           adj.month,
                  invoiceNumber:   adj.invoiceNumber   || '-',
                  invoiceDate:     adj.invoiceDate     || '-',
                   monthlyAmount:   Number(adj.monthlyAmount)   || 0,   // ADD THIS
                  adjustedAmount:  Number(adj.adjustedAmount)  || 0,
                  remainingAmount: Number(adj.remainingAmount) || 0,
                  amountStatus:    adj.amountStatus    || 'Not Paid',
                })),
              })),
            }),
          })
          const distJson = await distRes.json()
          if (distJson.success) {
            console.log('[handleSubmit] Distribution record saved:', distJson.data?._id)
          } else {
            console.warn('[handleSubmit] Distribution record save failed (non-fatal):', distJson.error)
          }
        } catch (distErr) {
          console.error('[handleSubmit] Failed to save distribution record (non-fatal):', distErr)
        }
      }

      if (failedItems.length) {
        console.error('[handleSubmit] Some entries failed:', failedItems)
        showToast(`Saved ${succeeded}/${entries.length}. ${failedItems.length} failed — check console.`, succeeded > 0 ? 'success' : 'error')
      } else {
        console.log('[handleSubmit] All', succeeded, 'entries saved successfully')
        showToast(`Successfully saved ${succeeded} of ${entries.length} records.`)
      }

      setPaymentData(null)
      const nd = todayISO()
      setForm({
        date: nd,
        month: billingMonthFromDate(nd),
        amount: '',
        notes: buildPoint1(nd, ''),
        paymentMethod: 'cash',
        bankName: '',
        chequeNumber: '',
        chequeDate: '',
        neftId: '',
        transactionId: '',
        paymentNote: ''
      })
    } catch (e) {
      console.error('[handleSubmit] Error:', e)
      showToast('Update failed: ' + e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const billingMonthLabel = useMemo(() => { const found = months.find(m => m.value === form.month); return found ? found.label : '' }, [form.month, months])
  const selectedPaymentMethod = PAYMENT_METHODS.find(pm => pm.value === form.paymentMethod)

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[99999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}{toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-4">
        {paymentData ? (
          <>
            <div className="flex items-center gap-2">
              <button onClick={handleBack} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"><ArrowLeft className="w-4 h-4" /><span>Bulk Payment Update</span></button>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <span className="text-sm font-bold text-slate-800">Distribute Payment</span>
            </div>
            <InlineDistributionTable billingRows={filteredBillingRows} paymentData={paymentData} amountType={amountType} loading={submitting} onBack={handleBack} onSubmit={handleSubmit} />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bulk Payment Update</h1>
                <p className="text-sm text-slate-400 mt-0.5">Record and distribute payments across multiple orders</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-500 font-medium">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />{orders.length} orders loaded
              </div>
            </div>

            {/* CARD 1 — Payment Setup */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center"><Banknote className="w-3.5 h-3.5 text-violet-600" /></div>
                  <div><h2 className="text-sm font-bold text-slate-800">Payment Setup</h2><p className="text-xs text-slate-400">Configure company, type, and payment details</p></div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Billing Month</p>
                  <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg">
                    <CalendarDays className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="text-sm font-bold text-indigo-700">{billingMonthLabel}</span>
                    <span className="text-[9px] font-black text-indigo-400 bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded-full uppercase ml-1">Auto</span>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Company Group</label>
                    {loadingOrders ? <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                      : <CompanyGroupDropdown groups={groups} selectedGroup={selectedGroup} onSelect={grp => { setSelectedGroup(grp); setFilters({ state: '', entity: '' }); setPaymentData(null) }} />}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Payment Type</label>
                    <div className="flex gap-2">
                      {AMOUNT_TYPES.map(t => (
                        <button key={t.value} onClick={() => { setAmountType(v => v === t.value ? '' : t.value); setPaymentData(null) }}
                          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border-2 transition-all ${amountType === t.value ? `${t.bg} border-transparent text-white shadow-sm` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-slate-200" /></div>
                  <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Payment Details</span></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2"><CalendarDays className="w-3.5 h-3.5 text-violet-500" />Payment Date</label>
                        <input type="date" value={form.date} onChange={e => handleField('date', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium text-slate-700 bg-white" />
                      </div>
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2"><IndianRupee className="w-3.5 h-3.5 text-emerald-500" />Amount (₹)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                          <input type="number" value={form.amount} onChange={e => handleField('amount', e.target.value)} placeholder="0.00"
                            className={`w-full pl-7 pr-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-bold text-slate-800 ${formErr ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`} />
                        </div>
                        {formErr && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErr}</p>}
                      </div>
                    </div>

                    {/* Payment Method Selection */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                        {selectedPaymentMethod && <selectedPaymentMethod.icon className={`w-3.5 h-3.5 text-${selectedPaymentMethod.color}-500`} />}
                        Payment Method
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {PAYMENT_METHODS.map(pm => {
                          const Icon = pm.icon
                          return (
                            <button key={pm.value} onClick={() => handleField('paymentMethod', pm.value)}
                              className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                form.paymentMethod === pm.value
                                  ? `bg-${pm.color}-50 border-${pm.color}-500 text-${pm.color}-700 shadow-sm`
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                              }`}>
                              <Icon className="w-4 h-4" />
                              {pm.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Conditional Payment Fields */}
                    {form.paymentMethod && (
                      <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                          {selectedPaymentMethod && <selectedPaymentMethod.icon className={`w-4 h-4 text-${selectedPaymentMethod.color}-500`} />}
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{selectedPaymentMethod?.label} Details</span>
                        </div>
                        {form.paymentMethod === 'cash' && (
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5">Note</label>
                            <input type="text" value={form.paymentNote} onChange={e => handleField('paymentNote', e.target.value)} placeholder="Enter note..."
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
                          </div>
                        )}
                        {form.paymentMethod === 'cheque' && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1.5">Bank Name <span className="text-slate-400">(optional)</span></label>
                              <input type="text" value={form.bankName} onChange={e => handleField('bankName', e.target.value)} placeholder="Enter bank name..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1.5">Cheque Number</label>
                              <input type="text" value={form.chequeNumber} onChange={e => handleField('chequeNumber', e.target.value)} placeholder="Enter cheque number..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1.5">Cheque Date</label>
                              <input type="date" value={form.chequeDate} onChange={e => handleField('chequeDate', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1.5">Note</label>
                              <input type="text" value={form.paymentNote} onChange={e => handleField('paymentNote', e.target.value)} placeholder="Enter note..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                            </div>
                          </>
                        )}
                        {form.paymentMethod === 'upi' && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1.5">Transaction/Receipt ID</label>
                              <input type="text" value={form.transactionId} onChange={e => handleField('transactionId', e.target.value)} placeholder="Enter transaction ID..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1.5">Note</label>
                              <input type="text" value={form.paymentNote} onChange={e => handleField('paymentNote', e.target.value)} placeholder="Enter note..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                            </div>
                          </>
                        )}
                        {form.paymentMethod === 'neft' && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1.5">Bank Name <span className="text-slate-400">(optional)</span></label>
                              <input type="text" value={form.bankName} onChange={e => handleField('bankName', e.target.value)} placeholder="Enter bank name..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1.5">NEFT ID/No</label>
                              <input type="text" value={form.neftId} onChange={e => handleField('neftId', e.target.value)} placeholder="Enter NEFT ID..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1.5">Note</label>
                              <input type="text" value={form.paymentNote} onChange={e => handleField('paymentNote', e.target.value)} placeholder="Enter note..."
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <button onClick={handleDistribute} disabled={!canProceed}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all w-full justify-center ${canProceed ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm hover:shadow' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                      {canProceed ? <Users className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {!selectedGroup ? 'Select a group first' : !amountType ? 'Choose payment type' : filteredBillingRows.length === 0 ? 'No matching orders' : 'Distribute Amount'}
                      {canProceed && <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex flex-col h-full">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2"><StickyNote className="w-3.5 h-3.5 text-amber-500" />Notes</label>
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-t-xl">
                      <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-amber-700 mb-0.5">Auto-filled (locked)</p>
                        <p className="text-xs text-amber-800 font-mono break-all leading-relaxed">{buildPoint1(form.date, form.amount)}</p>
                      </div>
                    </div>
                    <textarea value={getUserExtra(form.notes)}
                      onChange={e => { const extra = e.target.value; setForm(prev => ({ ...prev, notes: buildPoint1(prev.date, prev.amount) + (extra ? `\n${extra}` : '') })) }}
                      rows={5} placeholder="2. Add additional notes here…"
                      className="flex-1 w-full px-3 py-2.5 border border-t-0 border-slate-200 rounded-b-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white resize-none leading-relaxed" />
                    <p className="mt-1.5 text-[10px] text-slate-400 flex items-center gap-1"><AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0" />Point 1 is auto-generated from date &amp; amount. Write additional points below.</p>
                  </div>
                </div>

                {/* Payment Details Display Card */}
                {form.paymentMethod && (
                  <div className="mt-4 p-4 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-300">
                      <div className={`w-8 h-8 rounded-lg bg-${selectedPaymentMethod?.color}-100 flex items-center justify-center`}>
                        {selectedPaymentMethod && <selectedPaymentMethod.icon className={`w-4 h-4 text-${selectedPaymentMethod.color}-600`} />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Payment Details Summary</h3>
                        <p className="text-xs text-slate-500">{selectedPaymentMethod?.label} Payment</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Payment Date</p>
                        <p className="text-sm font-semibold text-slate-800">{toDisplayDate(form.date) || '--'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Amount</p>
                        <p className="text-sm font-bold text-emerald-700">₹{form.amount ? fmt(Number(form.amount)) : '--'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Method</p>
                        <p className={`text-sm font-bold text-${selectedPaymentMethod?.color}-700`}>{selectedPaymentMethod?.label}</p>
                      </div>
                      {form.paymentMethod === 'cheque' && form.bankName && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Bank Name</p>
                          <p className="text-sm font-semibold text-slate-800">{form.bankName}</p>
                        </div>
                      )}
                      {form.paymentMethod === 'cheque' && form.chequeNumber && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Cheque Number</p>
                          <p className="text-sm font-mono font-bold text-blue-700">{form.chequeNumber}</p>
                        </div>
                      )}
                      {form.paymentMethod === 'cheque' && form.chequeDate && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Cheque Date</p>
                          <p className="text-sm font-mono font-bold text-blue-700">{toDisplayDate(form.chequeDate)}</p>
                        </div>
                      )}
                      {form.paymentMethod === 'neft' && form.bankName && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Bank Name</p>
                          <p className="text-sm font-semibold text-slate-800">{form.bankName}</p>
                        </div>
                      )}
                      {form.paymentMethod === 'neft' && form.neftId && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">NEFT ID</p>
                          <p className="text-sm font-mono font-bold text-violet-700">{form.neftId}</p>
                        </div>
                      )}
                      {form.paymentMethod === 'upi' && form.transactionId && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200 col-span-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Transaction ID</p>
                          <p className="text-sm font-mono font-bold text-orange-700 break-all">{form.transactionId}</p>
                        </div>
                      )}
                      {form.paymentNote && (
                        <div className="bg-white rounded-lg p-3 border border-slate-200 col-span-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Payment Note</p>
                          <p className="text-sm text-slate-700">{form.paymentNote}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 2 — Filter Orders */}
            {selectedGroup && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center"><Filter className="w-3.5 h-3.5 text-slate-500" /></div>
                    <div><h2 className="text-sm font-bold text-slate-800">Filter Orders</h2><p className="text-xs text-slate-400">Narrow down which orders to include</p></div>
                  </div>
                  <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">{filteredBillingRows.length} row{filteredBillingRows.length !== 1 ? 's' : ''} · {distinctOrderCount} order{distinctOrderCount !== 1 ? 's' : ''}</div>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-3 mb-5">
                    <div className="min-w-[220px] flex-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">State</label>
                      <SearchableDropdown options={INDIAN_STATES.map(s => ({ value: s.name, label: s.name }))} value={filters.state} onChange={v => { setFilters(p => ({ ...p, state: v })); setPaymentData(null) }} placeholder="All States" />
                    </div>
                    <div className="min-w-[160px]">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Entity</label>
                      <select value={filters.entity} onChange={e => { setFilters(p => ({ ...p, entity: e.target.value })); setPaymentData(null) }} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500 font-medium text-slate-700">
                        <option value="">All Entities</option>
                        {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    {(filters.state || filters.entity) && (
                      <div className="flex items-end">
                        <button onClick={() => { setFilters({ state: '', entity: '' }); setPaymentData(null) }} className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 text-sm rounded-lg border border-rose-200 hover:bg-rose-100 font-semibold"><X className="w-3.5 h-3.5" />Clear filters</button>
                      </div>
                    )}
                  </div>
                  {filteredBillingRows.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-slate-50 border-b border-slate-200">{['Order ID', 'Company', 'State', 'Split %', 'Entity', 'Status'].map(h => <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredBillingRows.slice(0, 10).map(row => (
                            <tr key={row.rowKey} className={`hover:bg-slate-50/60 ${row.isSplit ? 'border-l-[3px] border-l-violet-300' : ''}`}>
                              <td className="px-4 py-2.5"><div className="flex items-center gap-1.5"><span className="font-bold text-violet-700">{row.order.orderId}</span>{row.isSplit && <span className="text-[9px] font-black text-violet-500 bg-violet-100 px-1.5 py-0.5 rounded uppercase">split</span>}</div></td>
                              <td className="px-4 py-2.5 font-medium text-slate-700">{row.order.companyName}</td>
                              <td className="px-4 py-2.5"><span className="inline-flex px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md">{row.state}</span></td>
                              <td className="px-4 py-2.5"><span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-md ${row.isSplit ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-500'}`}>{row.splitPct}%</span></td>
                              <td className="px-4 py-2.5"><span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-md">{row.order.entity || '-'}</span></td>
                              <td className="px-4 py-2.5"><span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-md ${row.order.status === 'PCD' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{row.order.status || '-'}</span></td>
                            </tr>
                          ))}
                          {filteredBillingRows.length > 10 && <tr><td colSpan={6} className="px-4 py-2 text-xs text-slate-400 text-center">+{filteredBillingRows.length - 10} more rows</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-5 bg-slate-50 rounded-xl border border-dashed border-slate-300"><AlertCircle className="w-5 h-5 text-slate-300 flex-shrink-0" /><p className="text-sm text-slate-400">No orders match the current filters.</p></div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}