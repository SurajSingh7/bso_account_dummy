'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Filter, Download, X, Eye, EyeOff, Info } from 'lucide-react'
import CalculationBreakdown from '@/components/core/billing/CalculationBreakdown';



const INDIAN_STATES = [
  "Delhi", "Maharashtra", "Karnataka", "Tamil Nadu", "Uttar Pradesh",
  "Haryana", "Punjab", "Gujarat", "West Bengal", "Rajasthan", "Other"
];


const ENTITIES = ["WIBRO", "GTEL", "GISPL"];


const ALL_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];


// Utility Functions
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};


const formatDateDisplay = (dateStr) => dateStr || '-';


const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();


const getLastDayOfMonth = (month, year) => {
  const lastDay = getDaysInMonth(month, year);
  const monthStr = String(month + 1).padStart(2, '0');
  return `${lastDay}-${monthStr}-${year}`;
};


const getCurrentDate = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}-${month}-${year}`;
};


const convertToInputFormat = (dateStr) => {
  if (!dateStr) return '';
  const [day, month, year] = dateStr.split('-');
  return `${year}-${month}-${day}`;
};


const convertToStorageFormat = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
};


const formatMonthYear = (month, year) => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${monthNames[month]} ${year}`;
};


const getCurrentYear = () => new Date().getFullYear();
const getCurrentMonth = () => new Date().getMonth();


const getYearOptions = () => {
  const currentYear = getCurrentYear();
  return ["All", ...Array.from({ length: 6 }, (_, i) => currentYear - i)];
};


const getAvailableMonths = (selectedYear) => {
  const currentYear = getCurrentYear();
  const currentMonthIndex = getCurrentMonth();


  if (selectedYear === currentYear) {
    return ALL_MONTHS.slice(0, currentMonthIndex + 1);
  } else {
    return ALL_MONTHS;
  }
};


const getDefaultDateRange = () => {
  const year = getCurrentYear();
  const month = getCurrentMonth() + 1;
  const day = new Date().getDate();
  return {
    fromDate: `${year}-01-01`,
    toDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  };
};


// ✅ NEW: Helper function to get received amount from localStorage
const getReceivedAmount = (month, year, id, state, splitKey) => {
  if (typeof window === 'undefined') return 0;

  const storageKey = `collections_${id}_${state}_${splitKey}`;
  const stored = localStorage.getItem(storageKey);
  
  if (!stored) return 0;

  try {
    const collections = JSON.parse(stored);
    
    const monthCollections = collections.filter(c => {
      const [collYear, collMonth] = c.date.split('-');
      return parseInt(collMonth) === month + 1 && parseInt(collYear) === year;
    });

    return monthCollections.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
  } catch (e) {
    console.error("[getReceivedAmount] Error:", e);
    return 0;
  }
};


// ✅ FIXED: Balance calculation now always uses full service period
const calculateBalanceWithBreakdown = (order, splitFactor = 1, stateToShow = '') => {
  const pcdDate = parseDate(order.pcdDate);
  const terminateDate = order.terminateDate ? parseDate(order.terminateDate) : null;
  
  // ✅ FIXED: Always calculate from PCD to current date (or terminate date)
  const today = new Date();
  const endDate = terminateDate || today;

  const breakdown = {
    months: [],
    totalBalance: 0,
    totalBilled: 0,
    totalReceived: 0,
    orderDetails: {
      orderId: order.orderId,
      lsiId: order.lsiId,
      capacity: Number(order.capacity) || 0,
      baseRate: Number(order.amount) || 0,
      pcdDate: order.pcdDate,
      terminateDate: order.terminateDate,
      splitFactor: splitFactor,
      state: stateToShow || order.billing1?.state || '',
      splitKey: splitFactor === 2 ? '50' : '100',
      id: order.id
    }
  };


  if (!pcdDate) return breakdown;


  const capacityMbps = Number(order.capacity) || 0;
  const baseRate = Number(order.amount) || 0;
  const totalAmount = baseRate * capacityMbps;
  const gstAmount = totalAmount * 0.18;
  const grandTotal = (totalAmount + gstAmount) / splitFactor;


  breakdown.orderDetails.totalAmount = totalAmount;
  breakdown.orderDetails.gstAmount = gstAmount;
  breakdown.orderDetails.monthlyCharge = grandTotal;


  let serviceEndDate = endDate;


  if (terminateDate) {
    const lastBillingDay = new Date(terminateDate);
    lastBillingDay.setDate(lastBillingDay.getDate() - 1);
    serviceEndDate = lastBillingDay;
  }


  let totalBilledAmount = 0;
  let totalReceivedAmount = 0;
  let currentDate = new Date(pcdDate);


  while (currentDate <= serviceEndDate) {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const daysInMonth = getDaysInMonth(month, year);


    const isPcdMonth = (currentDate.getFullYear() === pcdDate.getFullYear() &&
      currentDate.getMonth() === pcdDate.getMonth());


    const isTerminateMonth = terminateDate &&
      (currentDate.getFullYear() === serviceEndDate.getFullYear() &&
        currentDate.getMonth() === serviceEndDate.getMonth());


    let monthBalance = 0;
    let billingDays = 0;
    let startDay = 1;
    let endDay = daysInMonth;


    if (isPcdMonth && isTerminateMonth) {
      startDay = pcdDate.getDate();
      endDay = serviceEndDate.getDate();
      billingDays = endDay - startDay + 1;
      const perDayRate = grandTotal / daysInMonth;
      monthBalance = perDayRate * billingDays;
    } else if (isPcdMonth) {
      startDay = pcdDate.getDate();
      endDay = daysInMonth;
      billingDays = endDay - startDay + 1;
      const perDayRate = grandTotal / daysInMonth;
      monthBalance = perDayRate * billingDays;
    } else if (isTerminateMonth) {
      startDay = 1;
      endDay = serviceEndDate.getDate();
      billingDays = endDay - startDay + 1;
      const perDayRate = grandTotal / daysInMonth;
      monthBalance = perDayRate * billingDays;
    } else {
      billingDays = daysInMonth;
      monthBalance = grandTotal;
    }

    // ✅ Get received amount for this month
    const receivedAmount = getReceivedAmount(
      month, 
      year, 
      breakdown.orderDetails.id, 
      breakdown.orderDetails.state, 
      breakdown.orderDetails.splitKey
    );

    totalBilledAmount += monthBalance;
    totalReceivedAmount += receivedAmount;

    breakdown.months.push({
      monthYear: formatMonthYear(month, year),
      month: month,
      year: year,
      daysInMonth: daysInMonth,
      billingDays: billingDays,
      startDay: startDay,
      endDay: endDay,
      perDayRate: grandTotal / daysInMonth,
      monthlyCharge: grandTotal,
      amount: monthBalance,
      receivedAmount: receivedAmount,
      isPcdMonth: isPcdMonth,
      isTerminateMonth: isTerminateMonth
    });


    if (isTerminateMonth) break;


    currentDate = new Date(year, month + 1, 1);
  }


  // ✅ Calculate total balance as (billed - received)
  breakdown.totalBilled = totalBilledAmount;
  breakdown.totalReceived = totalReceivedAmount;
  breakdown.totalBalance = totalBilledAmount - totalReceivedAmount;
  
  return breakdown;
};


const calculateBalance = (order, splitFactor = 1, stateToShow = '') => {
  const breakdown = calculateBalanceWithBreakdown(order, splitFactor, stateToShow);
  return breakdown.totalBalance;
};


// ✅ FIXED: Service period now always shows full period
const getServicePeriod = (order) => {
  const pcdDate = order.pcdDate;
  const terminateDate = order.terminateDate;

  if (terminateDate) {
    return { start: pcdDate, end: terminateDate, status: 'terminated' };
  }

  const today = new Date();
  const endMonth = today.getMonth();
  const endYear = today.getFullYear();
  const lastDayOfMonth = getLastDayOfMonth(endMonth, endYear);

  return { start: pcdDate, end: lastDayOfMonth, status: 'active' };
};


const shouldSplitBilling = (order) => {
  const isNLD = order.product === "NLD";
  const state1 = order.billing1?.state || "";
  const state2 = order.billing2?.state || "";
  return isNLD && state1 !== state2 && state2 !== "";
};


const truncateText = (text, maxLength) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};


// Text Popup Modal Component
const TextPopupModal = React.memo(({ text, onClose }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);


  return (
    <div
      className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Full Text</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-[15px] text-slate-700 leading-relaxed break-words whitespace-pre-wrap">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
});


TextPopupModal.displayName = 'TextPopupModal';


// Truncated Text Component
const TruncatedText = React.memo(({ text, limit, className = "" }) => {
  const [showPopup, setShowPopup] = useState(false);


  if (!text) return <span className={className}>-</span>;


  if (text.length <= limit) {
    return <span className={className}>{text}</span>;
  }


  return (
    <>
      <span className={className}>
        {text.substring(0, limit)}
        <span
          className="text-blue-600 cursor-pointer hover:underline ml-1 font-medium"
          onClick={() => setShowPopup(true)}
        >
          ..more
        </span>
      </span>
      {showPopup && (
        <TextPopupModal
          text={text}
          onClose={() => setShowPopup(false)}
        />
      )}
    </>
  );
});


TruncatedText.displayName = 'TruncatedText';


// Table Row Component
const TableRow = React.memo(({
  order,
  hideLsiColumn,
  splitFactor = 1,
  stateToShow,
  onViewBreakdown
}) => {
  const servicePeriod = getServicePeriod(order);
  const breakdown = calculateBalanceWithBreakdown(order, splitFactor, stateToShow);

  return (
    <tr className="hover:bg-blue-50/40 transition-colors duration-150 border-b border-slate-100 last:border-0">
      <td className="px-4 py-4">
        <span className="text-[16px] font-semibold text-blue-600">{order.orderId}</span>
      </td>
      {!hideLsiColumn && (
        <td className="px-4 py-4">
          <span className="text-[16px] font-semibold text-orange-600">{order.lsiId || '-'}</span>
        </td>
      )}
      <td className="px-4 py-4">
        <TruncatedText
          text={order.endA}
          limit={18}
          className="text-[15px] font-semibold text-slate-700"
        />
      </td>
      <td className="px-4 py-4">
        <TruncatedText
          text={order.endB}
          limit={18}
          className="text-[15px] font-semibold text-slate-700"
        />
      </td>
      <td className="px-4 py-4">
        <TruncatedText
          text={order.companyName}
          limit={18}
          className="text-[15px] font-semibold text-slate-700"
        />
      </td>
      <td className="px-4 py-4">
        <span className="inline-flex px-3 py-1.5 bg-indigo-50 text-indigo-700 text-[14px] font-semibold rounded-md">
          {stateToShow || order.billing1?.state || order.billing2?.state || '-'}
        </span>
      </td>
      <td className="px-4 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className={`text-[16px] font-bold ${breakdown.totalBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            ₹{breakdown.totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <button
            onClick={() => onViewBreakdown(breakdown)}
            className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors duration-200 group"
            title="View calculation breakdown"
          >
            <Info className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
          </button>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <span className={`inline-flex px-3 py-1 text-[14px] font-semibold rounded ${splitFactor === 2
          ? 'bg-amber-50 text-amber-700'
          : 'bg-slate-100 text-slate-700'
          }`}>
          {splitFactor === 2 ? '50%' : '100%'}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${servicePeriod.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
          <span className="text-[14px] text-slate-700 font-semibold whitespace-nowrap">
            {formatDateDisplay(servicePeriod.start)} → {formatDateDisplay(servicePeriod.end)}
          </span>
          <span className={`ml-1 px-2 py-0.5 text-[13px] font-semibold rounded ${servicePeriod.status === 'active'
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-rose-50 text-rose-700'
            }`}>
            {servicePeriod.status === 'active' ? 'Active' : 'Terminated'}
          </span>
        </div>
      </td>
    </tr>
  );
});


TableRow.displayName = 'TableRow';


const BillingReportComp = () => {
  const [orders, setOrders] = useState([]);
  const [hideLsiColumn, setHideLsiColumn] = useState(true);
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);


  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const todayFormatted = getCurrentDate();
  const defaultDateRange = getDefaultDateRange();


  const [activeTab, setActiveTab] = useState('period');
  const [statusFilter, setStatusFilter] = useState('active');


  const [filters, setFilters] = useState({
    search: '',
    state: '',
    company: '',
    entity: '',
    fromDate: defaultDateRange.fromDate,
    toDate: defaultDateRange.toDate,
  });


  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState('All');


  useEffect(() => {
    const stored = localStorage.getItem("app_orders");
    if (stored) {
      try {
        const parsedOrders = JSON.parse(stored);
        setOrders(parsedOrders);
      } catch (e) {
        console.error("Error parsing orders:", e);
      }
    }
  }, []);


  const yearOptions = useMemo(() => getYearOptions(), []);


  const handleYearChange = (year) => {
    if (year === 'All') {
      setSelectedYear(year);
      setSelectedMonth('All');
    } else {
      const yearNum = parseInt(year);
      setSelectedYear(yearNum);
      setSelectedMonth(yearNum === getCurrentYear() ? ALL_MONTHS[getCurrentMonth()] : 'All');
    }
  };


  const availableMonths = useMemo(() => {
    if (selectedYear === 'All') {
      return [];
    }
    return getAvailableMonths(parseInt(selectedYear));
  }, [selectedYear]);


  useEffect(() => {
    if (activeTab === 'period') {
      if (selectedYear === 'All') {
        setFilters(prev => ({
          ...prev,
          fromDate: '',
          toDate: convertToInputFormat(todayFormatted)
        }));
      } else {
        const year = selectedYear;
        let lastDay;


        if (selectedMonth === 'All') {
          const monthIndex = year === getCurrentYear() ? getCurrentMonth() : 11;
          lastDay = getLastDayOfMonth(monthIndex, year);
        } else {
          const monthIndex = ALL_MONTHS.indexOf(selectedMonth);
          lastDay = getLastDayOfMonth(monthIndex, year);
        }


        setFilters(prev => ({
          ...prev,
          fromDate: '',
          toDate: convertToInputFormat(lastDay)
        }));
      }
    }
  }, [selectedMonth, selectedYear, activeTab, todayFormatted]);


  const maxDateForInput = useMemo(() => {
    return convertToInputFormat(todayFormatted);
  }, [todayFormatted]);


  const minDateForInput = useMemo(() => {
    const minYear = currentYear - 5;
    return `${minYear}-01-01`;
  }, [currentYear]);


  // ✅ FIXED: Filter orders based on PCD/Terminate date falling in selected period
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchCompany = !filters.company ||
        order.companyName?.toLowerCase().includes(filters.company.toLowerCase());


      const matchEntity = !filters.entity || order.entity === filters.entity;


      const matchState = !filters.state ||
        order.billing1?.state === filters.state ||
        order.billing2?.state === filters.state;


      const matchSearch = !filters.search ||
        order.orderId?.toLowerCase().includes(filters.search.toLowerCase()) ||
        order.lsiId?.toLowerCase().includes(filters.search.toLowerCase());


      let matchStatus = true;
      if (statusFilter === 'active') {
        matchStatus = order.status === 'PCD';
      } else {
        matchStatus = order.status === 'Terminate';
      }


      let matchDateFilter = true;


      // ✅ FIXED: Use PCD date for active orders, terminate date for inactive orders
      const relevantDateField = (statusFilter === 'inactive' && order.status === 'Terminate')
        ? order.terminateDate
        : order.pcdDate;


      const orderDate = parseDate(relevantDateField);


      if (orderDate) {
        if (activeTab === 'period') {
          if (selectedYear !== 'All') {
            const selectedYearNum = parseInt(selectedYear);


            if (selectedMonth === 'All') {
              matchDateFilter = orderDate.getFullYear() === selectedYearNum;
            } else {
              const monthIndex = ALL_MONTHS.indexOf(selectedMonth);
              matchDateFilter = orderDate.getFullYear() === selectedYearNum &&
                orderDate.getMonth() === monthIndex;
            }
          }
        } else if (activeTab === 'dateRange') {
          if (filters.fromDate && filters.toDate) {
            const fromDate = new Date(filters.fromDate);
            const toDate = new Date(filters.toDate);
            toDate.setHours(23, 59, 59, 999);
            matchDateFilter = orderDate >= fromDate && orderDate <= toDate;
          }
        }
      }

      return matchSearch && matchCompany && matchEntity && matchState && matchStatus && matchDateFilter;
    });
  }, [orders, filters, statusFilter, activeTab, selectedYear, selectedMonth]);


  // ✅ FIXED: Balance calculation always uses full service period
  const totalBalance = useMemo(() => {
    return filteredOrders.reduce((sum, order) => {
      const splitBilling = shouldSplitBilling(order);
      
      if (splitBilling) {
        const balance1 = calculateBalance(order, 2, order.billing1?.state);
        const balance2 = calculateBalance(order, 2, order.billing2?.state);
        return sum + balance1 + balance2;
      } else {
        return sum + calculateBalance(order, 1);
      }
    }, 0);
  }, [filteredOrders]);


  const uniqueCompanies = useMemo(() => {
    return [...new Set(orders.map(o => o.companyName))].filter(Boolean);
  }, [orders]);


  const clearAllFilters = useCallback(() => {
    const defaultRange = getDefaultDateRange();
    setFilters({
      search: '',
      state: '',
      company: '',
      entity: '',
      fromDate: defaultRange.fromDate,
      toDate: defaultRange.toDate,
    });
    setActiveTab('period');
    setSelectedYear(currentYear);
    setSelectedMonth(ALL_MONTHS[getCurrentMonth()]);
    setStatusFilter('active');
  }, [currentYear]);


  const hasActiveFilters = filters.search || filters.state || filters.company || filters.entity || (activeTab === 'dateRange' && filters.fromDate);


  const handleExport = useCallback(() => {
    console.log('Export functionality to be implemented');
  }, []);


  const getPeriodLabel = () => {
    if (selectedYear === 'All') {
      return 'All';
    }
    if (selectedMonth === 'All') {
      return `All ${selectedYear}`;
    }
    return `${selectedMonth} ${selectedYear}`;
  };


  if (selectedBreakdown) {
    return (
      <CalculationBreakdown
        breakdown={selectedBreakdown}
        onClose={() => setSelectedBreakdown(null)}
      />
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="max-w-[1800px] mx-auto p-6 lg:p-8">


        {/* Filters Section */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mb-6">


          {/* Title Row */}
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-slate-900 mb-0.5">
              Billing Report Summary
            </h1>
            <p className="text-[14px] text-slate-600">Track and analyze billing data for all service periods</p>
          </div>


          {/* Main Filter Row */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Order/LSI..."
                className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>


            <select
              className="px-3 py-2.5 border border-slate-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white min-w-[140px]"
              value={filters.state}
              onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
            >
              <option value="">All States</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>


            <select
              className="px-3 py-2.5 border border-slate-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white min-w-[160px]"
              value={filters.company}
              onChange={(e) => setFilters(prev => ({ ...prev, company: e.target.value }))}
            >
              <option value="">All Companies</option>
              {uniqueCompanies.map(company => (
                <option key={company} value={company}>
                  {truncateText(company, 20)}
                </option>
              ))}
            </select>

            <select
              className="px-3 py-2.5 border border-slate-300 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white min-w-[140px]"
              value={filters.entity}
              onChange={(e) => setFilters(prev => ({ ...prev, entity: e.target.value }))}
            >
              <option value="">All Entities</option>
              {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>


            <select
              className="px-3 py-2.5 border border-emerald-300 rounded-lg text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 bg-emerald-50 text-emerald-700 min-w-[150px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="active">Active (PCD)</option>
              <option value="inactive">Inactive (Terminate)</option>
            </select>


            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-rose-50 text-rose-600 text-[14px] font-medium rounded-lg hover:bg-rose-100 transition-colors duration-200 border border-rose-200"
              >
                <X className="w-3.5 h-3.5" />
                Clear Filter
              </button>
            )}


            <div className="flex-1"></div>


            <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 rounded-xl px-5 py-3 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-slate-200/40 rounded-full blur-2xl" />
              <div className="relative">
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  Total Orders
                </p>
                <div className="flex items-end gap-2 mt-1">
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    {filteredOrders.length}
                  </p>
                  <span className="text-xs text-slate-500 font-medium pb-1">
                    Orders
                  </span>
                </div>
              </div>
            </div>


            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-emerald-100 rounded-xl px-5 py-3 border border-emerald-200 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-200/40 rounded-full blur-2xl" />
              <div className="relative">
                <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                  Total Balance
                </p>
                <div className="flex items-end gap-2 mt-1">
                  <p className={`text-2xl font-extrabold tracking-tight ${totalBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    ₹{totalBalance.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <span className="text-xs text-emerald-500 font-medium pb-1">
                    INR
                  </span>
                </div>
              </div>
            </div>


          </div>

          {/* Tab Navigation Row */}
          <div className="flex items-center justify-between border-b border-slate-200 mb-4">
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setActiveTab('period');
                  const defaultRange = getDefaultDateRange();
                  setFilters(prev => ({
                    ...prev,
                    fromDate: defaultRange.fromDate,
                    toDate: defaultRange.toDate
                  }));
                }}
                className={`px-5 py-2.5 text-[14px] font-semibold transition-all duration-200 border-b-2 ${activeTab === 'period'
                  ? 'text-teal-600 border-teal-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
              >
                Period Selector
              </button>
              <button
                onClick={() => {
                  setActiveTab('dateRange');
                  const defaultRange = getDefaultDateRange();
                  setFilters(prev => ({
                    ...prev,
                    fromDate: defaultRange.fromDate,
                    toDate: defaultRange.toDate
                  }));
                }}
                className={`px-5 py-2.5 text-[14px] font-semibold transition-all duration-200 border-b-2 ${activeTab === 'dateRange'
                  ? 'text-teal-600 border-teal-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
              >
                Date Range
              </button>
            </div>


            <div className="flex items-center gap-2 mb-0.5">
              <button
                onClick={() => setHideLsiColumn(!hideLsiColumn)}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 text-slate-700 text-[14px] font-medium rounded-lg hover:bg-slate-200 transition-colors duration-200"
              >
                {hideLsiColumn ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {hideLsiColumn ? 'Show' : 'Hide'} LSI
              </button>


              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium text-[14px]"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>


          {/* Tab Content */}
          {activeTab === 'period' && (
            <div className="flex flex-wrap items-center gap-6 px-4">
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                <label className="text-sm font-semibold text-gray-600">
                  Year
                </label>
                <select
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 bg-white shadow-inner focus:outline-none focus:ring-2 focus:ring-teal-400 min-w-[120px]"
                  value={selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                >
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>


              {selectedYear !== 'All' && (
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 shadow-sm flex-1 min-w-[420px]">
                  <label className="text-sm font-semibold text-gray-600 whitespace-nowrap">
                    Month
                  </label>


                  <div className="flex gap-2 flex-wrap justify-center">
                    <button
                      onClick={() => setSelectedMonth('All')}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${selectedMonth === 'All'
                        ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md scale-105'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-teal-300 hover:shadow-sm'
                        }`}
                    >
                      All
                    </button>


                    {ALL_MONTHS.map(month => {
                      const isAvailable = availableMonths.includes(month);
                      return (
                        <button
                          key={month}
                          onClick={() => isAvailable && setSelectedMonth(month)}
                          disabled={!isAvailable}
                          className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${selectedMonth === month
                            ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md scale-105'
                            : isAvailable
                              ? 'bg-white text-gray-700 border border-gray-200 hover:border-teal-300 hover:shadow-sm'
                              : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-50'
                            }`}
                        >
                          {month}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-teal-50 border-2 border-teal-200 rounded-lg px-4 py-2">
                <span className="text-sm font-bold text-teal-700">
                  Showing: {getPeriodLabel()}
                </span>
              </div>
            </div>
          )}


          {activeTab === 'dateRange' && (
            <div className="px-6 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                    From Date:
                  </label>
                  <input
                    type="date"
                    className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-[14px]
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    value={filters.fromDate}
                    min={minDateForInput}
                    max={maxDateForInput}
                    onChange={(e) =>
                      setFilters(prev => ({ ...prev, fromDate: e.target.value }))
                    }
                  />
                </div>


                <div className="flex items-center gap-2">
                  <label className="text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                    To Date:
                  </label>
                  <input
                    type="date"
                    className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-[14px]
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    value={filters.toDate}
                    min={filters.fromDate || minDateForInput}
                    max={maxDateForInput}
                    onChange={(e) =>
                      setFilters(prev => ({ ...prev, toDate: e.target.value }))
                    }
                  />
                </div>
              </div>


              {filters.fromDate && filters.toDate && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg px-4 py-2 inline-block">
                  <span className="text-sm font-bold text-blue-700">
                    Showing: {convertToStorageFormat(filters.fromDate)} → {convertToStorageFormat(filters.toDate)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 lg:p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-lg font-semibold text-slate-700 mb-2">No orders found</p>
            <p className="text-[15px] text-slate-500">Try adjusting your filters to see results</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-4 text-left text-[13px] font-bold text-slate-700 uppercase tracking-wider">Order ID</th>
                    {!hideLsiColumn && (
                      <th className="px-4 py-4 text-left text-[13px] font-bold text-slate-700 uppercase tracking-wider">LSI ID</th>
                    )}
                    <th className="px-4 py-4 text-left text-[13px] font-bold text-slate-700 uppercase tracking-wider">End A</th>
                    <th className="px-4 py-4 text-left text-[13px] font-bold text-slate-700 uppercase tracking-wider">End B</th>
                    <th className="px-4 py-4 text-left text-[13px] font-bold text-slate-700 uppercase tracking-wider">Company</th>
                    <th className="px-4 py-4 text-left text-[13px] font-bold text-slate-700 uppercase tracking-wider">State</th>
                    <th className="px-4 py-4 text-right text-[13px] font-bold text-slate-700 uppercase tracking-wider">Balance</th>
                    <th className="px-4 py-4 text-center text-[13px] font-bold text-slate-700 uppercase tracking-wider">Split</th>
                    <th className="px-4 py-4 text-left text-[13px] font-bold text-slate-700 uppercase tracking-wider">Service Period</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const splitBilling = shouldSplitBilling(order);


                    return splitBilling ? (
                      <React.Fragment key={order.id}>
                        <TableRow
                          order={order}
                          hideLsiColumn={hideLsiColumn}
                          splitFactor={2}
                          stateToShow={order.billing1?.state}
                          onViewBreakdown={setSelectedBreakdown}
                        />
                        <TableRow
                          order={order}
                          hideLsiColumn={hideLsiColumn}
                          splitFactor={2}
                          stateToShow={order.billing2?.state}
                          onViewBreakdown={setSelectedBreakdown}
                        />
                      </React.Fragment>
                    ) : (
                      <TableRow
                        key={order.id}
                        order={order}
                        hideLsiColumn={hideLsiColumn}
                        splitFactor={1}
                        onViewBreakdown={setSelectedBreakdown}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


export default BillingReportComp;
