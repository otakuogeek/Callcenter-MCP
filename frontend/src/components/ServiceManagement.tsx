import { useEffect, useState } from 'react';

interface Service { id:number; name:string; base_price:number; currency:string; active?:number; category?:string; description?:string|null; }

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function ServiceManagement(){
  const [items,setItems] = useState<Service[]>([]);
  const [loading,setLoading] = useState(false);
  const [name,setName] = useState('');
  const [basePrice,setBasePrice] = useState('');
  const [currency,setCurrency] = useState('COP');
  const [category,setCategory] = useState('consulta');
  const [description,setDescription] = useState('');
  const [search,setSearch] = useState('');
  const [editing,setEditing] = useState<Service|null>(null);
  const [toast,setToast] = useState<{type:'success'|'error';msg:string}|null>(null);
  const [showConfirm,setShowConfirm] = useState<{service:Service}|null>(null);
  const [page,setPage] = useState(1);
  const pageSize = 25;
  const token = localStorage.getItem('token') || '';
  const headers: any = token ? { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' } : { 'Content-Type':'application/json' };

  async function load(){
    setLoading(true);
    try {
  const url = search? `${apiBase}/services/search/q?q=${encodeURIComponent(search)}` : `${apiBase}/services`;
  const r = await fetch(url, { headers });
      if (r.ok) setItems(await r.json());
      setPage(1);
    } finally { setLoading(false); }
  }
  useEffect(()=>{ load(); },[]);

  async function createOrUpdate(e:React.FormEvent){
    e.preventDefault();
    if (!name.trim()) return;
    const body = { name, base_price: Number(basePrice)||0, currency, category, description: description||null, active: true };
    try {
      if (editing){
        const r = await fetch(`${apiBase}/services/${editing.id}`, { method:'PUT', headers, body: JSON.stringify(body) });
        if (r.ok) { setToast({type:'success',msg:'Servicio actualizado'}); cancelEdit(); load(); }
        else { const err= await r.json().catch(()=>({})); setToast({type:'error',msg: err.message||'Error al actualizar'}); }
      } else {
        const r = await fetch(`${apiBase}/services`, { method:'POST', headers, body: JSON.stringify(body) });
        if (r.ok) { setToast({type:'success',msg:'Servicio creado'}); resetForm(); load(); }
        else { const err= await r.json().catch(()=>({})); setToast({type:'error',msg: err.message||'Error al crear'}); }
      }
    } catch {}
  }

  function resetForm(){ setName(''); setBasePrice(''); setCurrency('COP'); setCategory('consulta'); setDescription(''); }
  function startEdit(s:Service){ setEditing(s); setName(s.name); setBasePrice(String(s.base_price)); setCurrency(s.currency); setCategory(s.category||'consulta'); setDescription(s.description||''); }
  function cancelEdit(){ setEditing(null); resetForm(); }

  async function toggleActive(s:Service){
    try { const r = await fetch(`${apiBase}/services/${s.id}`, { method:'PUT', headers, body: JSON.stringify({ active: !s.active }) }); if(r.ok){ setToast({type:'success',msg:'Estado actualizado'}); load(); } else { setToast({type:'error',msg:'Error cambiando estado'}); } } catch { setToast({type:'error',msg:'Error red'}); }
  }
  async function removeConfirmed(s:Service){
    try { const r = await fetch(`${apiBase}/services/${s.id}`, { method:'DELETE', headers });
      if (r.status===204){ setToast({type:'success',msg:'Servicio eliminado'}); load(); }
      else if (r.status===409){ const err = await r.json(); setToast({type:'error',msg: err.message||'No se puede eliminar'});} 
      else setToast({type:'error',msg:'Error eliminando'});
    } catch { setToast({type:'error',msg:'Error red'}); }
    finally { setShowConfirm(null); }
  }

  return (
    <div className="space-y-4">
  <form onSubmit={createOrUpdate} className="flex flex-wrap gap-2 items-end bg-white p-3 border rounded">
        <div>
          <label className="block text-xs font-medium text-medical-600">Nombre</label>
          <input value={name} onChange={e=>setName(e.target.value)} className="border rounded px-2 py-1 text-sm" placeholder="Nombre del servicio" />
        </div>
        <div>
          <label className="block text-xs font-medium text-medical-600">Precio Base</label>
          <input value={basePrice} onChange={e=>setBasePrice(e.target.value)} className="border rounded px-2 py-1 text-sm w-32" placeholder="0" />
        </div>
        <div>
          <label className="block text-xs font-medium text-medical-600">Moneda</label>
          <select value={currency} onChange={e=>setCurrency(e.target.value)} className="border rounded px-2 py-1 text-sm w-24">
            <option value="COP">COP</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-medical-600">Categoría</label>
          <select value={category} onChange={e=>setCategory(e.target.value)} className="border rounded px-2 py-1 text-sm w-40">
            {['consulta','laboratorio','imagen','procedimiento','otro'].map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-medical-600">Descripción</label>
          <input value={description} onChange={e=>setDescription(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" placeholder="Descripción opcional" />
        </div>
        <button type="submit" className="bg-medical-600 text-white px-3 py-1.5 rounded text-sm hover:bg-medical-700">{editing? 'Guardar':'Crear'}</button>
        {editing && <button type="button" onClick={cancelEdit} className="text-sm px-3 py-1.5 border rounded text-medical-700">Cancelar</button>}
      </form>

      <div className="flex items-center gap-2 mb-2">
        <input value={search} onChange={e=>{ setSearch(e.target.value); }} placeholder="Buscar..." className="border rounded px-2 py-1 text-sm" />
        <button type="button" onClick={()=>load()} className="text-sm px-2 py-1 border rounded bg-white">Filtrar</button>
      </div>

      <div className="bg-white border rounded shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left bg-medical-50">
              <th className="p-2">ID</th>
              <th className="p-2">Nombre</th>
              <th className="p-2">Categoría</th>
              <th className="p-2">Precio Base</th>
              <th className="p-2">Moneda</th>
              <th className="p-2">Descripción</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.slice((page-1)*pageSize, page*pageSize).map(s=> (
              <tr key={s.id} className="border-t">
                <td className="p-2">{s.id}</td>
                <td className="p-2">{s.name}</td>
                <td className="p-2">{s.category}</td>
                <td className="p-2">{new Intl.NumberFormat('es-CO',{style:'currency',currency:s.currency}).format(s.base_price||0)}</td>
                <td className="p-2">{s.currency}</td>
                <td className="p-2 max-w-[240px] truncate" title={s.description||''}>{s.description||'-'}</td>
                <td className="p-2">{s.active? <span className="inline-block px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">Activo</span>: <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">Inactivo</span>}</td>
                <td className="p-2 space-x-1">
                  <button onClick={()=>startEdit(s)} className="text-xs underline text-medical-600">Editar</button>
                  <button onClick={()=>toggleActive(s)} className="text-xs underline text-medical-600">{s.active?'Desactivar':'Activar'}</button>
                  <button onClick={()=>setShowConfirm({service:s})} className="text-xs underline text-red-600">Borrar</button>
                </td>
              </tr>
            ))}
            {!loading && !items.length && <tr><td colSpan={8} className="p-4 text-center text-medical-500">Sin servicios</td></tr>}
            {loading && <tr><td colSpan={8} className="p-4 text-center text-medical-500 animate-pulse">Cargando...</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between p-2 text-xs text-medical-600">
        <div>Página {page} / {Math.max(1,Math.ceil(items.length/pageSize))}</div>
        <div className="space-x-2">
          <button disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
          <button disabled={page>=Math.ceil(items.length/pageSize)} onClick={()=>setPage(p=>p+1)} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow text-sm text-white ${toast.type==='success'?'bg-green-600':'bg-red-600'}`}
             onClick={()=>setToast(null)}>
          {toast.msg}
        </div>
      )}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-5 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-medical-800 text-sm">Confirmar eliminación</h3>
            <p className="text-xs text-medical-600">Esto eliminará el servicio <strong>{showConfirm.service.name}</strong>. No se puede deshacer.</p>
            <div className="flex justify-end gap-2 text-sm">
              <button onClick={()=>setShowConfirm(null)} className="px-3 py-1 border rounded">Cancelar</button>
              <button onClick={()=>removeConfirmed(showConfirm.service)} className="px-3 py-1 bg-red-600 text-white rounded">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
