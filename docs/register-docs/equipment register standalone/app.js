// CFA Equipment Register -- frontend.
//
// This is the same UI/UX as the original single-file version (grouped
// ledger, filters, add/edit modal, delete confirmation) but it no longer
// owns any data itself. On load it fetches reference data (equipment types,
// categories, etc.) and the item list from the Flask API in app.py, and
// every add/edit/delete goes through that API too, which is backed by
// equipment.db (see database.py) instead of the browser's localStorage.
//
// One deliberate exception: the "suggested next code" (e.g. WF011) is still
// computed here in the browser from the already-loaded item list, purely so
// picking a type instantly shows a suggested code with no network delay.
// It's only a suggestion -- the server independently re-validates the code
// on save (see validate_item() in app.py), so a stale or edited suggestion
// can never actually create a bad or duplicate record.

const { useState, useEffect, useMemo } = React;

const BLANK = { type: '', code: '', hand: '', size: '', condition: 'Good', status: 'In Storage', notes: '' };

function Dot({ color }) {
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, marginRight: 5, flexShrink: 0, verticalAlign: 'middle' }} />;
}

const S = {
  th:      { textAlign: 'left', padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#7A7265', textTransform: 'uppercase', letterSpacing: '0.07em' },
  td:      { padding: '9px 14px', verticalAlign: 'middle' },
  label:   { display: 'block', fontSize: 11, fontWeight: 700, color: '#4A4033', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 },
  input:   { width: '100%', border: '1px solid #D5CFC5', borderRadius: 2, padding: '8px 10px', fontSize: 13, color: '#1A1A2E', background: 'white' },
  btnGold: { background: '#C49A1C', border: 'none', color: 'white', padding: '7px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600, borderRadius: 2 },
  btnOut:  { background: 'none', border: '1px solid #C5BFB5', color: '#5A5248', padding: '7px 14px', cursor: 'pointer', fontSize: 13, borderRadius: 2 },
  btnGh:   { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '2px 0' },
};

// ---- small API helper -------------------------------------------------
async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function exportCSV(items) {
  const header = ['Code', 'Type', 'Size', 'Hand', 'Condition', 'Status', 'Notes'];
  const rows = items.map(i => [i.code, i.type, i.size || '', i.hand || '', i.condition, i.status, (i.notes || '').replace(/,/g, ';')]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'cfa-equipment.csv';
  a.click();
}

function App() {
  // Reference data + items both start null until fetched from the API.
  const [config,    setConfig]    = useState(null); // { types, categories, typeOrder, sizes, conditions, statuses, statusColor, condColor }
  const [items,     setItems]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [loadErr,   setLoadErr]   = useState('');

  const [expanded,  setExpanded]  = useState(new Set());
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(BLANK);
  const [formErr,   setFormErr]   = useState('');
  const [saving,    setSaving]    = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [deleting,  setDeleting]  = useState(false);
  const [filters,   setFilters]   = useState({ q: '', status: '', condition: '' });

  useEffect(() => {
    (async () => {
      try {
        const [cfg, list] = await Promise.all([
          api('/api/config'),
          api('/api/equipment'),
        ]);
        setConfig(cfg);
        setItems(list);
      } catch (e) {
        setLoadErr(e.message || 'Could not reach the server.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function itemDetail(item) {
    if (!config) return '—';
    const t = config.types[item.type];
    if (!t) return '—';
    const parts = [];
    if (t.size && item.size) parts.push(item.size);
    if (t.hand && item.hand) parts.push(item.hand);
    return parts.join(' · ') || '—';
  }

  function nextCodeSuggestion(typeName) {
    if (!config) return '';
    const prefix = config.types[typeName]?.prefix;
    if (!prefix) return '';
    const nums = (items || [])
      .filter(i => i.code.startsWith(prefix))
      .map(i => parseInt(i.code.slice(prefix.length)) || 0);
    return prefix + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
  }

  const anyFilter = !!(filters.q || filters.status || filters.condition);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter(i => {
      const q = filters.q.toLowerCase();
      if (q && !i.code.toLowerCase().includes(q) && !i.type.toLowerCase().includes(q)
        && !itemDetail(i).toLowerCase().includes(q) && !(i.notes || '').toLowerCase().includes(q)) return false;
      if (filters.status && i.status !== filters.status) return false;
      if (filters.condition && i.condition !== filters.condition) return false;
      return true;
    });
  }, [items, filters, config]);

  const activeTypes = useMemo(() =>
    config ? config.typeOrder.filter(n => (items || []).some(i => i.type === n)) : []
  , [items, config]);

  const allExpanded = !anyFilter && activeTypes.length > 0 && activeTypes.every(n => expanded.has(n));

  const visibleCategories = useMemo(() => {
    if (!config) return [];
    return config.categories.map(cat => ({
      ...cat,
      types: cat.types.filter(t => {
        const d = anyFilter ? filteredItems.filter(i => i.type === t) : (items || []).filter(i => i.type === t);
        return d.length > 0;
      }),
    })).filter(cat => cat.types.length > 0);
  }, [items, filteredItems, anyFilter, config]);

  const totals = useMemo(() => ({
    all:     (items || []).length,
    storage: (items || []).filter(i => i.status === 'In Storage').length,
    member:  (items || []).filter(i => i.status === 'With Member').length,
    repair:  (items || []).filter(i => i.status === 'Awaiting Repair').length,
  }), [items]);

  const tinfo = form.type && config ? config.types[form.type] : null;

  function openAdd()    { setEditing(null); setForm(BLANK); setFormErr(''); setModal(true); }
  function openEdit(it) { setEditing(it); setForm({ ...it }); setFormErr(''); setModal(true); }
  function closeModal() { if (saving) return; setModal(false); setEditing(null); }

  function changeType(type) {
    setForm(f => ({ ...BLANK, type, code: type ? nextCodeSuggestion(type) : '' }));
    setFormErr('');
  }

  async function save() {
    if (!form.type || !form.code.trim()) { setFormErr('Type and code are required.'); return; }
    const t = config.types[form.type];
    if (t.size && !form.size) { setFormErr('Select a size.'); return; }
    if (t.hand && !form.hand) { setFormErr('Select handedness.'); return; }

    setSaving(true);
    setFormErr('');
    try {
      const payload = { ...form, code: form.code.trim().toUpperCase() };
      if (editing) {
        const updated = await api(`/api/equipment/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
      } else {
        const created = await api('/api/equipment', { method: 'POST', body: JSON.stringify(payload) });
        setItems(prev => [...prev, created]);
      }
      setModal(false);
      setEditing(null);
    } catch (e) {
      setFormErr(e.message || 'Could not save this item.');
    } finally {
      setSaving(false);
    }
  }

  async function del(id) {
    setDeleting(true);
    try {
      await api(`/api/equipment/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
      setDelTarget(null);
    } catch (e) {
      // Surface the error inline on the confirm dialog rather than losing it silently.
      setDelTarget(t => t && { ...t, _error: e.message });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888', fontSize: 14 }}>Loading…</div>;

  if (loadErr) {
    return (
      <div style={{ padding: '2rem', maxWidth: 480, margin: '0 auto', fontSize: 14 }}>
        <p style={{ fontWeight: 700, color: '#B91C1C', marginBottom: 6 }}>Couldn't load the register.</p>
        <p style={{ color: '#5A5248' }}>{loadErr}</p>
        <p style={{ color: '#A89880', marginTop: 12, fontSize: 13 }}>
          Make sure the Flask server is running (<code>python app.py</code>) and reload this page.
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* HEADER */}
      <header style={{ background: '#0B1F3A', padding: '16px 24px 14px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#C49A1C', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Cape Fencing Academy</div>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>Equipment Register</h1>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 2 }}>
              <button onClick={() => exportCSV(items)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.65)', padding: '6px 14px', cursor: 'pointer', fontSize: 12, borderRadius: 2 }}>Export CSV</button>
              <button onClick={openAdd} style={{ background: '#C49A1C', border: 'none', color: 'white', padding: '7px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 700, borderRadius: 2 }}>+ Add item</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, flexWrap: 'wrap' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{totals.all} items</span>
            {[['In Storage', totals.storage, '#4ADE80'], ['With Member', totals.member, '#FCD34D'], ['Awaiting Repair', totals.repair, '#F87171']].map(([l, n, c]) => n > 0 && (
              <span key={l} style={{ display: 'flex', alignItems: 'center', color: c }}><Dot color={c} />{n} {l}</span>
            ))}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main style={{ maxWidth: 980, margin: '0 auto', padding: '20px 24px 48px' }}>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" placeholder="Search code, type, notes…" value={filters.q}
            onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
            style={{ ...S.input, flex: '1 1 200px', padding: '7px 11px' }}
          />
          {[['status', config.statuses, 'All statuses'], ['condition', config.conditions, 'All conditions']].map(([key, opts, ph]) => (
            <select key={key} value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
              style={{ ...S.input, width: 'auto', padding: '7px 10px', cursor: 'pointer' }}>
              <option value="">{ph}</option>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
          {anyFilter && <button onClick={() => setFilters({ q: '', status: '', condition: '' })} style={{ ...S.btnGh, color: '#C49A1C', textDecoration: 'underline' }}>Clear</button>}
          {!anyFilter && activeTypes.length > 0 && (
            <button onClick={allExpanded ? () => setExpanded(new Set()) : () => setExpanded(new Set(activeTypes))}
              style={{ ...S.btnGh, color: '#7A7265', marginLeft: 'auto' }}>
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>

        {/* Categories */}
        {visibleCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9CA3AF', fontSize: 14 }}>
            {(items || []).length === 0 ? 'No equipment logged yet. Add your first item above.' : 'No items match the current filters.'}
          </div>
        ) : visibleCategories.map((cat, catIdx) => (
          <div key={cat.label}>
            {/* Category label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: catIdx === 0 ? 0 : 20, marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#C49A1C', letterSpacing: '0.18em', whiteSpace: 'nowrap' }}>{cat.label.toUpperCase()}</span>
              <div style={{ flex: 1, height: 1, background: '#DDD8D0' }} />
            </div>

            {/* Type groups within category */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {cat.types.map(typeName => {
                const allOfType    = (items || []).filter(i => i.type === typeName);
                const displayItems = anyFilter ? filteredItems.filter(i => i.type === typeName) : allOfType;
                const isExpanded   = anyFilter ? true : expanded.has(typeName);
                const byS = {
                  s: displayItems.filter(i => i.status === 'In Storage').length,
                  m: displayItems.filter(i => i.status === 'With Member').length,
                  r: displayItems.filter(i => i.status === 'Awaiting Repair').length,
                };
                return (
                  <div key={typeName} style={{ background: 'white', border: '1px solid #E5E0D8', borderLeft: '3px solid #C49A1C' }}>
                    {/* Group header */}
                    <div className="group-header"
                      onClick={() => !anyFilter && setExpanded(prev => { const n = new Set(prev); n.has(typeName) ? n.delete(typeName) : n.add(typeName); return n; })}
                      style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', cursor: anyFilter ? 'default' : 'pointer', userSelect: 'none', gap: 10, flexWrap: 'wrap' }}>
                      {!anyFilter && <span style={{ color: '#C49A1C', fontSize: 10, width: 12, flexShrink: 0 }}>{isExpanded ? '▼' : '▶'}</span>}
                      <span style={{ color: '#0B1F3A', fontWeight: 700, fontSize: 13, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{typeName}</span>
                      <span style={{ color: '#A89880', fontSize: 12 }}>
                        ({displayItems.length}{anyFilter && displayItems.length !== allOfType.length ? ` of ${allOfType.length}` : ''})</span>
                      <div style={{ display: 'flex', gap: 14, marginLeft: 2 }}>
                        {[[byS.s, 'In Storage', '#15803D'], [byS.m, 'With Member', '#B45309'], [byS.r, 'Awaiting Repair', '#B91C1C']].map(([n, l, c]) => n > 0 && (
                          <span key={l} style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: c }}><Dot color={c} />{n} {l}</span>
                        ))}
                      </div>
                    </div>
                    {/* Item table */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #EAE6DF', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: '#FAF8F4' }}>
                              <th style={S.th}>Code</th>
                              <th style={S.th}>Details</th>
                              <th style={S.th}>Condition</th>
                              <th style={S.th}>Status</th>
                              <th style={S.th}>Notes</th>
                              <th style={{ ...S.th, textAlign: 'right' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayItems.map(item => (
                              <tr key={item.id} className="ledger-row">
                                <td style={{ ...S.td, fontFamily: 'Consolas,Monaco,monospace', fontWeight: 700, color: '#0B1F3A', whiteSpace: 'nowrap' }}>{item.code}</td>
                                <td style={{ ...S.td, color: '#5A5248' }}>{itemDetail(item)}</td>
                                <td style={{ ...S.td, color: config.condColor[item.condition] || '#5A5248', fontWeight: 600 }}>{item.condition}</td>
                                <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', color: config.statusColor[item.status] || '#5A5248' }}>
                                    <Dot color={config.statusColor[item.status]} />{item.status}
                                  </span>
                                </td>
                                <td style={{ ...S.td, color: '#A89880', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.notes || '—'}</td>
                                <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  <button onClick={() => openEdit(item)} style={{ ...S.btnGh, color: '#1D4ED8', marginRight: 12 }}>Edit</button>
                                  <button onClick={() => setDelTarget(item)} style={{ ...S.btnGh, color: '#B91C1C' }}>Delete</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {anyFilter && <div style={{ marginTop: 12, fontSize: 12, color: '#9CA3AF', textAlign: 'right' }}>{filteredItems.length} of {(items || []).length} items match</div>}
      </main>

      {/* ADD / EDIT MODAL */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,14,27,0.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 56, zIndex: 50 }}
          onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={{ background: 'white', width: '100%', maxWidth: 440, maxHeight: '88vh', overflow: 'auto', borderRadius: 3, boxShadow: '0 24px 60px rgba(7,14,27,0.4)' }}>
            <div style={{ background: '#0B1F3A', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1 }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 14, letterSpacing: '0.02em' }}>{editing ? `Edit ${editing.code}` : 'Add equipment item'}</span>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.label}>Equipment type</label>
                <select value={form.type} onChange={e => !editing && changeType(e.target.value)} disabled={!!editing}
                  style={{ ...S.input, opacity: editing ? 0.65 : 1, cursor: editing ? 'default' : 'pointer' }}>
                  <option value="">Select type…</option>
                  {config.typeOrder.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {form.type && (<>
                <div>
                  <label style={S.label}>Item code</label>
                  <input type="text" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    style={{ ...S.input, fontFamily: 'Consolas,Monaco,monospace' }} placeholder="e.g. WF001" />
                  <p style={{ margin: '5px 0 0', fontSize: 11, color: '#A89880' }}>Auto-generated — override if needed.</p>
                </div>
                {tinfo?.size && (
                  <div>
                    <label style={S.label}>Size</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {config.sizes.map(s => (
                        <button key={s} onClick={() => setForm(f => ({ ...f, size: s }))}
                          style={{
                            flex: 1, padding: '7px 0', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                            border: form.size === s ? '2px solid #C49A1C' : '1px solid #D5CFC5',
                            background: form.size === s ? '#C49A1C' : 'white',
                            color: form.size === s ? 'white' : '#5A5248', borderRadius: 2
                          }}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {tinfo?.hand && (
                  <div>
                    <label style={S.label}>Handedness</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['Right', 'Left'].map(h => (
                        <button key={h} onClick={() => setForm(f => ({ ...f, hand: h }))}
                          style={{
                            flex: 1, padding: '9px 0', cursor: 'pointer', fontSize: 13,
                            border: form.hand === h ? '2px solid #C49A1C' : '1px solid #D5CFC5',
                            background: form.hand === h ? '#C49A1C' : 'white',
                            color: form.hand === h ? 'white' : '#5A5248', borderRadius: 2
                          }}>{h}-handed</button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[['Condition', 'condition', config.conditions], ['Status', 'status', config.statuses]].map(([lbl, key, opts]) => (
                    <div key={key}>
                      <label style={S.label}>{lbl}</label>
                      <select value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ ...S.input, cursor: 'pointer' }}>
                        {opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div>
                  <label style={S.label}>Notes <span style={{ fontWeight: 400, color: '#A89880' }}>(optional)</span></label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Any notes about this item…"
                    style={{ ...S.input, resize: 'vertical', minHeight: 56 }} />
                </div>
              </>)}
              {formErr && <p style={{ margin: 0, fontSize: 12, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 2, padding: '8px 12px' }}>{formErr}</p>}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #EAE6DF', display: 'flex', justifyContent: 'flex-end', gap: 8, position: 'sticky', bottom: 0, background: 'white' }}>
              <button onClick={closeModal} style={S.btnOut}>Cancel</button>
              <button onClick={save} disabled={!form.type || saving}
                style={{ ...S.btnGold, opacity: (form.type && !saving) ? 1 : 0.45, cursor: (form.type && !saving) ? 'pointer' : 'not-allowed' }}>
                {saving ? 'Saving…' : (editing ? 'Save changes' : 'Add item')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {delTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,14,27,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '0 16px' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: 380, borderRadius: 3, padding: 24, boxShadow: '0 24px 60px rgba(7,14,27,0.4)' }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 16, color: '#0B1F3A' }}>Delete {delTarget.code}?</p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#7A7265', lineHeight: 1.55 }}>
              Permanently removes this <strong style={{ color: '#0B1F3A' }}>{delTarget.type}</strong>
              {itemDetail(delTarget) !== '—' ? ` (${itemDetail(delTarget)})` : ''} from the register.
            </p>
            {delTarget._error && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#B91C1C' }}>{delTarget._error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDelTarget(null)} style={S.btnOut} disabled={deleting}>Cancel</button>
              <button onClick={() => del(delTarget.id)} style={{ ...S.btnGold, background: '#B91C1C', opacity: deleting ? 0.6 : 1 }} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
