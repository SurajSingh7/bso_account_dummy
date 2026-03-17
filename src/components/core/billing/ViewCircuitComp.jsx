"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Eye, Plus, Search, Filter, X, ChevronDown, Edit2, Info } from 'lucide-react';
import { Suspense } from 'react';

// --- CONSTANTS & CONFIG ---
const ENTITIES   = ["WIBRO", "GTEL", "GISPL"];
const PRODUCTS   = ["ILL", "NLD", "DIA"];
const STATUSES   = ["PCD", "Terminate"];
const ORDER_TYPES= ["NEW-ORDER", "UPGRADE", "DOWNGRADE"];
const BSO_OPTIONS= ["Airtel", "Tata", "Vodafone"];

export const INDIAN_STATES = [
  { key: "AP", name: "Andhra Pradesh",          code: "28" },
  { key: "AR", name: "Arunachal Pradesh",        code: "12" },
  { key: "AS", name: "Assam",                    code: "18" },
  { key: "BR", name: "Bihar",                    code: "10" },
  { key: "CG", name: "Chhattisgarh",             code: "22" },
  { key: "GA", name: "Goa",                      code: "30" },
  { key: "GJ", name: "Gujarat",                  code: "24" },
  { key: "HR", name: "Haryana",                  code: "06" },
  { key: "HP", name: "Himachal Pradesh",         code: "02" },
  { key: "JH", name: "Jharkhand",                code: "20" },
  { key: "KA", name: "Karnataka",                code: "29" },
  { key: "KL", name: "Kerala",                   code: "32" },
  { key: "MP", name: "Madhya Pradesh",           code: "23" },
  { key: "MH", name: "Maharashtra",              code: "27" },
  { key: "MN", name: "Manipur",                  code: "14" },
  { key: "ML", name: "Meghalaya",                code: "17" },
  { key: "MZ", name: "Mizoram",                  code: "15" },
  { key: "NL", name: "Nagaland",                 code: "13" },
  { key: "OD", name: "Odisha",                   code: "21" },
  { key: "PB", name: "Punjab",                   code: "03" },
  { key: "RJ", name: "Rajasthan",                code: "08" },
  { key: "SK", name: "Sikkim",                   code: "11" },
  { key: "TN", name: "Tamil Nadu",               code: "33" },
  { key: "TS", name: "Telangana",                code: "36" },
  { key: "TR", name: "Tripura",                  code: "16" },
  { key: "UP", name: "Uttar Pradesh",            code: "09" },
  { key: "UK", name: "Uttarakhand",              code: "05" },
  { key: "WB", name: "West Bengal",              code: "19" },
  { key: "DL", name: "Delhi",                    code: "07" },
  { key: "JK", name: "Jammu & Kashmir",          code: "01" },
  { key: "LA", name: "Ladakh",                   code: "38" },
  { key: "CH", name: "Chandigarh",               code: "04" },
  { key: "DN", name: "Dadra & Nagar Haveli and Daman & Diu", code: "26" },
  { key: "LD", name: "Lakshadweep",              code: "31" },
  { key: "AN", name: "Andaman & Nicobar Islands",code: "35" },
  { key: "PY", name: "Puducherry",               code: "34" },
];

const ALL_MONTHS  = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const getCurrentYear  = () => new Date().getFullYear();
const getCurrentMonth = () => new Date().getMonth();
const getCurrentDay   = () => new Date().getDate();
const YEAR_OPTIONS    = ["All", ...Array.from({ length: 8 }, (_, i) => getCurrentYear() - i)];

const getAvailableMonths = (selectedYear) => {
  if (selectedYear === getCurrentYear()) return ALL_MONTHS.slice(0, getCurrentMonth() + 1);
  return ALL_MONTHS;
};

const getDefaultDateRange = () => {
  const year  = getCurrentYear();
  const month = getCurrentMonth() + 1;
  const day   = getCurrentDay();
  return {
    fromDate: `${year}-01-01`,
    toDate:   `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
  };
};

// --- UTILITY FUNCTIONS ---
const convertDateForStorage = (inputDate) => {
  if (!inputDate) return '';
  const [year, month, day] = inputDate.split('-');
  return `${day}-${month}-${year}`;
};
const convertDateForInput = (storedDate) => {
  if (!storedDate) return '';
  try {
    if (storedDate.includes('T') || storedDate.includes('Z') || storedDate.length > 10) {
      const d = new Date(storedDate);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
    if (storedDate.includes('-') && storedDate.split('-')[0].length === 4) return storedDate;
    const [dd, mm, yyyy] = storedDate.split('-');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
};

const formatDateToDisplay = (storedDate) => {
  if (!storedDate) return '';
  try {
    const d = new Date(storedDate);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}-${month}-${d.getFullYear()}`;
    }
  } catch(e) { console.error(e); }
  return storedDate;
};

const parseStoredDate = (storedDate) => {
  if (!storedDate) return null;
  try {
    if (storedDate.includes('T') || storedDate.includes('Z') || storedDate.length > 10) {
      const d = new Date(storedDate);
      if (!isNaN(d.getTime())) return d;
    }
    if (storedDate.includes('-') && storedDate.split('-')[0].length <= 2) {
      const [day, month, year] = storedDate.split('-');
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
    if (storedDate.includes('-') && storedDate.split('-')[0].length === 4) {
      const d = new Date(storedDate);
      if (!isNaN(d.getTime())) return d;
    }
  } catch { return null; }
  return null;
};

// ─── Info Tooltip ────────────────────────────────────────────────────────────
const InfoTooltip = ({ formula }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-1">
      <Info className="w-5 h-5 text-blue-500 cursor-help inline"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)} />
      {show && (
        <div className="absolute z-50 p-2.5 text-sm font-semibold text-white bg-gray-800 rounded-lg shadow-lg -top-10 left-0 min-w-[150px] whitespace-nowrap">
          {formula}
          <div className="absolute w-2 h-2 bg-gray-800 transform rotate-45 -bottom-1 left-2" />
        </div>
      )}
    </div>
  );
};

// ─── Split Factor Form ────────────────────────────────────────────────────────
const SplitFactorForm = ({ splitFactor, onChange, billing1State, billing2State, isNLD }) => {
  const areStatesDifferent = isNLD && billing1State && billing2State && billing1State !== billing2State;
  if (!areStatesDifferent) return null;

  const handlePercentageChange = (field, value) => {
    const numValue = parseFloat(value) || 0;
    const otherField = field === 'state1Percentage' ? 'state2Percentage' : 'state1Percentage';
    onChange({ ...splitFactor, [field]: numValue, [otherField]: 100 - numValue });
  };

  return (
    <div className="border border-amber-300 p-5 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50">
      <h3 className="font-semibold text-gray-900 mb-4 text-base uppercase flex items-center gap-2">
        <span className="text-amber-600">📊</span> Split Factor Details
        <span className="text-sm font-normal text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
          NLD - Different States Detected
        </span>
      </h3>
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-blue-900">
            ℹ️ Since billing states are different ({billing1State} &amp; {billing2State}),
            the amount will be split. Please specify the percentage for each state.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 block">
              {billing1State} - State 1 (%)
            </label>
            <input type="number" value={splitFactor.state1Percentage}
              onChange={(e) => handlePercentageChange('state1Percentage', e.target.value)}
              className="input-field bg-green-50 font-semibold text-lg"
              placeholder="40" step="0.01" min="0" max="100" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 block">
              {billing2State} - State 2 (%)
            </label>
            <input type="number" value={splitFactor.state2Percentage}
              onChange={(e) => handlePercentageChange('state2Percentage', e.target.value)}
              className="input-field bg-blue-50 font-semibold text-lg"
              placeholder="60" step="0.01" min="0" max="100" />
          </div>
        </div>
        {Math.abs(splitFactor.state1Percentage + splitFactor.state2Percentage - 100) > 0.01 && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-3">
            <p className="text-sm font-semibold text-red-700">
              ⚠️ Total must equal 100%. Current: {(splitFactor.state1Percentage + splitFactor.state2Percentage).toFixed(2)}%
            </p>
          </div>
        )}
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-600 mb-2">Split Summary:</p>
          <div className="grid grid-cols-2 gap-4 text-sm font-semibold">
            <div className="flex justify-between">
              <span className="text-gray-700">{billing1State}:</span>
              <span className="text-green-600 font-bold">{splitFactor.state1Percentage}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">{billing2State}:</span>
              <span className="text-blue-600 font-bold">{splitFactor.state2Percentage}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Billing Address Popup ───────────────────────────────────────────────────
const BillingPopup = ({ billing, onClose }) => {
  if (!billing) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md m-4 border border-gray-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-gray-50">
          <h3 className="text-xl font-semibold text-gray-900">Billing Address</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg"><X className="w-5 h-5 text-gray-600" /></button>
        </div>
        <div className="p-6 space-y-4">
          {[['Address', billing.address], ['Area', billing.area], ['City', billing.city],
            ['Pincode', billing.pincode], ['State', billing.state], ['State Code', billing.stateCode]].map(([label, value]) => (
            <div key={label}>
              <p className="text-sm font-semibold text-gray-500 uppercase mb-1">{label}</p>
              <p className="text-base font-semibold text-gray-900">{value || '-'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── End Address Popup ───────────────────────────────────────────────────────
const EndAddressPopup = ({ endLabel, endAddress, onClose }) => {
  if (!endAddress) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md m-4 border border-gray-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-gray-50">
          <h3 className="text-xl font-semibold text-gray-900">{endLabel} Address</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg"><X className="w-5 h-5 text-gray-600" /></button>
        </div>
        <div className="p-6">
          <p className="text-base font-semibold text-gray-900 leading-relaxed">{endAddress}</p>
        </div>
      </div>
    </div>
  );
};

const CompanyNamePopup = ({ companyName, onClose }) => {
  if (!companyName) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md m-4 border border-gray-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-gray-50">
          <h3 className="text-xl font-semibold text-gray-900">Company Name</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg"><X className="w-5 h-5 text-gray-600" /></button>
        </div>
        <div className="p-6">
          <p className="text-base font-semibold text-gray-900">{companyName}</p>
        </div>
      </div>
    </div>
  );
};

// ─── ViewDetailsModal ────────────────────────────────────────────────────────
const ViewDetailsModal = ({ order, onClose }) => {
  if (!order) return null;
  const gst1 = order.gstDetails1 || order.gstDetails || {};
  const gst2 = order.gstDetails2 || {};
  const isNLD = order.product === 'NLD';
  const diffStates = isNLD && order.billing1?.state && order.billing2?.state &&
    order.billing1.state !== order.billing2.state;
  const showSplitGST = diffStates && order.splitFactor?.isApplicable;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4 border border-gray-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-semibold text-gray-900">Order Details: {order.orderId}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-6 h-6 text-gray-600" /></button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section title="Basic Info">
            <Detail label="Company"       value={order.companyName} />
            <Detail label="Company Group" value={order.companyGroup} />
            <Detail label="Entity"        value={order.entity} />
            <Detail label="Product"       value={order.product} />
            <Detail label="BSO"           value={order.bso} />
            <Detail label="Order Type"    value={order.orderType} />
            <Detail label="Status"        value={order.status} />
            <div className="grid grid-cols-2 gap-3">
              <Detail label="LOC Date"         value={formatDateToDisplay(order.pcdDate)} />
              <Detail label="Termination Date" value={formatDateToDisplay(order.terminateDate)} />
            </div>
          </Section>
          <Section title="Technical Details">
            <Detail label="LSI ID"          value={order.lsiId} />
            <Detail label="Capacity (Mbps)" value={order.capacity} />
            <Detail label="Capacity (Kbps)" value={Number(order.capacity) * 1024} />
          </Section>
          <Section title="Endpoints" className="md:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-semibold text-base text-gray-500 mb-2">End A</p>
                <p className="text-gray-900 text-base font-semibold">{order.endA}</p>
              </div>
              {order.endB && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-semibold text-base text-gray-500 mb-2">End B</p>
                  <p className="text-gray-900 text-base font-semibold">{order.endB}</p>
                </div>
              )}
            </div>
          </Section>
          <Section title="Billing Details" className="md:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BillingBlock title={isNLD ? "Billing 1" : "Billing Address"} data={order.billing1} />
              {isNLD && <BillingBlock title="Billing 2" data={order.billing2} />}
            </div>
          </Section>

          {showSplitGST ? (
            <>
              <GSTViewSection title={`GST Details – ${order.billing1.state} (State 1)`} gst={gst1} className="md:col-span-1" />
              <GSTViewSection title={`GST Details – ${order.billing2.state} (State 2)`} gst={gst2} className="md:col-span-1" />
            </>
          ) : (
            <GSTViewSection title="GST Details" gst={gst1} className="md:col-span-2" />
          )}

          <Section title="Financials" className="md:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Detail label="Rate / Mbps" value={`₹${order.amount}`} />
              <Detail label="Total Base"  value={`₹${order.amount * order.capacity}`} />
              <Detail label="GST (18%)"   value={`₹${(order.amount * order.capacity * 0.18).toFixed(2)}`} />
              <Detail label="Grand Total" value={`₹${(order.amount * order.capacity * 1.18).toFixed(2)}`} />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
};

const GSTViewSection = ({ title, gst, className = "" }) => (
  <Section title={title} className={className}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Detail label="Transaction Type" value={gst.isSelfGST ? "Intra-state (Same State)" : "Inter-state (Different State)"} />
      <Detail label="GST State"        value={gst.gstState} />
      <Detail label="GST State Code"   value={gst.gstStateCode} />
      {gst.isSelfGST ? (
        <>
          <Detail label="CGST (%)"      value={gst.cgst} />
          <Detail label="SGST (%)"      value={gst.sgst} />
          <Detail label="Total GST (%)" value={((gst.cgst || 0) + (gst.sgst || 0)).toFixed(2)} />
        </>
      ) : (
        <Detail label="IGST (%)" value={gst.igst} />
      )}
    </div>
  </Section>
);

const Section = ({ title, children, className = "" }) => (
  <div className={`border border-gray-200 p-5 rounded-lg bg-gray-50 ${className}`}>
    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 pb-2 border-b border-gray-200">{title}</h3>
    <div className="space-y-3">{children}</div>
  </div>
);
const Detail = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</span>
    <span className="font-semibold text-gray-900 text-base">{value ?? '-'}</span>
  </div>
);
const BillingBlock = ({ title, data }) => (
  <div className="bg-white p-4 rounded-lg border border-gray-200">
    <p className="font-semibold text-sm text-blue-600 mb-2 uppercase">{title}</p>
    <p className="text-base font-semibold text-gray-700">{data?.address}, {data?.area}</p>
    <p className="text-base font-semibold text-gray-600 mt-1">{data?.city}, {data?.state} - {data?.pincode}</p>
    <p className="text-base font-semibold text-gray-600 mt-1">State Code: {data?.stateCode || '-'}</p>
  </div>
);

// ─── GSTDetailsForm ──────────────────────────────────────────────────────────
const GSTDetailsForm = ({ gstDetails, onChange, title = "GST Details", stateTag = null }) => {
  const handleRadioChange = (value) => {
    const isSelfGST = value === 'yes';
    onChange({
      ...gstDetails,
      isSelfGST,
      igst: isSelfGST ? 0 : 18,
      cgst: isSelfGST ? 9 : 0,
      sgst: isSelfGST ? 9 : 0,
    });
  };

  const handleStateChange = (e) => {
    const selectedStateName = e.target.value;
    const selectedState = INDIAN_STATES.find(s => s.name === selectedStateName);
    onChange({ ...gstDetails, gstState: selectedStateName, gstStateCode: selectedState ? selectedState.code : '' });
  };

  return (
    <div className="border border-gray-200 p-5 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
      <h3 className="font-semibold text-gray-900 mb-4 text-base uppercase flex items-center gap-2">
        <span className="text-blue-600">📋</span> {title}
        {stateTag && (
          <span className="text-sm font-normal text-blue-700 bg-blue-100 px-3 py-1 rounded-full">{stateTag}</span>
        )}
      </h3>
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
            Same State Transaction (Self GST)?
          </label>
          <div className="flex gap-6">
            {[['yes','Yes (Intra-state - CGST + SGST)'],['no','No (Inter-state - IGST)']].map(([val, label]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={`isSelfGST-${title}`} value={val}
                  checked={val === 'yes' ? gstDetails.isSelfGST === true : gstDetails.isSelfGST === false}
                  onChange={() => handleRadioChange(val)}
                  className="w-5 h-5 text-blue-600" />
                <span className="text-base font-semibold text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {!gstDetails.isSelfGST && (
            <div className="md:col-span-3">
              <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 block">IGST (%)</label>
              <input type="number" value={gstDetails.igst}
                onChange={e => onChange({ ...gstDetails, igst: parseFloat(e.target.value) || 0 })}
                className="input-field bg-blue-50 font-semibold" placeholder="18" step="0.01" min="0" max="100" />
            </div>
          )}
          {gstDetails.isSelfGST && (
            <>
              <div>
                <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 block">CGST (%)</label>
                <input type="number" value={gstDetails.cgst}
                  onChange={e => onChange({ ...gstDetails, cgst: parseFloat(e.target.value) || 0 })}
                  className="input-field bg-green-50 font-semibold" placeholder="9" step="0.01" min="0" max="100" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 block">SGST (%)</label>
                <input type="number" value={gstDetails.sgst}
                  onChange={e => onChange({ ...gstDetails, sgst: parseFloat(e.target.value) || 0 })}
                  className="input-field bg-green-50 font-semibold" placeholder="9" step="0.01" min="0" max="100" />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 block">GST State</label>
            <select value={gstDetails.gstState} onChange={handleStateChange} className="input-field font-semibold">
              <option value="">Select GST State</option>
              {INDIAN_STATES.map(s => <option key={s.key} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 block">GST State Code</label>
            <input type="text" value={gstDetails.gstStateCode} readOnly
              className="input-field bg-gray-100 cursor-not-allowed font-semibold" placeholder="Auto-filled" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-600 mb-2">GST Summary:</p>
          {gstDetails.isSelfGST ? (
            <div className="text-sm font-semibold text-gray-700">
              <span className="text-green-600">Intra-state:</span> CGST {gstDetails.cgst}% + SGST {gstDetails.sgst}% = Total {((gstDetails.cgst||0)+(gstDetails.sgst||0)).toFixed(2)}%
            </div>
          ) : (
            <div className="text-sm font-semibold text-gray-700">
              <span className="text-blue-600">Inter-state:</span> IGST {gstDetails.igst}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── CreateOrderForm ─────────────────────────────────────────────────────────
const defaultBilling = () => ({ address:'',area:'',city:'',pincode:'',state:'',stateCode:'' });
const defaultGST     = () => ({ isSelfGST:false, igst:18, cgst:0, sgst:0, gstState:'', gstStateCode:'' });
const defaultSplit   = () => ({ isApplicable:false, state1Percentage:50, state2Percentage:50 });

const CreateOrderForm = ({ onAddOrder }) => {
  const [formData, setFormData] = useState({
    product: 'ILL', endA:'', endB:'',
    billing1: defaultBilling(), billing2: defaultBilling(),
    gstDetails1: defaultGST(), gstDetails2: defaultGST(),
    splitFactor: defaultSplit(),
    orderId:'', companyName:'', companyGroup:'',
    entity: ENTITIES[0], bso: '', capacity:'', lsiId:'', amount:'',
    status: STATUSES[0], orderType: ORDER_TYPES[0],
    pcdDate:'', terminateDate:'',
  });

  const isNLD = formData.product === 'NLD';
  const showEndB = ['ILL','NLD'].includes(formData.product);
  const areStatesDifferent = isNLD && formData.billing1.state && formData.billing2.state &&
    formData.billing1.state !== formData.billing2.state;

  const handleBillingChange = (e, section, field) => {
    const value = e.target.value;
    if (field === 'state') {
      const s = INDIAN_STATES.find(st => st.name === value);
      setFormData(prev => ({ ...prev, [section]: { ...prev[section], state: value, stateCode: s ? s.code : '' } }));
    } else {
      setFormData(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
    }
  };

  const handleInputChange = (e, section = null, field = null) => {
    if (section) { handleBillingChange(e, section, field); }
    else { setFormData(prev => ({ ...prev, [e.target.name]: e.target.value })); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.companyName || !formData.orderId) return alert("Please fill required fields");
    if (formData.pcdDate && formData.terminateDate) {
      if (new Date(formData.pcdDate) >= new Date(formData.terminateDate))
        return alert("loc Date must be earlier than Termination Date");
    }
    if (areStatesDifferent) {
      const total = formData.splitFactor.state1Percentage + formData.splitFactor.state2Percentage;
      if (Math.abs(total - 100) > 0.01) return alert("Split factor percentages must total 100%");
    }

    const payload = {
      ...formData,
      pcdDate:       convertDateForStorage(formData.pcdDate),
      terminateDate: convertDateForStorage(formData.terminateDate),
      splitFactor: { ...formData.splitFactor, isApplicable: areStatesDifferent },
      gstDetails: formData.gstDetails1,
    };
    onAddOrder(payload);
    setFormData({
      product:'ILL', endA:'', endB:'',
      billing1: defaultBilling(), billing2: defaultBilling(),
      gstDetails1: defaultGST(), gstDetails2: defaultGST(),
      splitFactor: defaultSplit(),
      orderId:'', companyName:'', companyGroup:'',
      entity: ENTITIES[0], bso: '', capacity:'', lsiId:'', amount:'',
      status: STATUSES[0], orderType: ORDER_TYPES[0],
      pcdDate:'', terminateDate:'',
    });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md mb-6 border border-gray-200">
      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3 text-gray-900">
        <div className="p-2.5 bg-blue-600 rounded-lg"><Plus className="w-6 h-6 text-white" /></div>
        Create New Order
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Row 1: product / entity / bso / orderType / status */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <InputGroup label="Product">
            <select name="product" value={formData.product} onChange={handleInputChange} className="input-field">
              {PRODUCTS.map(p => <option key={p}>{p}</option>)}
            </select>
          </InputGroup>
          <InputGroup label="Entity">
            <select name="entity" value={formData.entity} onChange={handleInputChange} className="input-field">
              {ENTITIES.map(e => <option key={e}>{e}</option>)}
            </select>
          </InputGroup>
          <InputGroup label="BSO">
            <select name="bso" value={formData.bso} onChange={handleInputChange} className="input-field">
              <option value="">Select BSO</option>
              {BSO_OPTIONS.map(b => <option key={b}>{b}</option>)}
            </select>
          </InputGroup>
          <InputGroup label="Order Type">
            <select name="orderType" value={formData.orderType} onChange={handleInputChange} className="input-field">
              {ORDER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </InputGroup>
          <InputGroup label="Status">
            <select name="status" value={formData.status} onChange={handleInputChange} className="input-field">
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </InputGroup>
        </div>

        {/* Row 2: ids */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <InputGroup label="Order ID"><input type="text" name="orderId" value={formData.orderId} onChange={handleInputChange} className="input-field" required /></InputGroup>
          <InputGroup label="Company Name"><input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} className="input-field" required /></InputGroup>
          <InputGroup label="Company Group"><input type="text" name="companyGroup" value={formData.companyGroup} onChange={handleInputChange} className="input-field" /></InputGroup>
          <InputGroup label="LSI ID"><input type="text" name="lsiId" value={formData.lsiId} onChange={handleInputChange} className="input-field" /></InputGroup>
        </div>

        {/* Row 3: dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup label="lOC Date"><input type="date" name="pcdDate" value={formData.pcdDate} onChange={handleInputChange} className="input-field" /></InputGroup>
          <InputGroup label="Termination Date"><input type="date" name="terminateDate" value={formData.terminateDate} onChange={handleInputChange} className="input-field" /></InputGroup>
        </div>

        {/* Row 4: capacity / amount */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputGroup label="Capacity (Mbps)"><input type="number" name="capacity" value={formData.capacity} onChange={handleInputChange} className="input-field" /></InputGroup>
          <InputGroup label="Amount (Per Mbps/Month)"><input type="number" name="amount" value={formData.amount} onChange={handleInputChange} className="input-field" /></InputGroup>
        </div>

        {/* Endpoints */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-gray-50 rounded-lg border border-gray-200">
          <InputGroup label="End A Address"><textarea name="endA" value={formData.endA} onChange={handleInputChange} className="input-field h-24 resize-none" /></InputGroup>
          {showEndB && <InputGroup label="End B Address"><textarea name="endB" value={formData.endB} onChange={handleInputChange} className="input-field h-24 resize-none" /></InputGroup>}
        </div>

        {/* Billing */}
        <div className="space-y-4">
          <BillingForm title={isNLD ? "Billing Details 1" : "Billing Details"} data={formData.billing1}
            onChange={(e,field) => handleInputChange(e,'billing1',field)} />
          {isNLD && <BillingForm title="Billing Details 2" data={formData.billing2}
            onChange={(e,field) => handleInputChange(e,'billing2',field)} />}
        </div>

        {/* GST Details */}
        {areStatesDifferent ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-amber-700 font-semibold text-sm">
                📋 NLD with different states detected — please fill GST details for each state separately.
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GSTDetailsForm
                gstDetails={formData.gstDetails1}
                onChange={v => setFormData(prev => ({ ...prev, gstDetails1: v }))}
                title="GST Details – State 1"
                stateTag={formData.billing1.state}
              />
              <GSTDetailsForm
                gstDetails={formData.gstDetails2}
                onChange={v => setFormData(prev => ({ ...prev, gstDetails2: v }))}
                title="GST Details – State 2"
                stateTag={formData.billing2.state}
              />
            </div>
          </div>
        ) : (
          <GSTDetailsForm
            gstDetails={formData.gstDetails1}
            onChange={v => setFormData(prev => ({ ...prev, gstDetails1: v }))}
            title="GST Details"
          />
        )}

        {/* Split factor */}
        <SplitFactorForm
          splitFactor={formData.splitFactor}
          onChange={v => setFormData(prev => ({ ...prev, splitFactor: v }))}
          billing1State={formData.billing1.state}
          billing2State={formData.billing2.state}
          isNLD={isNLD}
        />

        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-lg transition-colors shadow-sm text-base">
          Create Order
        </button>
      </form>
    </div>
  );
};

const BillingForm = ({ title, data, onChange }) => (
  <div className="border border-gray-200 p-5 rounded-lg bg-gray-50">
    <h3 className="font-semibold text-gray-900 mb-4 text-base uppercase">{title}</h3>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <input placeholder="Complete Address" value={data.address} onChange={e => onChange(e,'address')} className="input-field md:col-span-3" />
      <input placeholder="Area"    value={data.area}    onChange={e => onChange(e,'area')}    className="input-field" />
      <input placeholder="City"    value={data.city}    onChange={e => onChange(e,'city')}    className="input-field" />
      <input placeholder="Pincode" value={data.pincode} onChange={e => onChange(e,'pincode')} className="input-field" />
      <select value={data.state} onChange={e => onChange(e,'state')} className="input-field">
        <option value="">Select State</option>
        {INDIAN_STATES.map(s => <option key={s.key} value={s.name}>{s.name}</option>)}
      </select>
      <input placeholder="State Code" value={data.stateCode} readOnly
        className="input-field bg-gray-100 cursor-not-allowed" />
    </div>
  </div>
);

const InputGroup = ({ label, children }) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

// ─── ReadOnlyField ────────────────────────────────────────────────────────────
const ReadOnlyField = ({ label, value }) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
    <div className="input-field bg-gray-100 cursor-not-allowed text-gray-600 font-semibold border border-gray-200 rounded-lg px-3 py-2.5 min-h-[42px] flex items-center">
      {value || <span className="text-gray-400 italic">—</span>}
    </div>
  </div>
);

// ─── ReadOnlyBillingBlock ────────────────────────────────────────────────────
const ReadOnlyBillingBlock = ({ title, data }) => (
  <div className="border border-gray-200 p-5 rounded-lg bg-gray-50">
    <h3 className="font-semibold text-gray-700 mb-4 text-base uppercase flex items-center gap-2">
      {title}
      <span className="text-xs font-normal text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full normal-case">Read only</span>
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-3">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Complete Address</label>
        <div className="input-field bg-gray-100 cursor-not-allowed text-gray-600 font-semibold border border-gray-200 rounded-lg px-3 py-2.5 min-h-[42px]">
          {data?.address || <span className="text-gray-400 italic">—</span>}
        </div>
      </div>
      {[['Area', data?.area], ['City', data?.city], ['Pincode', data?.pincode]].map(([lbl, val]) => (
        <div key={lbl}>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{lbl}</label>
          <div className="input-field bg-gray-100 cursor-not-allowed text-gray-600 font-semibold border border-gray-200 rounded-lg px-3 py-2.5 min-h-[42px] flex items-center">
            {val || <span className="text-gray-400 italic">—</span>}
          </div>
        </div>
      ))}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">State</label>
        <div className="input-field bg-gray-100 cursor-not-allowed text-gray-600 font-semibold border border-gray-200 rounded-lg px-3 py-2.5 min-h-[42px] flex items-center">
          {data?.state || <span className="text-gray-400 italic">—</span>}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">State Code</label>
        <div className="input-field bg-gray-100 cursor-not-allowed text-gray-600 font-semibold border border-gray-200 rounded-lg px-3 py-2.5 min-h-[42px] flex items-center">
          {data?.stateCode || <span className="text-gray-400 italic">—</span>}
        </div>
      </div>
    </div>
  </div>
);

// ─── ReadOnlyGSTBlock ────────────────────────────────────────────────────────
const ReadOnlyGSTBlock = ({ title, gst, stateTag }) => (
  <div className="border border-gray-200 p-5 rounded-lg bg-gray-50">
    <h3 className="font-semibold text-gray-700 mb-4 text-base uppercase flex items-center gap-2">
      <span className="text-blue-400">📋</span> {title}
      {stateTag && <span className="text-sm font-normal text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{stateTag}</span>}
      <span className="text-xs font-normal text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full normal-case">Read only</span>
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ReadOnlyField label="Transaction Type" value={gst?.isSelfGST ? "Intra-state (CGST + SGST)" : "Inter-state (IGST)"} />
      <ReadOnlyField label="GST State" value={gst?.gstState} />
      <ReadOnlyField label="GST State Code" value={gst?.gstStateCode} />
      {gst?.isSelfGST ? (
        <>
          <ReadOnlyField label="CGST (%)" value={gst?.cgst} />
          <ReadOnlyField label="SGST (%)" value={gst?.sgst} />
          <ReadOnlyField label="Total GST (%)" value={((gst?.cgst || 0) + (gst?.sgst || 0)).toFixed(2)} />
        </>
      ) : (
        <ReadOnlyField label="IGST (%)" value={gst?.igst} />
      )}
    </div>
  </div>
);

// ─── EditOrderModal ──────────────────────────────────────────────────────────
const EditOrderModal = ({ order, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    ...order,
    pcdDate:       convertDateForInput(order.pcdDate),
    terminateDate: convertDateForInput(order.terminateDate),
    gstDetails1: order.gstDetails1 || order.gstDetails || defaultGST(),
    gstDetails2: order.gstDetails2 || defaultGST(),
    splitFactor: order.splitFactor || defaultSplit(),
    bso: order.bso || '',
  });

  if (!order) return null;

  const isNLD = formData.product === 'NLD';
  const showEndB = ['ILL','NLD'].includes(formData.product);
  const areStatesDifferent = isNLD && formData.billing1?.state && formData.billing2?.state &&
    formData.billing1.state !== formData.billing2.state;
  const isSplitApplicable = areStatesDifferent && formData.splitFactor?.isApplicable;

  const handleSave = () => {
    if (formData.pcdDate && formData.terminateDate) {
      if (new Date(formData.pcdDate) >= new Date(formData.terminateDate))
        return alert("PCD Date must be earlier than Termination Date");
    }
    // CHANGED: validate split factor if applicable
    if (areStatesDifferent) {
      const total = formData.splitFactor.state1Percentage + formData.splitFactor.state2Percentage;
      if (Math.abs(total - 100) > 0.01) return alert("Split factor percentages must total 100%");
    }
    onSave({
      ...formData,
      pcdDate:       convertDateForStorage(formData.pcdDate),
      terminateDate: convertDateForStorage(formData.terminateDate),
      splitFactor: { ...formData.splitFactor, isApplicable: areStatesDifferent },
      gstDetails: formData.gstDetails1,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4 border border-gray-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Edit Order: {order.orderId}</h2>
            {/* CHANGED: updated subtitle */}
            <p className="text-sm text-gray-500 font-semibold mt-1">
              Only <span className="text-blue-600 font-bold">LOC Date</span>, <span className="text-blue-600 font-bold">Termination Date</span>, <span className="text-blue-600 font-bold">Capacity</span> and <span className="text-blue-600 font-bold">Amount</span> are editable.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-6 h-6 text-gray-600" /></button>
        </div>

        <div className="p-6 space-y-5">

          {/* ── Editable: Dates + Capacity + Amount ── CHANGED: added capacity & amount here */}
          <div className="border-2 border-blue-200 bg-blue-50 p-5 rounded-lg">
            <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full inline-block"></span>
              Editable Fields
            </h3>
            {/* CHANGED: grid-cols-4 to fit all 4 editable fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <InputGroup label="LOC Date">
                <input
                  type="date"
                  name="pcdDate"
                  value={formData.pcdDate}
                  onChange={e => setFormData(prev => ({ ...prev, pcdDate: e.target.value }))}
                  className="input-field border-blue-400 focus:ring-blue-300 bg-white"
                />
              </InputGroup>
              <InputGroup label="Termination Date">
                <input
                  type="date"
                  name="terminateDate"
                  value={formData.terminateDate}
                  onChange={e => setFormData(prev => ({ ...prev, terminateDate: e.target.value }))}
                  className="input-field border-blue-400 focus:ring-blue-300 bg-white"
                />
              </InputGroup>
              {/* CHANGED: Capacity now editable */}
              <InputGroup label="Capacity (Mbps)">
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={e => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                  className="input-field border-blue-400 focus:ring-blue-300 bg-white"
                />
              </InputGroup>
              {/* CHANGED: Amount now editable */}
              <InputGroup label="Amount (Per Mbps/Month)">
                <input
                  type="number"
                  value={formData.amount}
                  onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="input-field border-blue-400 focus:ring-blue-300 bg-white"
                />
              </InputGroup>
            </div>
          </div>

          {/* ── Read-only section header ── */}
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Read-only fields</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* ── Read-only: Row 1 – product / entity / bso / orderType / status ── */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <ReadOnlyField label="Product"    value={formData.product} />
            <ReadOnlyField label="Entity"     value={formData.entity} />
            <ReadOnlyField label="BSO"        value={formData.bso} />
            <ReadOnlyField label="Order Type" value={formData.orderType} />
            <ReadOnlyField label="Status"     value={formData.status} />
          </div>

          {/* ── Read-only: Row 2 – ids ── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ReadOnlyField label="Order ID"      value={formData.orderId} />
            <ReadOnlyField label="Company Name"  value={formData.companyName} />
            <ReadOnlyField label="Company Group" value={formData.companyGroup} />
            <ReadOnlyField label="LSI ID"        value={formData.lsiId} />
          </div>

          {/* ── Read-only: Endpoints ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-500 uppercase tracking-wide">End A Address</label>
              <div className="input-field bg-gray-100 cursor-not-allowed text-gray-600 font-semibold border border-gray-200 rounded-lg px-3 py-2.5 min-h-[96px] whitespace-pre-wrap">
                {formData.endA || <span className="text-gray-400 italic">—</span>}
              </div>
            </div>
            {showEndB && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-500 uppercase tracking-wide">End B Address</label>
                <div className="input-field bg-gray-100 cursor-not-allowed text-gray-600 font-semibold border border-gray-200 rounded-lg px-3 py-2.5 min-h-[96px] whitespace-pre-wrap">
                  {formData.endB || <span className="text-gray-400 italic">—</span>}
                </div>
              </div>
            )}
          </div>

          {/* ── Read-only: Billing ── */}
          <div className="space-y-4">
            <ReadOnlyBillingBlock
              title={isNLD ? "Billing Details 1" : "Billing Details"}
              data={formData.billing1}
            />
            {isNLD && (
              <ReadOnlyBillingBlock title="Billing Details 2" data={formData.billing2} />
            )}
          </div>

          {/* ── Read-only: GST Details ── */}
          {areStatesDifferent ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-amber-700 font-semibold text-sm">
                  📋 NLD with different states — GST details shown per state (read only).
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ReadOnlyGSTBlock
                  title="GST Details – State 1"
                  gst={formData.gstDetails1}
                  stateTag={formData.billing1?.state}
                />
                <ReadOnlyGSTBlock
                  title="GST Details – State 2"
                  gst={formData.gstDetails2}
                  stateTag={formData.billing2?.state}
                />
              </div>
            </div>
          ) : (
            <ReadOnlyGSTBlock title="GST Details" gst={formData.gstDetails1} />
          )}

          {/* ── CHANGED: Editable Split Factor using SplitFactorForm ── */}
          <SplitFactorForm
            splitFactor={formData.splitFactor}
            onChange={v => setFormData(prev => ({ ...prev, splitFactor: v }))}
            billing1State={formData.billing1?.state}
            billing2State={formData.billing2?.state}
            isNLD={isNLD}
          />

          <div className="flex gap-3 justify-end pt-5 border-t border-gray-200">
            <button onClick={onClose} className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-base">Cancel</button>
            <button onClick={handleSave} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-sm text-base">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── OrderList ────────────────────────────────────────────────────────────────
const OrderList = ({ orders, onView, onEdit, onDelete }) => {
  const defaultDateRange = getDefaultDateRange();
  const [filters, setFilters] = useState({
    company:'', state:'', entity:'', bso:'', statusFilter:'active',
    periodType:'period', selectedYear: getCurrentYear(),
    selectedMonth: ALL_MONTHS[getCurrentMonth()],
    fromDate: defaultDateRange.fromDate, toDate: defaultDateRange.toDate,
  });

  const handleYearChange = (year) => {
    if (year === 'All') {
      setFilters(prev => ({ ...prev, selectedYear: year, selectedMonth: 'All' }));
    } else {
      const y = parseInt(year);
      setFilters(prev => ({
        ...prev, selectedYear: year,
        selectedMonth: y === getCurrentYear() ? ALL_MONTHS[getCurrentMonth()] : 'DEC',
      }));
    }
  };

  const availableMonths = useMemo(() =>
    filters.selectedYear === 'All' ? [] : getAvailableMonths(parseInt(filters.selectedYear)),
    [filters.selectedYear]
  );

  const isAnyFilterActive = () => {
    const d = getDefaultDateRange();
    return filters.company !== '' || filters.state !== '' || filters.entity !== '' || filters.bso !== '' ||
      filters.statusFilter !== 'active' || filters.selectedYear !== getCurrentYear() ||
      filters.selectedMonth !== ALL_MONTHS[getCurrentMonth()] ||
      filters.periodType !== 'period' || filters.fromDate !== d.fromDate || filters.toDate !== d.toDate;
  };

  const handleClearFilters = () => {
    const d = getDefaultDateRange();
    setFilters({ company:'', state:'', entity:'', bso:'', statusFilter:'active', periodType:'period',
      selectedYear: getCurrentYear(), selectedMonth: ALL_MONTHS[getCurrentMonth()],
      fromDate: d.fromDate, toDate: d.toDate });
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchCompany = order.companyName.toLowerCase().includes(filters.company.toLowerCase());
      const matchEntity  = filters.entity ? order.entity === filters.entity : true;
      const matchBso     = filters.bso ? order.bso === filters.bso : true;
      const matchState   = filters.state
        ? (order.billing1?.state?.includes(filters.state) || order.billing2?.state?.includes(filters.state)) : true;
      let matchStatus = true;
      if (filters.statusFilter === 'active') matchStatus = order.status === 'PCD';
      else if (filters.statusFilter === 'inactive') matchStatus = order.status === 'Terminate';

      const relevantDate = (filters.statusFilter === 'inactive' && order.status === 'Terminate')
        ? order.terminateDate : order.pcdDate;
      const orderDate = parseStoredDate(relevantDate);
      let matchDate = true;

      if (orderDate && !isNaN(orderDate.getTime())) {
        const orderYear  = orderDate.getUTCFullYear();
        const orderMonth = orderDate.getUTCMonth();

        if (filters.periodType === 'period') {
          if (filters.selectedYear !== 'All') {
            const y = parseInt(filters.selectedYear);
            if (filters.selectedMonth === 'All') {
              matchDate = orderYear === y;
            } else {
              const m = ALL_MONTHS.indexOf(filters.selectedMonth);
              matchDate = orderYear === y && orderMonth === m;
            }
          }
        } else if (filters.periodType === 'dateRange') {
          if (filters.fromDate && filters.toDate) {
            const [fy, fm, fd] = filters.fromDate.split('-').map(Number);
            const [ty, tm, td] = filters.toDate.split('-').map(Number);
            const from = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0));
            const to   = new Date(Date.UTC(ty, tm - 1, td, 23, 59, 59, 999));
            const orderUTC = Date.UTC(orderYear, orderMonth, orderDate.getUTCDate());
            matchDate = orderUTC >= from.getTime() && orderUTC <= to.getTime();
          }
        }
      }

      return matchCompany && matchEntity && matchBso && matchState && matchStatus && matchDate;
    });
  }, [orders, filters]);

  return (
    <div className="space-y-5">
      {/* Filters bar */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-gray-300 rounded-lg px-4 py-3 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
            <Search className="w-5 h-5 text-gray-400" />
            <input placeholder="Search Company..." className="bg-transparent outline-none text-base font-semibold w-full text-gray-700 placeholder-gray-400"
              value={filters.company} onChange={e => setFilters(prev => ({ ...prev, company: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-gray-300 rounded-lg px-4 py-3 bg-white">
            <Filter className="w-5 h-5 text-gray-400" />
            <select className="bg-transparent outline-none text-base font-semibold w-full text-gray-700"
              value={filters.state} onChange={e => setFilters(prev => ({ ...prev, state: e.target.value }))}>
              <option value="">Filter by State</option>
              {INDIAN_STATES.map(s => <option key={s.key} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className={`flex items-center gap-2 flex-1 min-w-[200px] border rounded-lg px-4 py-3 transition-all ${filters.entity ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-400 ring-2 ring-orange-200' : 'bg-white border-gray-300'}`}>
            <ChevronDown className="w-5 h-5 text-gray-400" />
            <select className="bg-transparent outline-none text-base font-semibold w-full text-gray-700"
              value={filters.entity} onChange={e => setFilters(prev => ({ ...prev, entity: e.target.value }))}>
              <option value="">Filter by Entity</option>
              {ENTITIES.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
          <div className={`flex items-center gap-2 flex-1 min-w-[200px] border rounded-lg px-4 py-3 transition-all ${filters.bso ? 'bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-400 ring-2 ring-teal-200' : 'bg-white border-gray-300'}`}>
            <Filter className="w-5 h-5 text-gray-400" />
            <select className="bg-transparent outline-none text-base font-semibold w-full text-gray-700"
              value={filters.bso} onChange={e => setFilters(prev => ({ ...prev, bso: e.target.value }))}>
              <option value="">Filter by BSO</option>
              {BSO_OPTIONS.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[200px] border border-gray-300 rounded-lg px-4 py-3 bg-white">
            <Filter className="w-5 h-5 text-gray-400" />
            <select className="bg-transparent outline-none text-base font-semibold w-full text-gray-700"
              value={filters.statusFilter} onChange={e => setFilters(prev => ({ ...prev, statusFilter: e.target.value }))}>
              <option value="active">Active (LOC)</option>
              <option value="inactive">Inactive (Terminate)</option>
            </select>
          </div>
          {isAnyFilterActive() && (
            <button onClick={handleClearFilters} className="flex items-center gap-2 px-4 py-3 bg-red-50 border-2 border-red-500 text-red-600 font-semibold rounded-lg hover:bg-red-100 transition-all shadow-sm">
              <X className="w-5 h-5" /> Clear Filter
            </button>
          )}
        </div>
        {/* Period / date range tabs */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            {[['period','Period Selector'],['dateRange','Date Range']].map(([t,label]) => (
              <button key={t} onClick={() => { const d=getDefaultDateRange(); setFilters(prev=>({...prev, periodType:t, fromDate:d.fromDate, toDate:d.toDate})); }}
                className={`px-5 py-2.5 font-semibold text-sm transition-all border-b-2 ${filters.periodType===t ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                {label}
              </button>
            ))}
          </div>
          {filters.periodType === 'period' && (
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                <label className="text-sm font-semibold text-gray-600">Year</label>
                <select className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 bg-white"
                  value={filters.selectedYear} onChange={e => handleYearChange(e.target.value)}>
                  {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {filters.selectedYear !== 'All' && (
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 shadow-sm flex-1 min-w-[420px]">
                  <label className="text-sm font-semibold text-gray-600 whitespace-nowrap">Month</label>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <button onClick={() => setFilters(prev=>({...prev, selectedMonth:'All'}))}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${filters.selectedMonth==='All' ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md scale-105' : 'bg-white text-gray-700 border border-gray-200 hover:border-teal-300'}`}>
                      All
                    </button>
                    {ALL_MONTHS.map(month => {
                      const avail = availableMonths.includes(month);
                      return (
                        <button key={month} onClick={() => avail && setFilters(prev=>({...prev,selectedMonth:month}))} disabled={!avail}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${filters.selectedMonth===month ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md scale-105' : avail ? 'bg-white text-gray-700 border border-gray-200 hover:border-teal-300' : 'bg-gray-100 text-gray-300 border border-gray-200 cursor-not-allowed'}`}>
                          {month}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {filters.periodType === 'dateRange' && (
            <div className="flex flex-wrap items-center gap-6">
              {[['From Date:','fromDate'],['To Date:','toDate']].map(([lbl,key]) => (
                <div key={key} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                  <label className="text-sm font-semibold text-gray-600 whitespace-nowrap">{lbl}</label>
                  <input type="date" className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 bg-white"
                    value={filters[key]} onChange={e => setFilters(prev=>({...prev,[key]:e.target.value}))} />
                </div>
              ))}
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-sm font-semibold text-blue-700">
                  {new Date(filters.fromDate).toLocaleDateString('en-IN')} – {new Date(filters.toDate).toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Order cards */}
      <div className="space-y-5">
        {filteredOrders.length === 0 ? (
          <div className="text-center text-gray-500 py-20 bg-white rounded-lg border border-gray-200 border-dashed">
            <p className="text-xl font-semibold">No orders found.</p>
            <p className="text-base font-semibold text-gray-400 mt-2">Try adjusting your filters or create a new order.</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <OrderCard key={order.id || order._id} order={order} onView={onView} onEdit={onEdit} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
};

// ─── OrderCard ────────────────────────────────────────────────────────────────
const OrderCard = ({ order, onView, onEdit, onDelete }) => {
  const [showBillingPopup, setShowBillingPopup] = useState(null);
  const [showEndPopup,     setShowEndPopup]     = useState(null);
  const [showCompanyPopup, setShowCompanyPopup] = useState(false);

  const isNLD = order.product === 'NLD';
  const state1 = order.billing1?.state || '';
  const state2 = order.billing2?.state || '';
  const areStatesDifferent = isNLD && state1 !== state2 && state2 !== '';
  const isSplitApplicable  = areStatesDifferent && order.splitFactor?.isApplicable;

  const capacityMbps   = Number(order.capacity) || 0;
  const capacityKbps   = capacityMbps * 1024;
  const baseRate       = Number(order.amount) || 0;
  const totalAmountLink= baseRate * capacityMbps;

  const truncateEndText = (text, limit = 50) => {
    if (!text) return '-';
    if (text.length <= limit) return text;
    return (
      <>
        {text.substring(0, limit)}
        <span className="text-blue-600 cursor-pointer hover:underline ml-1 font-semibold"
          onClick={() => setShowEndPopup(text)}>...more</span>
      </>
    );
  };

  const renderRow = (billingObj, gstObj, splitPercentage = 100, showAllCols = false) => {
    const pct        = splitPercentage / 100;
    const rowBase    = totalAmountLink * pct;
    const splitRate  = baseRate * pct;
    const isSelf     = gstObj?.isSelfGST || false;

    let cgstAmt = 0, sgstAmt = 0, igstAmt = 0, cgstSgstAmt = 0, totalGST = 0;

    if (isSelf) {
      const cgstPct = gstObj?.cgst || 9;
      const sgstPct = gstObj?.sgst || 9;
      cgstAmt     = (rowBase * cgstPct) / 100;
      sgstAmt     = (rowBase * sgstPct) / 100;
      cgstSgstAmt = cgstAmt + sgstAmt;
      totalGST    = cgstSgstAmt;
    } else {
      const igstPct = gstObj?.igst || 18;
      igstAmt  = (rowBase * igstPct) / 100;
      totalGST = igstAmt;
    }

    const grandTotal = rowBase + totalGST;
    const arcTotal   = rowBase * 12;

    return (
      <tr className="border-t border-gray-200 text-base hover:bg-gray-50 transition-colors">
        <td className="py-4 px-4 font-semibold text-gray-900">{order.orderId}</td>
        <td className="py-4 px-4 font-semibold text-gray-600">{order.lsiId}</td>
        <td className="py-4 px-4 font-semibold text-gray-700">{capacityMbps} Mbps</td>
        <td className="py-4 px-4 font-semibold text-gray-600">{capacityKbps.toLocaleString()}</td>
        <td className="py-4 px-4 font-semibold text-gray-600">{truncateEndText(billingObj?.address, 20)}</td>
        <td className="py-4 px-4 font-semibold text-gray-900">{billingObj?.state || '-'}</td>
        <td className="py-4 px-4 font-bold text-blue-700">₹{splitRate.toFixed(2)}</td>
        <td className="py-4 px-4 font-bold text-blue-600">₹{rowBase.toFixed(0)}</td>

        {showAllCols ? (
          <>
            <td className="py-4 px-4 font-semibold text-green-700">{isSelf  ? `₹${cgstAmt.toFixed(0)}`     : '–'}</td>
            <td className="py-4 px-4 font-semibold text-green-700">{isSelf  ? `₹${sgstAmt.toFixed(0)}`     : '–'}</td>
            <td className="py-4 px-4 font-semibold text-purple-700">{isSelf ? `₹${cgstSgstAmt.toFixed(0)}` : '–'}</td>
            <td className="py-4 px-4 font-semibold text-green-700">{!isSelf ? `₹${igstAmt.toFixed(0)}`     : '–'}</td>
          </>
        ) : isSelf ? (
          <>
            <td className="py-4 px-4 font-semibold text-green-700">₹{cgstAmt.toFixed(0)}</td>
            <td className="py-4 px-4 font-semibold text-green-700">₹{sgstAmt.toFixed(0)}</td>
            <td className="py-4 px-4 font-semibold text-purple-700">₹{cgstSgstAmt.toFixed(0)}</td>
          </>
        ) : (
          <td className="py-4 px-4 font-semibold text-green-700">₹{igstAmt.toFixed(0)}</td>
        )}

        <td className="py-4 px-4 font-bold text-green-700">₹{grandTotal.toFixed(0)}</td>
        <td className="py-4 px-4 font-bold text-purple-700">₹{arcTotal.toFixed(0)}</td>
        <td className="py-4 px-4 text-center">
          <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${isSplitApplicable ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
            {splitPercentage.toFixed(0)}%
          </span>
        </td>
        <td className="py-4 px-4">
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => onView(order)} className="p-2 hover:bg-blue-50 rounded-lg" title="View"><Eye className="w-5 h-5 text-blue-600" /></button>
            <button onClick={() => onEdit(order)} className="p-2 hover:bg-amber-50 rounded-lg" title="Edit"><Edit2 className="w-5 h-5 text-amber-600" /></button>
            <button onClick={() => onDelete(order.id || order._id)} className="p-2 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-5 h-5 text-red-600" /></button>
          </div>
        </td>
      </tr>
    );
  };

  const gst1 = order.gstDetails1 || order.gstDetails || {};
  const gst2 = order.gstDetails2 || order.gstDetails || {};
  const isSelf1 = gst1?.isSelfGST || false;
  const isSelf2 = gst2?.isSelfGST || false;
  const mixedGSTTypes = isSplitApplicable && isSelf1 !== isSelf2;

  const selfGst  = isSelf1 ? gst1 : gst2;
  const interGst = isSelf1 ? gst2 : gst1;
  const cgstRate = selfGst?.cgst  || 9;
  const sgstRate = selfGst?.sgst  || 9;
  const igstRate = interGst?.igst || 18;

  const buildHeaders = () => (
    <tr>
      <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">Order ID</th>
      <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">LSI ID</th>
      <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">Cap (Mb)</th>
      <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">Cap (Kb)</th>
      <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">Billing</th>
      <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">State</th>
      <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">Rate</th>
      <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">Total Basic</th>

      {mixedGSTTypes ? (
        <>
          <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">CGST {cgstRate}%</th>
          <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">SGST {sgstRate}%</th>
          <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">CGST+SGST Amt</th>
          <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">IGST {igstRate}%</th>
        </>
      ) : isSelf1 ? (
        <>
          <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">CGST {gst1.cgst || 9}%</th>
          <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">SGST {gst1.sgst || 9}%</th>
          <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">CGST+SGST Amt</th>
        </>
      ) : (
        <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">IGST {gst1.igst || 18}%</th>
      )}

      <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">Grand Total</th>
      <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">ARC Total</th>
      <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">Split</th>
      <th className="px-4 py-4 font-semibold text-gray-700 whitespace-nowrap">Actions</th>
    </tr>
  );

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-5 border-b border-gray-200 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                <span className="text-gray-600 font-semibold text-base">Order Id:</span>
                <span className="px-3 py-1 bg-purple-100 text-purple-900 rounded-lg text-base font-bold border border-purple-200">{order.orderId}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600 font-semibold text-base">Company:</span>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 rounded-lg text-base font-semibold border border-blue-200">{truncateEndText(order.companyName, 50)}</span>
                {order.companyGroup && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600 font-semibold text-base">Group:</span>
                    <span className="px-2.5 py-0.5 bg-green-100 text-green-900 rounded-lg text-base font-semibold border border-green-200">{truncateEndText(order.companyGroup, 30)}</span>
                  </>
                )}
              </h3>
              <p className="text-sm font-semibold text-gray-600 mt-3 flex items-center gap-2 flex-wrap">
                <span className="font-semibold">End A:</span>
                <span className="bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">{truncateEndText(order.endA, 30)}</span>
                <span className="text-gray-400">•</span>
                <span className="font-semibold">End B:</span>
                <span className="bg-green-100 border border-green-200 rounded-full px-2.5 py-1">{truncateEndText(order.endB, 30)}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <div className="flex gap-2 items-center flex-wrap justify-end">
              <span className="text-sm text-gray-600 font-semibold bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                LOC: {order.pcdDate ? formatDateToDisplay(order.pcdDate) : '-'}
              </span>
              {order.terminateDate && (
                <span className="text-sm text-red-600 font-semibold bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                  Terminate: {formatDateToDisplay(order.terminateDate)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Badge color="orange">{order.entity}</Badge>
              <Badge color="blue">{order.orderType}</Badge>
              <Badge color="purple">{order.product}</Badge>
              {order.bso && <Badge color="teal">{order.bso}</Badge>}
              <Badge color={order.status === 'PCD' ? 'green' : 'red'}>{order.status}</Badge>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-sm font-semibold text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              {buildHeaders()}
            </thead>
            <tbody>
              {isSplitApplicable ? (
                <>
                  {renderRow(order.billing1, gst1, order.splitFactor.state1Percentage, mixedGSTTypes)}
                  {renderRow(order.billing2, gst2, order.splitFactor.state2Percentage, mixedGSTTypes)}
                </>
              ) : (
                renderRow(order.billing1, gst1, 100, false)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showBillingPopup && <BillingPopup billing={showBillingPopup} onClose={() => setShowBillingPopup(null)} />}
      {showEndPopup     && <EndAddressPopup endLabel={showEndPopup === order.endA ? "End A" : "End B"} endAddress={showEndPopup} onClose={() => setShowEndPopup(null)} />}
      {showCompanyPopup && <CompanyNamePopup companyName={order.companyName} onClose={() => setShowCompanyPopup(false)} />}
    </>
  );
};

const Badge = ({ children, color }) => {
  const colors = {
    blue:   "bg-blue-100 text-blue-800 border border-blue-200",
    green:  "bg-green-100 text-green-800 border border-green-200",
    red:    "bg-red-100 text-red-800 border border-red-200",
    purple: "bg-purple-100 text-purple-800 border border-purple-200",
    gray:   "bg-gray-100 text-gray-800 border border-gray-200",
    orange: "bg-orange-200 text-gray-800 border border-gray-200",
    teal:   "bg-teal-100 text-teal-800 border border-teal-200",
  };
  return <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${colors[color] || colors.gray}`}>{children}</span>;
};

// ─── MAIN PAGE ────────
export default function BillingManagementSystem() {
  const [viewOrder,  setViewOrder]  = useState(null);
  const [editOrder,  setEditOrder]  = useState(null);
  const [activeTab,  setActiveTab]  = useState('list');
  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res    = await fetch('/api/billing/orders');
      const result = await res.json();
      if (result.success) setOrders(result.data.map(o => ({ ...o, id: o._id })));
    } catch (err) { console.error(err); alert('Failed to fetch orders'); }
    finally { setLoading(false); }
  };

  const addOrder = async (newOrder) => {
    try {
      const res    = await fetch('/api/billing/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newOrder) });
      const result = await res.json();
      if (result.success) { await fetchOrders(); setActiveTab('list'); alert("Order Created Successfully!"); }
      else alert('Failed to create order: ' + result.error);
    } catch (err) { console.error(err); alert('Failed to create order'); }
  };

  const handleSaveEdit = async (updatedOrder) => {
    try {
      const { id, _id, ...orderData } = updatedOrder;
      const orderId = id || _id;
      const res    = await fetch(`/api/billing/orders/${orderId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(orderData) });
      const result = await res.json();
      if (result.success) { await fetchOrders(); setEditOrder(null); alert('Order updated successfully!'); }
      else alert('Failed to update order: ' + result.error);
    } catch (err) { console.error(err); alert('Failed to update order'); }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!confirm("Are you sure you want to delete this order?")) return;
    try {
      const res    = await fetch(`/api/billing/orders/${orderId}`, { method:'DELETE' });
      const result = await res.json();
      if (result.success) { await fetchOrders(); alert('Order deleted successfully!'); }
      else alert('Failed to delete order: ' + result.error);
    } catch (err) { console.error(err); alert('Failed to delete order'); }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to delete ALL data?")) return;
    try {
      const res    = await fetch('/api/billing/orders', { method:'DELETE' });
      const result = await res.json();
      if (result.success) { setOrders([]); alert('All orders deleted!'); }
      else alert('Failed: ' + result.error);
    } catch (err) { console.error(err); alert('Failed to delete all orders'); }
  };

  if (loading) return <div>loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-5 md:p-6" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      <header className="mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">LOC Closure Overview</h1>
          <p className="text-gray-600 text-base font-semibold mt-2">
            Centralized dashboard to monitor, track, and complete all LOC closure and billing operations seamlessly.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setActiveTab('list')} className={`px-6 py-3 rounded-lg font-semibold transition-colors text-base ${activeTab==='list' ? 'bg-gray-900 text-white shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}>View List</button>
          <button onClick={() => setActiveTab('create')} className={`px-6 py-3 rounded-lg font-semibold transition-colors text-base ${activeTab==='create' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}>+ Create Order</button>
          {orders.length > 0 && (
            <button onClick={handleClearAll} className="p-3 text-red-500 hover:bg-red-50 rounded-lg border border-red-200" title="Clear All Data"><Trash2 className="w-5 h-5" /></button>
          )}
        </div>
      </header>

      <main className="mx-auto">
        {activeTab === 'create' ? (
          <CreateOrderForm onAddOrder={addOrder} />
        ) : (
          <Suspense fallback={<div>Loading...</div>}>
            <OrderList orders={orders} onView={setViewOrder} onEdit={setEditOrder} onDelete={handleDeleteOrder} />
          </Suspense>
        )}
      </main>

      {viewOrder && <ViewDetailsModal order={viewOrder} onClose={() => setViewOrder(null)} />}
      {editOrder && <EditOrderModal order={editOrder} onClose={() => setEditOrder(null)} onSave={handleSaveEdit} />}
    </div>
  );
}