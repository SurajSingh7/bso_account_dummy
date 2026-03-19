'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Pencil, Trash2, Save, X, RefreshCw,
  ToggleLeft, ToggleRight, Percent, Building2,
  AlertCircle, CheckCircle2, Loader2,
  ChevronUp, ChevronDown, Search, ShieldCheck
} from 'lucide-react';

// ── Toast ──────────────────────────────────────────────────────────────────────
const Toast = ({ toasts, removeToast }) => (
  <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl min-w-[280px] pointer-events-auto text-[13px] font-semibold shadow-xl border-[1.5px] animate-[slideIn_0.25s_ease]
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-700'
          : t.type === 'error' ? 'bg-red-50 border-red-200 text-red-700'
          : 'bg-blue-50 border-blue-200 text-blue-700'}`}
      >
        {t.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" />
          : t.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" />
          : <ShieldCheck className="w-4 h-4 shrink-0" />}
        <span className="flex-1">{t.message}</span>
        <button onClick={() => removeToast(t.id)} className="opacity-50 hover:opacity-100 p-0.5 bg-transparent border-none cursor-pointer flex">
          <X className="w-3 h-3" />
        </button>
      </div>
    ))}
  </div>
);

// ── Confirm Dialog ─────────────────────────────────────────────────────────────
const ConfirmDialog = ({ open, message, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-7 max-w-sm w-full mx-4 shadow-2xl border-[1.5px] border-red-100">
        <div className="flex gap-3.5 mb-5 items-start">
          <div className="w-10 h-10 rounded-xl bg-red-50 border-[1.5px] border-red-200 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <div className="font-bold text-[15px] text-slate-900 mb-1">Confirm Delete</div>
            <div className="text-[13px] text-slate-500 leading-relaxed">{message}</div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl border-[1.5px] border-slate-200 bg-slate-50 text-slate-600 font-semibold text-[13px] cursor-pointer hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl border-none bg-rose-600 text-white font-bold text-[13px] cursor-pointer hover:bg-rose-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const BsoTdsConfigManager = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [toasts, setToasts] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', tds: '', isActive: true });
  const [formErrors, setFormErrors] = useState({});
  const nameRef = useRef(null);
  const toastCounter = useRef(0);

  const addToast = (message, type = 'info') => {
    const id = ++toastCounter.current;
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };
  const removeToast = (id) => setToasts(p => p.filter(t => t.id !== id));

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/billing/bso-tds-config');
      const result = await res.json();
      if (result.success) setConfigs(result.data);
      else addToast(result.error || 'Failed to fetch', 'error');
    } catch { addToast('Network error', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchConfigs(); }, []);
  useEffect(() => { if (showForm && nameRef.current) nameRef.current.focus(); }, [showForm]);

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'BSO name is required';
    if (form.tds === '') errors.tds = 'TDS % is required';
    else if (isNaN(Number(form.tds))) errors.tds = 'Must be a number';
    else if (Number(form.tds) < 0) errors.tds = 'Cannot be negative';
    else if (Number(form.tds) > 100) errors.tds = 'Cannot exceed 100%';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const isEdit = !!editingId;
      const body = isEdit
        ? { _id: editingId, ...form, tds: Number(form.tds) }
        : { ...form, tds: Number(form.tds) };
      const res = await fetch('/api/billing/bso-tds-config', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.success) {
        addToast(isEdit ? `"${form.name}" updated successfully` : `"${form.name}" created successfully`, 'success');
        resetForm();
        await fetchConfigs();
      } else addToast(result.error || 'Save failed', 'error');
    } catch { addToast('Network error', 'error'); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (config) => {
    try {
      const res = await fetch('/api/billing/bso-tds-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _id: config._id, isActive: !config.isActive }),
      });
      const result = await res.json();
      if (result.success) {
        addToast(`"${config.name}" ${!config.isActive ? 'activated' : 'deactivated'}`, 'success');
        await fetchConfigs();
      } else addToast(result.error, 'error');
    } catch { addToast('Network error', 'error'); }
  };

  const confirmDoDelete = async () => {
    const config = confirmDelete;
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/billing/bso-tds-config?id=${config._id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) { addToast(`"${config.name}" deleted`, 'success'); await fetchConfigs(); }
      else addToast(result.error, 'error');
    } catch { addToast('Network error', 'error'); }
  };

  const handleEdit = (config) => {
    setEditingId(config._id);
    setForm({ name: config.name, tds: String(config.tds), isActive: config.isActive });
    setFormErrors({});
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: '', tds: '', isActive: true });
    setFormErrors({});
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const filtered = configs
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const activeCount = configs.filter(c => c.isActive).length;

  return (
    <>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(18px); } to { opacity:1; transform:translateX(0); } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin    { to { transform:rotate(360deg); } }
        .bso-spin { animation: spin 0.7s linear infinite; }
        .bso-fade-in { animation: fadeIn 0.2s ease; }
      `}</style>

      <div className="bg-slate-100 min-h-screen p-8 font-sans">
        <div className="max-w-[920px] mx-auto">

          <Toast toasts={toasts} removeToast={removeToast} />
          <ConfirmDialog
            open={!!confirmDelete}
            message={`Delete BSO "${confirmDelete?.name}"? This action cannot be undone.`}
            onConfirm={confirmDoDelete}
            onCancel={() => setConfirmDelete(null)}
          />

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="bg-gradient-to-br from-[#1e3a5f] via-blue-800 to-blue-600 rounded-[22px] p-7 mb-5 flex items-center justify-between flex-wrap gap-4 shadow-[0_6px_30px_rgba(30,64,175,0.22)]">
            <div>
              <div className="text-[11px] text-white/50 font-semibold uppercase tracking-[0.12em] mb-1.5">
                Billing / Configuration
              </div>
              <div className="text-[28px] font-extrabold text-white tracking-tight leading-tight mb-1">
                BSO TDS Config
              </div>
              <div className="text-[13px] text-white/60">
                Manage BSO providers and their TDS deduction rates
              </div>
            </div>
            <div className="flex gap-2.5">
              {[
                { num: configs.length, label: 'Total', cls: 'text-white' },
                { num: activeCount, label: 'Active', cls: 'text-green-300' },
                { num: configs.length - activeCount, label: 'Inactive', cls: 'text-red-300' },
              ].map(({ num, label, cls }) => (
                <div key={label} className="bg-white/10 border border-white/15 rounded-2xl px-4 py-2.5 text-center min-w-[68px]">
                  <div className={`text-2xl font-extrabold leading-none ${cls}`}>{num}</div>
                  <div className="text-[10px] text-white/50 font-semibold mt-1 uppercase tracking-[0.08em]">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Add / Edit Form ─────────────────────────────────────── */}
          {showForm && (
            <div className="bso-fade-in bg-white border-2 border-blue-500 rounded-[18px] p-6 mb-4 shadow-[0_4px_24px_rgba(59,130,246,0.12)]">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 text-[15px] font-bold text-blue-800">
                  {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {editingId ? 'Edit BSO Config' : 'New BSO Config'}
                </div>
                <button onClick={resetForm} className="bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-600 p-1 flex transition-colors">
                  <X className="w-[18px] h-[18px]" />
                </button>
              </div>

              <div className="grid grid-cols-[1fr_150px_130px_auto] gap-3.5 items-start">
                {/* BSO Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-[0.07em]">
                    BSO Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-slate-400 pointer-events-none" />
                    <input
                      ref={nameRef}
                      type="text"
                      value={form.name}
                      onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setFormErrors(p => ({ ...p, name: '' })); }}
                      placeholder="e.g. Airtel, Tata…"
                      className={`w-full bg-slate-50 rounded-xl text-slate-900 font-medium text-[14px] outline-none box-border transition-all py-2.5 pl-9 pr-3.5
                        border-[1.5px] focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]
                        ${formErrors.name ? 'border-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.1)]' : 'border-slate-200'}`}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    />
                  </div>
                  {formErrors.name && <div className="text-[11px] text-rose-500 mt-1 font-semibold">{formErrors.name}</div>}
                </div>

                {/* TDS % */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-[0.07em]">
                    TDS % <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={form.tds}
                      onChange={e => { setForm(p => ({ ...p, tds: e.target.value })); setFormErrors(p => ({ ...p, tds: '' })); }}
                      placeholder="1"
                      className={`w-full bg-slate-50 rounded-xl text-slate-900 font-medium text-[14px] outline-none box-border transition-all py-2.5 pl-9 pr-3.5
                        border-[1.5px] focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]
                        ${formErrors.tds ? 'border-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.1)]' : 'border-slate-200'}`}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    />
                  </div>
                  {formErrors.tds && <div className="text-[11px] text-rose-500 mt-1 font-semibold">{formErrors.tds}</div>}
                </div>

                {/* Status toggle */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-[0.07em]">Status</label>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                    className={`w-full rounded-xl py-2.5 px-3.5 flex items-center justify-center gap-1.5 cursor-pointer transition-all border-[1.5px] text-[13px] font-bold
                      ${form.isActive
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                  >
                    {form.isActive
                      ? <><ToggleRight className="w-[18px] h-[18px]" /><span>Active</span></>
                      : <><ToggleLeft className="w-[18px] h-[18px]" /><span>Inactive</span></>}
                  </button>
                </div>

                {/* Buttons */}
                <div>
                  <label className="block text-[11px] text-transparent mb-1.5">_</label>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmit}
                      disabled={saving}
                      className={`inline-flex items-center gap-1.5 py-2.5 px-5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold text-[13.5px] border-none shadow-[0_2px_10px_rgba(37,99,235,0.22)] transition-all whitespace-nowrap
                        ${saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:brightness-110 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(37,99,235,0.3)]'}`}
                    >
                      {saving
                        ? <><Loader2 className="w-3.5 h-3.5 bso-spin" />Saving…</>
                        : <><Save className="w-3.5 h-3.5" />{editingId ? 'Update' : 'Create'}</>}
                    </button>
                    <button
                      onClick={resetForm}
                      className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white text-slate-500 font-semibold text-[13px] cursor-pointer border-[1.5px] border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Toolbar ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 mb-3.5 flex-wrap">
            <div className="relative flex-1 max-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search BSO name…"
                className="w-full bg-slate-50 border-[1.5px] border-slate-200 rounded-xl text-slate-900 font-medium text-[14px] outline-none transition-all py-2.5 pl-9 pr-3.5 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] box-border"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchConfigs}
                disabled={loading}
                className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-white text-slate-500 font-semibold text-[13px] cursor-pointer border-[1.5px] border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'bso-spin' : ''}`} />Refresh
              </button>
              {!showForm && (
                <button
                  onClick={() => { resetForm(); setShowForm(true); }}
                  className="inline-flex items-center gap-1.5 py-2.5 px-5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold text-[13.5px] border-none shadow-[0_2px_10px_rgba(37,99,235,0.22)] cursor-pointer hover:brightness-110 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(37,99,235,0.3)] transition-all"
                >
                  <Plus className="w-[15px] h-[15px]" />Add BSO
                </button>
              )}
            </div>
          </div>

          {/* ── Table ────────────────────────────────────────────────── */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-slate-200 shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    {[
                      { label: '#', field: null, cls: 'w-[52px]' },
                      { label: 'BSO Name', field: 'name', cls: '' },
                      { label: 'TDS %', field: 'tds', cls: 'w-[130px]' },
                      { label: 'Status', field: 'isActive', cls: 'w-[130px]' },
                      { label: 'Created', field: 'createdAt', cls: 'w-[155px]' },
                      { label: 'Actions', field: null, cls: 'w-[118px] text-center' },
                    ].map((col, i) => (
                      <th key={i} className={`px-4 py-3.5 text-left ${col.cls}`}>
                        {col.field ? (
                          <button
                            onClick={() => handleSort(col.field)}
                            className="inline-flex items-center gap-1 bg-transparent border-none cursor-pointer text-slate-500 text-[11px] font-bold uppercase tracking-[0.08em] p-0 hover:text-blue-800 transition-colors"
                          >
                            {col.label}
                            {sortField === col.field
                              ? sortDir === 'asc'
                                ? <ChevronUp className="w-3 h-3 text-blue-600" />
                                : <ChevronDown className="w-3 h-3 text-blue-600" />
                              : <ChevronUp className="w-3 h-3 opacity-20" />}
                          </button>
                        ) : (
                          <span className={`text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] ${i === 5 ? 'block text-center' : ''}`}>{col.label}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-slate-400">
                        <Loader2 className="w-7 h-7 inline-block mb-2 text-blue-500 bso-spin" />
                        <div className="text-[13px] font-medium">Loading configs…</div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-slate-400">
                        <Building2 className="w-9 h-9 inline-block mb-2.5 opacity-20" />
                        <div className="text-[14px] font-semibold mb-1 text-slate-500">
                          {search ? `No results for "${search}"` : 'No BSO configs yet'}
                        </div>
                        <div className="text-[12px] text-slate-300 mb-3.5">
                          {search ? 'Try a different search term' : 'Add your first BSO provider to get started'}
                        </div>
                        {!search && (
                          <button
                            onClick={() => setShowForm(true)}
                            className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl border-none bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold text-[12px] cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />Add First BSO
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((config, idx) => (
                      <tr
                        key={config._id}
                        className={`border-b border-slate-100 transition-colors hover:bg-blue-50/60
                          ${config.isActive ? 'opacity-100' : 'opacity-60'}
                          ${editingId === config._id ? 'bg-blue-50' : ''}`}
                      >
                        {/* # */}
                        <td className="px-4 py-3.5">
                          <span className="text-[12px] text-slate-300 font-mono font-medium">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 border-[1.5px] border-blue-200 flex items-center justify-center shrink-0">
                              <Building2 className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="font-bold text-[14px] text-slate-900">{config.name}</div>
                          </div>
                        </td>

                        {/* TDS */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-mono text-[13px] font-bold">
                            {config.tds}%
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono border
                            ${config.isActive
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-red-50 text-rose-600 border-red-200'}`}>
                            {config.isActive ? '● Active' : '○ Inactive'}
                          </span>
                        </td>

                        {/* Created */}
                        <td className="px-4 py-3.5">
                          <span className="text-[12px] text-slate-500 font-mono">
                            {new Date(config.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex gap-1.5 justify-center">
                            <button
                              title="Edit"
                              onClick={() => handleEdit(config)}
                              className="w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title={config.isActive ? 'Deactivate' : 'Activate'}
                              onClick={() => handleToggleActive(config)}
                              className={`w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center transition-colors
                                ${config.isActive
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}
                            >
                              {config.isActive
                                ? <ToggleRight className="w-[15px] h-[15px]" />
                                : <ToggleLeft className="w-[15px] h-[15px]" />}
                            </button>
                            <button
                              title="Delete"
                              onClick={() => setConfirmDelete(config)}
                              className="w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            {filtered.length > 0 && (
              <div className="px-4 py-2.5 bg-slate-50 border-t-[1.5px] border-slate-200 flex items-center justify-between text-[12px] text-slate-400 font-medium">
                <span>
                  Showing {filtered.length} of {configs.length} entries
                  {search && <span className="text-blue-500 ml-1">— filtered by "{search}"</span>}
                </span>
                <span>{activeCount} active · {configs.length - activeCount} inactive</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default BsoTdsConfigManager;