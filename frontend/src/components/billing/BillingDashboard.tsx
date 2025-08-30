import { useEffect, useState, useCallback, useMemo } from 'react';
import { Download, Filter, RefreshCw, Search, DollarSign, ChevronLeft, ChevronRight, LineChart, X, History } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface BillingRecord {
  id: number; appointment_id: number; service_id: number; service_name?: string; doctor_id: number; doctor_name?: string;
  base_price: number; doctor_price?: number | null; final_price: number; currency: string; status: string; created_at: string;
}
interface SummaryItem { label: string; doctor_name?: string; service_name?: string; count_bills: number; total_final: number; total_base: number; total_doctor_override: number; }

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const statusColors: Record<string,string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  billed: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
};

function formatMoney(v: number, currency: string) {
  return new Intl.NumberFormat('es-CO',{ style:'currency', currency }).format(v);
}

const BillingDashboard = () => {
  const [records, setRecords] = useState<BillingRecord[]>([]); // local filtered slice
  // Autocomplete state
  const [doctorQuery, setDoctorQuery] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');
  const [doctorId, setDoctorId] = useState<number|undefined>(undefined);
  const [serviceId, setServiceId] = useState<number|undefined>(undefined);
  const [doctorOptions, setDoctorOptions] = useState<any[]>([]);
  const [serviceOptions, setServiceOptions] = useState<any[]>([]);
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [auditBillingId, setAuditBillingId] = useState<number|null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]|null>(null);
  const [loading, setLoading] = useState(false); // local spinner for manual refresh
  const [from, setFrom] = useState(() => new Date(Date.now() - 6*24*3600*1000).toISOString().slice(0,10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));
  const [status, setStatus] = useState<string>('');
  const [group, setGroup] = useState<'day'|'doctor'|'service'>('day');
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [search, setSearch] = useState('');
  const [live, setLive] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<any|null>(null);
  const [page, setPage] = useState(1); // restaurado estado de paginación
  const pageSize = 50;
  const token = localStorage.getItem('token') || '';
  const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
  // Extraer rol simple del JWT (payload base64) para ocultar acciones no permitidas
  let userRole: string | null = null;
  try {
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1] || ''));
      userRole = payload.role || null;
    }
  } catch { userRole = null; }
  const qc = useQueryClient();

  const listKey = useMemo(()=>['billing','list',{from,to,status,doctorId,serviceId,page,sortKey,sortDir,search}], [from,to,status,doctorId,serviceId,page,sortKey,sortDir,search]);
  const summaryKey = useMemo(()=>['billing','summary',{from,to,group}], [from,to,group]);

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      const params: string[] = [];
      if (from) params.push(`from=${from}`);
      if (to) params.push(`to=${to}`);
      if (status) params.push(`status=${status}`);
      if (doctorId) params.push(`doctor_id=${doctorId}`);
      if (serviceId) params.push(`service_id=${serviceId}`);
      if (search) params.push(`q=${encodeURIComponent(search)}`);
      params.push(`limit=${pageSize}`);
      params.push(`offset=${(page-1)*pageSize}`);
      params.push(`sort=${sortKey}`);
      params.push(`dir=${sortDir}`);
      const q = params.length ? '?' + params.join('&') : '';
      const res = await fetch(`${apiBase}/appointment-billing${q}`, { headers });
      if (!res.ok) throw new Error('load error');
      return await res.json(); // { data, total, limit, offset }
    },
    keepPreviousData: true,
    staleTime: 30_000
  });
  const summaryQuery = useQuery({
    queryKey: summaryKey,
    queryFn: async () => {
      const sres = await fetch(`${apiBase}/appointment-billing/summary?from=${from}&to=${to}&group=${group}`, { headers });
      if (!sres.ok) throw new Error('summary error');
      return await sres.json();
    },
    staleTime: 30_000
  });

  useEffect(()=>{
    if (listQuery.data?.data && Array.isArray(listQuery.data.data)) setRecords(listQuery.data.data);
  },[listQuery.data]);
  useEffect(()=>{
    if (summaryQuery.data?.items && Array.isArray(summaryQuery.data.items)) setSummary(summaryQuery.data.items);
  },[summaryQuery.data]);

  const loadingCombined = listQuery.isLoading || summaryQuery.isLoading || loading;

  const manualRefresh = () => {
    setLoading(true);
    Promise.all([qc.invalidateQueries({queryKey:listKey}), qc.invalidateQueries({queryKey:summaryKey}), loadMetrics()]).finally(()=>setLoading(false));
  };

  function exportCsv() {
    const params = [`from=${from}`,`to=${to}`]; if (status) params.push(`status=${status}`);
    const url = `${apiBase}/appointment-billing/export.csv?${params.join('&')}`;
    const a = document.createElement('a'); a.href = url + (token ? `&token=${encodeURIComponent(token)}` : ''); a.download = 'billing.csv'; a.click();
  }
  function exportAuditCsv(id:number){
    const url = `${apiBase}/appointment-billing/${id}/audit.csv` + (token?`?token=${encodeURIComponent(token)}`:'');
    const a = document.createElement('a'); a.href = url; a.download = `billing-audit-${id}.csv`; a.click();
  }

  const total = listQuery.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filtered = records; // server-side ya aplica filtros principales
  const sorted = records; // orden ya aplicado server-side
  const pageRecords = records; // page ya está aplicado server-side
  useEffect(()=>{ setPage(1); },[search, status, from, to, doctorId, serviceId, sortKey, sortDir]);

  const totalFinal = records.reduce((s,r)=>s+Number(r.final_price||0),0);
  const totalBase = records.reduce((s,r)=>s+Number(r.base_price||0),0);
  // Chart data from summary
  const chartData = useMemo(()=> summary.map(s=>({ label: s.doctor_name || s.service_name || s.label, final: Number(s.total_final||0), base: Number(s.total_base||0) })), [summary]);

  // Autocomplete fetchers (debounced naive)
  useEffect(()=> {
    const t = setTimeout(async ()=> {
      if (doctorQuery.length < 2) { setDoctorOptions([]); return; }
      try { const r = await fetch(`${apiBase}/doctors/search/q?q=${encodeURIComponent(doctorQuery)}`, { headers }); if (r.ok) setDoctorOptions(await r.json()); } catch {}
    }, 250);
    return ()=> clearTimeout(t);
  }, [doctorQuery]);
  useEffect(()=> {
    const t = setTimeout(async ()=> {
      if (serviceQuery.length < 2) { setServiceOptions([]); return; }
      try { const r = await fetch(`${apiBase}/services/search/q?q=${encodeURIComponent(serviceQuery)}`, { headers }); if (r.ok) setServiceOptions(await r.json()); } catch {}
    }, 250);
    return ()=> clearTimeout(t);
  }, [serviceQuery]);

  // Audit log modal loader
  useEffect(()=> {
    (async ()=> {
      if (auditBillingId == null) { setAuditLogs(null); return; }
      try {
        const r = await fetch(`${apiBase}/appointment-billing/${auditBillingId}/audit`, { headers });
        if (r.ok) setAuditLogs(await r.json());
      } catch { setAuditLogs([]); }
    })();
  }, [auditBillingId]);

  const loadMetrics = useCallback(async ()=>{
    if (!from || !to) return;
    try { const r = await fetch(`${apiBase}/appointment-billing/metrics?from=${from}&to=${to}`, { headers }); if (r.ok) setMetrics(await r.json()); } catch {}
  },[from,to,headers]);
  useEffect(()=>{ loadMetrics(); },[loadMetrics]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  }
  const totalMargin = totalFinal - totalBase;

  async function updateStatus(id:number,newStatus:string){
    try {
      const res = await fetch(`${apiBase}/appointment-billing/${id}/status`, { method:'PATCH', headers:{ ...headers, 'Content-Type':'application/json' }, body: JSON.stringify({ status: newStatus }) });
      if (res.ok) {
        qc.invalidateQueries({queryKey:listKey});
      }
    } catch { /* ignore */ }
  }

  useEffect(()=> {
    if (!live) return;
    if (!token) return;
    const es = new EventSource(`${apiBase}/appointment-billing/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = ()=>{};
    es.addEventListener('billing_created', (e:any)=> { try { const d = JSON.parse(e.data); qc.invalidateQueries({queryKey:listKey}); qc.invalidateQueries({queryKey:summaryKey}); loadMetrics(); } catch {} });
    es.addEventListener('billing_status_updated', (e:any)=> { qc.invalidateQueries({queryKey:listKey}); qc.invalidateQueries({queryKey:summaryKey}); loadMetrics(); });
    return ()=> { es.close(); };
  },[live, token, listKey, summaryKey, qc, loadMetrics]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-medical-600">Desde</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-medical-600">Hasta</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-medical-600">Estado</label>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="billed">Facturado</option>
            <option value="paid">Pagado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-medical-600">Agrupar</label>
          <select value={group} onChange={e=>setGroup(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
            <option value="day">Día</option>
            <option value="doctor">Doctor</option>
            <option value="service">Servicio</option>
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-medical-600">Buscar</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-2 text-medical-500" />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Servicio o doctor" className="pl-7 border rounded px-2 py-1 text-sm w-full" />
            </div>
        </div>
        <div className="flex gap-2 items-end">
          <button onClick={manualRefresh} className="inline-flex items-center gap-1 bg-medical-600 text-white px-3 py-1.5 rounded text-sm hover:bg-medical-700 disabled:opacity-60" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`} /> Actualizar
          </button>
          <button onClick={exportCsv} className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 -mt-2">
        <div className="relative">
          <label className="block text-xs font-medium text-medical-600">Doctor</label>
          <input value={doctorQuery} onChange={e=>{setDoctorQuery(e.target.value); setDoctorId(undefined);} } placeholder="Buscar doctor" className="border rounded px-2 py-1 text-sm w-48" />
          {doctorOptions.length>0 && (
            <div className="absolute z-10 bg-white border shadow-sm mt-1 max-h-48 overflow-auto w-48 rounded">
              {doctorOptions.map(o => (
                <div key={o.id} onClick={()=>{ setDoctorId(o.id); setDoctorQuery(o.name); setDoctorOptions([]); }} className="px-2 py-1 text-sm hover:bg-medical-50 cursor-pointer">{o.name}</div>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <label className="block text-xs font-medium text-medical-600">Servicio</label>
          <input value={serviceQuery} onChange={e=>{setServiceQuery(e.target.value); setServiceId(undefined);} } placeholder="Buscar servicio" className="border rounded px-2 py-1 text-sm w-48" />
          {serviceOptions.length>0 && (
            <div className="absolute z-10 bg-white border shadow-sm mt-1 max-h-48 overflow-auto w-48 rounded">
              {serviceOptions.map(o => (
                <div key={o.id} onClick={()=>{ setServiceId(o.id); setServiceQuery(o.name); setServiceOptions([]); }} className="px-2 py-1 text-sm hover:bg-medical-50 cursor-pointer">{o.name}</div>
              ))}
            </div>
          )}
        </div>
        {(doctorId || serviceId) && (
          <button onClick={()=>{ setDoctorId(undefined); setServiceId(undefined); setDoctorQuery(''); setServiceQuery(''); }} className="text-xs text-medical-600 underline mt-5">Limpiar filtros avanzados</button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded border shadow-sm">
          <div className="text-xs text-medical-600">Total Final</div>
          <div className="text-xl font-bold text-medical-800">{formatMoney(totalFinal,'COP')}</div>
        </div>
        <div className="p-4 bg-white rounded border shadow-sm">
          <div className="text-xs text-medical-600">Costo Base</div>
          <div className="text-xl font-bold text-medical-800">{formatMoney(totalBase,'COP')}</div>
        </div>
        <div className="p-4 bg-white rounded border shadow-sm">
          <div className="text-xs text-medical-600">Margen</div>
          <div className="text-xl font-bold text-green-700">{formatMoney(totalMargin,'COP')}</div>
        </div>
        <div className="p-4 bg-white rounded border shadow-sm">
          <div className="text-xs text-medical-600">Promedio Ticket</div>
          <div className="text-xl font-bold text-medical-800">{metrics?formatMoney(metrics.avg_ticket||0,'COP'):'-'}</div>
        </div>
        <div className="p-4 bg-white rounded border shadow-sm">
          <div className="text-xs text-medical-600">Total Facturas (rango)</div>
          <div className="text-xl font-bold text-medical-800">{metrics?.total_count ?? '-'}</div>
        </div>
        <div className="p-4 bg-white rounded border shadow-sm">
          <div className="text-xs text-medical-600">Top Servicio</div>
          <div className="text-xs font-medium text-medical-800">{metrics?.top_services?.[0]?.service_name || '-'}</div>
        </div>
        <div className="p-4 bg-white rounded border shadow-sm">
          <div className="text-xs text-medical-600 flex items-center justify-between">
            <span>Tiempo Real</span>
            <input type="checkbox" checked={live} onChange={e=>setLive(e.target.checked)} />
          </div>
          <div className="text-xs mt-1 text-medical-500">SSE {live?'ON':'OFF'}</div>
        </div>
      </div>

      <div className="bg-white rounded border shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-medical-800 flex items-center gap-2"><DollarSign className="w-4 h-4"/>Resumen ({group})</h2>
          <div className="text-xs text-medical-500 flex items-center gap-2"><LineChart className="w-4 h-4" /> Serie de {group}</div>
        </div>
        <div className="overflow-x-auto mb-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left bg-medical-50">
                <th className="p-2">Label</th>
                <th className="p-2">Facturas</th>
                <th className="p-2">Total</th>
                <th className="p-2">Base</th>
                <th className="p-2">Override</th>
                <th className="p-2">Margen</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s,i)=>{
                const margin = Number(s.total_final||0) - Number(s.total_base||0);
                return (
                  <tr key={i} className="border-t">
                    <td className="p-2">{s.doctor_name || s.service_name || s.label}</td>
                    <td className="p-2">{s.count_bills}</td>
                    <td className="p-2">{formatMoney(Number(s.total_final||0),'COP')}</td>
                    <td className="p-2">{formatMoney(Number(s.total_base||0),'COP')}</td>
                    <td className="p-2">{formatMoney(Number(s.total_doctor_override||0),'COP')}</td>
                    <td className="p-2 font-medium text-green-700">{formatMoney(margin,'COP')}</td>
                  </tr>
                );
              })}
              {!summary.length && !loadingCombined && (
                <tr><td colSpan={6} className="p-4 text-center text-medical-500">Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Simple inline bar visualization */}
        <div className="space-y-1">
          {chartData.slice(0,15).map(c => {
            const max = Math.max(...chartData.map(x=>x.final||0),1);
            const width = (c.final / max) * 100;
            return (
              <div key={c.label} className="flex items-center gap-2 text-xs">
                <span className="w-32 truncate" title={c.label}>{c.label}</span>
                <div className="flex-1 h-2 bg-medical-100 rounded overflow-hidden">
                  <div className="h-full bg-medical-500" style={{width: width+'%'}} />
                </div>
                <span className="tabular-nums text-medical-700">{formatMoney(c.final,'COP')}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded border shadow-sm p-4">
        <h2 className="font-semibold text-medical-800 mb-2 flex items-center gap-2"><Filter className="w-4 h-4"/>Detalle ({total})</h2>
        <div className="overflow-x-auto max-h-[480px]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left bg-medical-50 select-none">
                {[
                  ['created_at','Fecha'],
                  ['service_name','Servicio'],
                  ['doctor_name','Doctor'],
                  ['base_price','Base'],
                  ['doctor_price','Override'],
                  ['final_price','Final'],
                  ['status','Estado']
                ].map(([key,label]) => (
                  <th key={key} className="p-2 cursor-pointer" onClick={()=>toggleSort(key)}>
                    {label}
                    {sortKey===key && <span className="ml-1 text-[10px]">{sortDir==='asc'?'▲':'▼'}</span>}
                  </th>
                ))}
                <th className="p-2">Acción</th>
                <th className="p-2">Audit</th>
              </tr>
            </thead>
            <tbody>
              {pageRecords.map(r => (
                <tr key={r.id} className="border-t hover:bg-medical-50">
                  <td className="p-2 whitespace-nowrap">{r.created_at?.slice(0,10)}</td>
                  <td className="p-2">{r.service_name || r.service_id}</td>
                  <td className="p-2">{r.doctor_name || r.doctor_id}</td>
                  <td className="p-2">{formatMoney(Number(r.base_price||0), r.currency)}</td>
                  <td className="p-2">{r.doctor_price != null ? formatMoney(Number(r.doctor_price), r.currency) : '-'}</td>
                  <td className="p-2 font-medium">{formatMoney(Number(r.final_price||0), r.currency)}</td>
                  <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status]||'bg-gray-100 text-gray-700'}`}>{r.status}</span></td>
                  <td className="p-2 whitespace-nowrap">
                    {userRole && ['admin','supervisor'].includes(userRole) ? (
                      <select onChange={e=>updateStatus(r.id,e.target.value)} defaultValue="" className="text-xs border rounded px-1 py-0.5 bg-white">
                        <option value="" disabled>Cambiar</option>
                        {['pending','billed','paid','cancelled'].filter(s=>s!==r.status).map(s=> <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span className="text-medical-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="p-2">
                    {['admin','supervisor'].includes(userRole||'') ? (
                      <button onClick={()=>setAuditBillingId(r.id)} className="text-xs inline-flex items-center gap-1 text-medical-600 hover:text-medical-800 underline"><History className="w-3 h-3"/>Historial</button>
                    ) : <span className="text-medical-300 text-xs">-</span>}
                  </td>
                </tr>
              ))}
              {!filtered.length && !loadingCombined && (
                <tr><td colSpan={7} className="p-4 text-center text-medical-500">Sin registros</td></tr>
              )}
              {loadingCombined && (
                <tr><td colSpan={8} className="p-4 text-center text-medical-500 animate-pulse">Cargando...</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-medical-600">
          <div>Página {page} de {totalPages} ({total} registros)</div>
          <div className="flex gap-2">
            <button disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="inline-flex items-center gap-1 px-2 py-1 border rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4"/>Prev</button>
            <button disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="inline-flex items-center gap-1 px-2 py-1 border rounded disabled:opacity-40">Next<ChevronRight className="w-4 h-4"/></button>
          </div>
        </div>
      </div>
      {auditBillingId != null && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="font-semibold text-medical-800 flex items-center gap-2"><History className="w-4 h-4"/>Auditoría #{auditBillingId}</h3>
              <button onClick={()=>setAuditBillingId(null)} className="p-1 hover:bg-medical-50 rounded"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-4 overflow-auto text-sm">
              {auditLogs == null && <div className="text-medical-500 animate-pulse">Cargando...</div>}
              {auditLogs && !auditLogs.length && <div className="text-medical-500">Sin eventos</div>}
              {auditLogs && auditLogs.length>0 && (
                <div className="mb-2 text-right">
                  <button onClick={()=>exportAuditCsv(auditBillingId!)} className="text-xs underline text-medical-600 hover:text-medical-800">Descargar CSV Auditoría</button>
                </div>
              )}
              {auditLogs && auditLogs.length>0 && (
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left bg-medical-50"><th className="p-2">Fecha</th><th className="p-2">De</th><th className="p-2">A</th><th className="p-2">Usuario</th></tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((l:any)=> (
                      <tr key={l.id} className="border-t">
                        <td className="p-2 whitespace-nowrap">{l.created_at?.slice(0,19).replace('T',' ')}</td>
                        <td className="p-2">{l.old_status||'-'}</td>
                        <td className="p-2 font-medium">{l.new_status}</td>
                        <td className="p-2">{l.changed_by_user_id||'-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingDashboard;
