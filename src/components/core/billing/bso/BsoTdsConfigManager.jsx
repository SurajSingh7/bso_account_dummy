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
  <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
    {toasts.map((t) => (
      <div key={t.id} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: 12, minWidth: 280,
        pointerEvents: 'auto', fontSize: 13, fontWeight: 600,
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        animation: 'bso-slide-in 0.25s ease',
        background: t.type === 'success' ? '#f0fdf4' : t.type === 'error' ? '#fff1f2' : '#eff6ff',
        border: `1.5px solid ${t.type === 'success' ? '#bbf7d0' : t.type === 'error' ? '#fecdd3' : '#bfdbfe'}`,
        color: t.type === 'success' ? '#15803d' : t.type === 'error' ? '#b91c1c' : '#1e40af',
      }}>
        {t.type === 'success' ? <CheckCircle2 style={{ width: 16, height: 16, flexShrink: 0 }} />
          : t.type === 'error' ? <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
          : <ShieldCheck style={{ width: 16, height: 16, flexShrink: 0 }} />}
        <span style={{ flex: 1 }}>{t.message}</span>
        <button onClick={() => removeToast(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, display: 'flex', padding: 2 }}>
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>
    ))}
  </div>
);

// ── Confirm Dialog ─────────────────────────────────────────────────────────────
const ConfirmDialog = ({ open, message, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%', margin: '0 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1.5px solid #fee2e2', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'flex-start' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fff1f2', border: '1.5px solid #fecdd3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trash2 style={{ width: 18, height: 18, color: '#e11d48' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>Confirm Delete</div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{message}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#e11d48', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Delete</button>
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

  const inputBase = {
    width: '100%', background: '#f8fafc', border: '1.5px solid #e2e8f0',
    borderRadius: 10, color: '#0f172a',
    fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes bso-slide-in { from { opacity:0; transform:translateX(18px); } to { opacity:1; transform:translateX(0); } }
        @keyframes bso-fade-in  { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bso-spin     { to { transform:rotate(360deg); } }
        .bso-spin { animation: bso-spin 0.7s linear infinite; }
        .bso-row:hover { background: #f0f7ff !important; }
        .bso-input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.12) !important; }
        .bso-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(37,99,235,0.3) !important; }
        .bso-btn-ghost:hover   { background: #f1f5f9 !important; }
        .bso-icon-btn:hover    { filter: brightness(0.9); }
        .bso-th-btn:hover      { color: #1e40af !important; }
      `}</style>

      <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '2rem', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>

          <Toast toasts={toasts} removeToast={removeToast} />
          <ConfirmDialog
            open={!!confirmDelete}
            message={`Delete BSO "${confirmDelete?.name}"? This action cannot be undone.`}
            onConfirm={confirmDoDelete}
            onCancel={() => setConfirmDelete(null)}
          />

          {/* ── Header ────────────────────────────────────────────────── */}
          <div style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 55%, #2563eb 100%)',
            borderRadius: 22, padding: '28px 32px', marginBottom: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 16,
            boxShadow: '0 6px 30px rgba(30,64,175,0.22)',
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
                Billing / Configuration
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: 5 }}>
                BSO TDS Config
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                Manage BSO providers and their TDS deduction rates
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { num: configs.length, label: 'Total', color: '#fff' },
                { num: activeCount, label: 'Active', color: '#86efac' },
                { num: configs.length - activeCount, label: 'Inactive', color: '#fca5a5' },
              ].map(({ num, label, color }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 14, padding: '10px 18px', textAlign: 'center', minWidth: 68,
                }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{num}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Add / Edit Form ──────────────────────────────────────── */}
          {showForm && (
            <div style={{
              background: '#fff', border: '2px solid #3b82f6', borderRadius: 18,
              padding: '22px 24px', marginBottom: 18,
              boxShadow: '0 4px 24px rgba(59,130,246,0.12)',
              animation: 'bso-fade-in 0.2s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#1e40af' }}>
                  {editingId ? <Pencil style={{ width: 16, height: 16 }} /> : <Plus style={{ width: 16, height: 16 }} />}
                  {editingId ? 'Edit BSO Config' : 'New BSO Config'}
                </div>
                <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex' }}>
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 130px auto', gap: 14, alignItems: 'start' }}>
                {/* BSO Name */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    BSO Name <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Building2 style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94a3b8', pointerEvents: 'none' }} />
                    <input
                      ref={nameRef}
                      type="text"
                      value={form.name}
                      onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setFormErrors(p => ({ ...p, name: '' })); }}
                      placeholder="e.g. Airtel, Tata…"
                      className="bso-input"
                      style={{ ...inputBase, padding: '10px 14px 10px 36px', border: formErrors.name ? '1.5px solid #f43f5e' : '1.5px solid #e2e8f0', boxShadow: formErrors.name ? '0 0 0 3px rgba(244,63,94,0.1)' : 'none' }}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    />
                  </div>
                  {formErrors.name && <div style={{ fontSize: 11, color: '#e11d48', marginTop: 4, fontWeight: 600 }}>{formErrors.name}</div>}
                </div>

                {/* TDS % */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    TDS % <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Percent style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#94a3b8', pointerEvents: 'none' }} />
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={form.tds}
                      onChange={e => { setForm(p => ({ ...p, tds: e.target.value })); setFormErrors(p => ({ ...p, tds: '' })); }}
                      placeholder="1"
                      className="bso-input"
                      style={{ ...inputBase, padding: '10px 14px 10px 34px', border: formErrors.tds ? '1.5px solid #f43f5e' : '1.5px solid #e2e8f0', boxShadow: formErrors.tds ? '0 0 0 3px rgba(244,63,94,0.1)' : 'none' }}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    />
                  </div>
                  {formErrors.tds && <div style={{ fontSize: 11, color: '#e11d48', marginTop: 4, fontWeight: 600 }}>{formErrors.tds}</div>}
                </div>

                {/* Status toggle */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Status</label>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                    style={{
                      ...inputBase, width: '100%', padding: '10px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      cursor: 'pointer', border: form.isActive ? '1.5px solid #bbf7d0' : '1.5px solid #e2e8f0',
                      background: form.isActive ? '#f0fdf4' : '#f8fafc',
                    }}
                  >
                    {form.isActive
                      ? <><ToggleRight style={{ width: 18, height: 18, color: '#16a34a' }} /><span style={{ color: '#16a34a', fontWeight: 700, fontSize: 13 }}>Active</span></>
                      : <><ToggleLeft style={{ width: 18, height: 18, color: '#94a3b8' }} /><span style={{ color: '#94a3b8', fontWeight: 700, fontSize: 13 }}>Inactive</span></>}
                  </button>
                </div>

                {/* Buttons */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'transparent', marginBottom: 6 }}>_</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleSubmit}
                      disabled={saving}
                      className="bso-btn-primary"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        padding: '10px 20px', borderRadius: 10,
                        background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                        color: '#fff', fontWeight: 700, fontSize: 13.5,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        border: 'none', opacity: saving ? 0.65 : 1,
                        fontFamily: "'DM Sans', sans-serif",
                        boxShadow: '0 2px 10px rgba(37,99,235,0.22)',
                        whiteSpace: 'nowrap', transition: 'all 0.15s',
                      }}
                    >
                      {saving
                        ? <><Loader2 style={{ width: 14, height: 14 }} className="bso-spin" />Saving…</>
                        : <><Save style={{ width: 14, height: 14 }} />{editingId ? 'Update' : 'Create'}</>}
                    </button>
                    <button onClick={resetForm} className="bso-btn-ghost" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '9px 14px', borderRadius: 10,
                      background: '#fff', color: '#475569', fontWeight: 600,
                      fontSize: 13, cursor: 'pointer', border: '1.5px solid #e2e8f0',
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      <X style={{ width: 14, height: 14 }} />Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Toolbar ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
              <Search style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#94a3b8', pointerEvents: 'none' }} />
              <input
                type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search BSO name…"
                className="bso-input"
                style={{ ...inputBase, padding: '10px 14px 10px 34px', width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={fetchConfigs} disabled={loading} className="bso-btn-ghost" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 10,
                background: '#fff', color: '#475569', fontWeight: 600, fontSize: 13,
                cursor: 'pointer', border: '1.5px solid #e2e8f0',
                fontFamily: "'DM Sans', sans-serif",
              }}>
                <RefreshCw style={{ width: 14, height: 14 }} className={loading ? 'bso-spin' : ''} />Refresh
              </button>
              {!showForm && (
                <button onClick={() => { resetForm(); setShowForm(true); }} className="bso-btn-primary" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 20px', borderRadius: 10,
                  background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                  color: '#fff', fontWeight: 700, fontSize: 13.5,
                  cursor: 'pointer', border: 'none',
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: '0 2px 10px rgba(37,99,235,0.22)',
                  transition: 'all 0.15s',
                }}>
                  <Plus style={{ width: 15, height: 15 }} />Add BSO
                </button>
              )}
            </div>
          </div>

          {/* ── Table ─────────────────────────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #e2e8f0', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {[
                      { label: '#', field: null, w: 52 },
                      { label: 'BSO Name', field: 'name' },
                      { label: 'TDS %', field: 'tds', w: 130 },
                      { label: 'Status', field: 'isActive', w: 130 },
                      { label: 'Created', field: 'createdAt', w: 155 },
                      { label: 'Actions', field: null, w: 118 },
                    ].map((col, i) => (
                      <th key={i} style={{ padding: '13px 16px', textAlign: i === 5 ? 'center' : 'left', width: col.w }}>
                        {col.field ? (
                          <button className="bso-th-btn" onClick={() => handleSort(col.field)} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#64748b', fontSize: 11, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                            padding: 0, fontFamily: "'DM Sans', sans-serif",
                          }}>
                            {col.label}
                            {sortField === col.field
                              ? sortDir === 'asc'
                                ? <ChevronUp style={{ width: 12, height: 12, color: '#2563eb' }} />
                                : <ChevronDown style={{ width: 12, height: 12, color: '#2563eb' }} />
                              : <ChevronUp style={{ width: 12, height: 12, opacity: 0.2 }} />}
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{col.label}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '56px 0', textAlign: 'center', color: '#94a3b8' }}>
                        <Loader2 style={{ width: 28, height: 28, display: 'inline-block', marginBottom: 8, color: '#3b82f6' }} className="bso-spin" />
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Loading configs…</div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '56px 0', textAlign: 'center', color: '#94a3b8' }}>
                        <Building2 style={{ width: 38, height: 38, display: 'inline-block', marginBottom: 10, opacity: 0.22 }} />
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#475569' }}>
                          {search ? `No results for "${search}"` : 'No BSO configs yet'}
                        </div>
                        <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 14 }}>
                          {search ? 'Try a different search term' : 'Add your first BSO provider to get started'}
                        </div>
                        {!search && (
                          <button onClick={() => setShowForm(true)} className="bso-btn-primary" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '9px 18px', borderRadius: 10, border: 'none',
                            background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                            color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                            fontFamily: "'DM Sans', sans-serif",
                          }}>
                            <Plus style={{ width: 14, height: 14 }} />Add First BSO
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((config, idx) => (
                      <tr
                        key={config._id}
                        className="bso-row"
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          opacity: config.isActive ? 1 : 0.58,
                          background: editingId === config._id ? '#eff6ff' : 'transparent',
                          transition: 'background 0.12s',
                        }}
                      >
                        {/* # */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: 12, color: '#cbd5e1', fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </td>

                        {/* Name */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 10,
                              background: 'linear-gradient(135deg,#dbeafe,#eff6ff)',
                              border: '1.5px solid #bfdbfe',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              <Building2 style={{ width: 16, height: 16, color: '#2563eb' }} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{config.name}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'DM Mono', monospace", marginTop: 1 }}>…{config._id.slice(-8)}</div>
                            </div>
                          </div>
                        </td>

                        {/* TDS */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            padding: '4px 10px', borderRadius: 8,
                            background: '#fef3c7', color: '#b45309',
                            border: '1px solid #fde68a',
                            fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
                          }}>
                            <Percent style={{ width: 11, height: 11 }} />{config.tds}%
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            fontFamily: "'DM Mono', monospace",
                            background: config.isActive ? '#f0fdf4' : '#fff1f2',
                            color: config.isActive ? '#16a34a' : '#e11d48',
                            border: `1px solid ${config.isActive ? '#bbf7d0' : '#fecdd3'}`,
                          }}>
                            {config.isActive ? '● Active' : '○ Inactive'}
                          </span>
                        </td>

                        {/* Created */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: 12, color: '#64748b', fontFamily: "'DM Mono', monospace" }}>
                            {new Date(config.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              className="bso-icon-btn"
                              title="Edit"
                              onClick={() => handleEdit(config)}
                              style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dbeafe', color: '#2563eb', transition: 'all 0.12s' }}
                            >
                              <Pencil style={{ width: 14, height: 14 }} />
                            </button>
                            <button
                              className="bso-icon-btn"
                              title={config.isActive ? 'Deactivate' : 'Activate'}
                              onClick={() => handleToggleActive(config)}
                              style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: config.isActive ? '#dcfce7' : '#fef9c3', color: config.isActive ? '#16a34a' : '#a16207', transition: 'all 0.12s' }}
                            >
                              {config.isActive ? <ToggleRight style={{ width: 15, height: 15 }} /> : <ToggleLeft style={{ width: 15, height: 15 }} />}
                            </button>
                            <button
                              className="bso-icon-btn"
                              title="Delete"
                              onClick={() => setConfirmDelete(config)}
                              style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffe4e6', color: '#e11d48', transition: 'all 0.12s' }}
                            >
                              <Trash2 style={{ width: 14, height: 14 }} />
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
              <div style={{
                padding: '10px 18px', background: '#f8fafc',
                borderTop: '1.5px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 12, color: '#94a3b8', fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
              }}>
                <span>
                  Showing {filtered.length} of {configs.length} entries
                  {search && <span style={{ color: '#3b82f6', marginLeft: 4 }}>— filtered by "{search}"</span>}
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