'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { History, Search, Download, TrendingUp, ShoppingCart, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatPrecio, formatFecha } from '@/lib/utils';

type Tab = 'ventas' | 'compras' | 'articulos' | 'produccion';

const hoy   = new Date().toISOString().split('T')[0];
const hace7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
const hace30= new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

export default function HistorialPage() {
  const supabase = createClient();
  const { usuario } = useSesion();

  const [tab,      setTab]    = useState<Tab>('ventas');
  const [desde,    setDesde]  = useState(inicioMes);
  const [hasta,    setHasta]  = useState(hoy);
  const [cargando, setCarg]   = useState(false);

  // Datos ventas
  const [ventas,       setVentas]      = useState<any[]>([]);
  const [ventaItems,   setVentaItems]  = useState<any[]>([]);

  // Datos compras
  const [compras,      setCompras]     = useState<any[]>([]);

  // Datos artículos
  const [movimientos,  setMovs]        = useState<any[]>([]);
  const [produccion,   setProduccion]  = useState<any[]>([]);
  const [resumenVentas, setResumen]    = useState<any>(null);

  // Filtros secundarios
  const [filtroProv,   setFiltroProv]  = useState('');
  const [filtroTurno,  setFiltroTurno] = useState(''); // 'MANIANA' | 'TARDE' | ''
  const [turnos,       setTurnos]      = useState<any[]>([]);
  const [proveedores,  setProveedores] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('proveedores').select('id, nombre').order('nombre').then(({ data }) => { if (data) setProveedores(data); });
    supabase.from('turnos').select('id, tipo, fecha').order('fecha', { ascending: false }).limit(60).then(({ data }) => { if (data) setTurnos(data); });
  }, []);

  useEffect(() => { buscar(); }, [tab, desde, hasta]);

  async function buscar() {
    setCarg(true);
    const ini = new Date(desde + 'T00:00:00').getTime();
    const fin = new Date(hasta + 'T23:59:59').getTime();

    if (tab === 'ventas') {
      // Query de resumen sin límite para totales exactos
      // Traer TODAS las ventas del período paginando de a 1000
      (async () => {
        let todas: any[] = [];
        let pagina = 0;
        const tamanio = 1000;
        while (true) {
          const { data: lote } = await supabase.from('ventas')
            .select('total, medio_pago, turno_id, turnos(tipo)')
            .gte('fecha', ini).lte('fecha', fin)
            .eq('anulada', false)
            .range(pagina * tamanio, (pagina + 1) * tamanio - 1);
          if (!lote || lote.length === 0) break;
          todas = [...todas, ...lote];
          if (lote.length < tamanio) break;
          pagina++;
        }
        const tot = todas.reduce((a,v) => a + v.total, 0);
        const ef  = todas.filter(v => v.medio_pago === 'EFECTIVO').reduce((a,v) => a + v.total, 0);
        const tr  = todas.filter(v => v.medio_pago === 'TRANSFERENCIA').reduce((a,v) => a + v.total, 0);
        const cc  = todas.filter(v => v.medio_pago === 'CUENTA_CORRIENTE').reduce((a,v) => a + v.total, 0);
        const man = todas.filter(v => v.turnos?.tipo === 'MANIANA').reduce((a,v) => a + v.total, 0);
        const tar = todas.filter(v => v.turnos?.tipo === 'TARDE').reduce((a,v) => a + v.total, 0);
        setResumen({ total: tot, efectivo: ef, transferencia: tr, cc, maniana: man, tarde: tar, cant: todas.length });
      })();

      const [{ data: vs }, { data: vi }] = await Promise.all([
        (() => {
          let q = supabase.from('ventas')
            .select('id, numero, fecha, total, medio_pago, anulada, turno_id, clientes(nombre), turnos(tipo, fecha)')
            .gte('fecha', ini).lte('fecha', fin)
            .order('fecha', { ascending: false }).limit(5000);
          return q;
        })(),
        supabase.from('venta_items')
          .select('venta_id, nombre_snapshot, cantidad, subtotal, precio_unitario')
          .limit(5000),
      ]);
      setVentas(vs ?? []);
      setVentaItems(vi ?? []);

    } else if (tab === 'compras') {
      const { data } = await supabase.from('compras')
        .select('id, fecha, total, forma_pago, items, proveedor_id, proveedores(nombre)')
        .gte('fecha', ini).lte('fecha', fin)
        .order('fecha', { ascending: false }).limit(500);
      setCompras(data ?? []);

    } else if (tab === 'produccion') {
      const { data } = await supabase.from('movimientos_stock')
        .select('id, cantidad, fecha, notas, producto_id, productos(nombre, precio, tipo)')
        .eq('tipo', 'HORNEADO')
        .gte('fecha', ini).lte('fecha', fin)
        .order('fecha', { ascending: false })
        .limit(2000);
      setProduccion(data ?? []);

    } else if (tab === 'articulos') {
      const { data } = await supabase.from('venta_items')
        .select('nombre_snapshot, cantidad, subtotal, venta_id, ventas!inner(fecha, anulada, turno_id, turnos(tipo))')
        .gte('ventas.fecha', ini).lte('ventas.fecha', fin)
        .eq('ventas.anulada', false)
        .limit(50000);
      setMovs(data ?? []);
    }
    setCarg(false);
  }

  // ===== VENTAS =====
  const ventasActivas = ventas.filter(v => {
    if (v.anulada) return false;
    if (filtroTurno && v.turnos?.tipo !== filtroTurno) return false;
    return true;
  });
  const ventasFiltradas = ventasActivas;

  const totVentas   = resumenVentas?.total ?? ventasActivas.reduce((a, v) => a + v.total, 0);
  const totEfectivo = resumenVentas?.efectivo ?? ventasActivas.filter(v => v.medio_pago === 'EFECTIVO').reduce((a, v) => a + v.total, 0);
  const totTransf   = resumenVentas?.transferencia ?? ventasActivas.filter(v => v.medio_pago === 'TRANSFERENCIA').reduce((a, v) => a + v.total, 0);
  const totCC       = resumenVentas?.cc ?? ventasActivas.filter(v => v.medio_pago === 'CUENTA_CORRIENTE').reduce((a, v) => a + v.total, 0);

  // Ventas por día
  const ventasPorDia: Record<string, { fecha: string; total: number; cant: number }> = {};
  ventasActivas.forEach(v => {
    const dia = new Date(v.fecha).toISOString().split('T')[0];
    if (!ventasPorDia[dia]) ventasPorDia[dia] = { fecha: dia, total: 0, cant: 0 };
    ventasPorDia[dia].total += v.total;
    ventasPorDia[dia].cant++;
  });
  const diasVentas = Object.values(ventasPorDia).sort((a, b) => b.fecha.localeCompare(a.fecha));

  // ===== COMPRAS =====
  const comprasFiltradas = filtroProv ? compras.filter(c => c.proveedor_id === filtroProv) : compras;
  const totCompras = comprasFiltradas.reduce((a, c) => a + c.total, 0);

  // Por proveedor
  const comprasPorProv: Record<string, { nombre: string; total: number; cant: number }> = {};
  compras.forEach(c => {
    const id = c.proveedor_id ?? 'sin-proveedor';
    const nom = c.proveedores?.nombre ?? 'Sin proveedor';
    if (!comprasPorProv[id]) comprasPorProv[id] = { nombre: nom, total: 0, cant: 0 };
    comprasPorProv[id].total += c.total;
    comprasPorProv[id].cant++;
  });
  const provOrdenados = Object.values(comprasPorProv).sort((a, b) => b.total - a.total);

  // Artículos comprados
  const artComprados: Record<string, { nombre: string; cantidad: number; total: number }> = {};
  comprasFiltradas.forEach(c => {
    (c.items ?? []).forEach((item: any) => {
      const key = item.nombre ?? item.producto_id;
      if (!artComprados[key]) artComprados[key] = { nombre: key, cantidad: 0, total: 0 };
      artComprados[key].cantidad += item.cantidad ?? 0;
      artComprados[key].total += item.subtotal ?? 0;
    });
  });
  const artCompOrdenados = Object.values(artComprados).sort((a, b) => b.total - a.total);

  // ===== ARTÍCULOS VENDIDOS =====
  const ranking: Record<string, { nombre: string; cantidad: number; total: number; ventas: number }> = {};
  movimientos
    .filter(m => !filtroTurno || m.ventas?.turnos?.tipo === filtroTurno)
    .forEach(m => {
      const key = m.nombre_snapshot;
      if (!ranking[key]) ranking[key] = { nombre: key, cantidad: 0, total: 0, ventas: 0 };
      ranking[key].cantidad += m.cantidad;
      ranking[key].total += m.subtotal;
      ranking[key].ventas++;
    });
  const rankingOrdenado = Object.values(ranking).sort((a, b) => b.total - a.total);

  const totArticulos = rankingOrdenado.reduce((a, r) => a + r.total, 0);

  // Producción agrupada por producto
  const rankingProd: Record<string, { nombre: string; tipo: string; cantidad: number; valor: number; registros: number }> = {};
  produccion.forEach(m => {
    const key = m.producto_id;
    const nombre = m.productos?.nombre ?? key;
    const tipo = m.productos?.tipo ?? '';
    if (!rankingProd[key]) rankingProd[key] = { nombre, tipo, cantidad: 0, valor: 0, registros: 0 };
    rankingProd[key].cantidad += m.cantidad;
    rankingProd[key].valor += (m.productos?.precio ?? 0) * m.cantidad;
    rankingProd[key].registros++;
  });
  const rankingProdOrdenado = Object.values(rankingProd).sort((a, b) => b.cantidad - a.cantidad);
  const totProdUnidades = rankingProdOrdenado.reduce((a, r) => a + r.cantidad, 0);
  const totProdValor = rankingProdOrdenado.reduce((a, r) => a + r.valor, 0);

  // Producción por día
  const prodPorDia: Record<string, { fecha: string; cantidad: number; valor: number; items: any[] }> = {};
  produccion.forEach(m => {
    const dia = new Date(m.fecha).toISOString().split('T')[0];
    if (!prodPorDia[dia]) prodPorDia[dia] = { fecha: dia, cantidad: 0, valor: 0, items: [] };
    prodPorDia[dia].cantidad += m.cantidad;
    prodPorDia[dia].valor += (m.productos?.precio ?? 0) * m.cantidad;
    prodPorDia[dia].items.push(m);
  });
  const diasProd = Object.values(prodPorDia).sort((a, b) => b.fecha.localeCompare(a.fecha));

  function descargarCSV() {
    let filas: any[][] = [];
    if (tab === 'ventas') {
      filas = [
        ['Fecha', '#', 'Total', 'Medio', 'Cliente'],
        ...ventasFiltradas.map(v => [new Date(v.fecha).toLocaleDateString('es-AR'), v.numero, v.total, v.medio_pago, v.clientes?.nombre ?? '']),
        [], ['TOTAL', '', totVentas, '', ''],
      ];
    } else if (tab === 'compras') {
      filas = [
        ['Fecha', 'Proveedor', 'Total', 'Forma Pago'],
        ...comprasFiltradas.map(c => [new Date(c.fecha).toLocaleDateString('es-AR'), c.proveedores?.nombre ?? '', c.total, c.forma_pago]),
        [], ['TOTAL', '', totCompras, ''],
      ];
    } else if (tab === 'produccion') {
      filas = [
        ['Producto', 'Unidades producidas', 'Valor $', 'Registros'],
        ...rankingProdOrdenado.map(r => [r.nombre, r.cantidad, r.valor, r.registros]),
        [], ['TOTAL', totProdUnidades, totProdValor, ''],
      ];
    } else {
      filas = [
        ['Producto', 'Unidades vendidas', 'Total $', 'Nro ventas'],
        ...rankingOrdenado.map(r => [r.nombre, r.cantidad, r.total, r.ventas]),
        [], ['TOTAL', rankingOrdenado.reduce((a,r)=>a+r.cantidad,0), totArticulos, ''],
      ];
    }
    const csv = filas.map(f => f.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `historial-${tab}-${desde}-${hasta}.csv`; a.click();
  }

  const PERIODOS = [
    { label: 'Hoy',       d: hoy,    h: hoy },
    { label: '7 días',    d: hace7,  h: hoy },
    { label: 'Este mes',  d: inicioMes, h: hoy },
    { label: '30 días',   d: hace30, h: hoy },
  ];

  if (!usuario || !['ADMIN','GESTOR'].includes(usuario.rol)) {
    return <div className="flex-1 flex items-center justify-center"><p className="text-pan-600 text-sm">Solo administradores y gestores.</p></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="text-pan-500"/>
          <h1 className="font-display font-bold text-xl text-pan-200">Historial</h1>
        </div>
        <button onClick={descargarCSV} className="btn-secondary btn-sm gap-1">
          <Download size={14}/> CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { val:'ventas',    label:'🛒 Ventas',     icon:<TrendingUp size={15}/> },
          { val:'compras',   label:'📦 Compras',    icon:<Package size={15}/> },
          { val:'produccion',label:'🔥 Producción', icon:<Package size={15}/> },
          { val:'articulos', label:'🏷 Artículos',  icon:<ShoppingCart size={15}/> },
        ] as any[]).map(t => (
          <button key={t.val} onClick={() => setTab(t.val)}
            className={`btn flex-1 btn-sm ${tab === t.val ? 'btn-primary' : 'btn-secondary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtro de fechas */}
      <div className="card space-y-3">
        <div className="flex gap-2 flex-wrap">
          {PERIODOS.map(p => (
            <button key={p.label} onClick={() => { setDesde(p.d); setHasta(p.h); }}
              className={`btn btn-sm ${desde === p.d && hasta === p.h ? 'btn-primary' : 'btn-secondary'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="flex-1"><label className="label text-xs">Desde</label><input className="input text-sm" type="date" value={desde} onChange={e => setDesde(e.target.value)}/></div>
          <div className="flex-1"><label className="label text-xs">Hasta</label><input className="input text-sm" type="date" value={hasta} onChange={e => setHasta(e.target.value)}/></div>
        </div>
        {(tab === 'ventas' || tab === 'articulos') && (
          <div className="flex gap-2">
            {['', 'MANIANA', 'TARDE'].map(t => (
              <button key={t} onClick={() => setFiltroTurno(t)}
                className={`btn btn-sm flex-1 ${filtroTurno === t ? 'btn-primary' : 'btn-secondary'}`}>
                {t === '' ? 'Todos los turnos' : t === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'}
              </button>
            ))}
          </div>
        )}
        {tab === 'compras' && (
          <select className="input text-sm" value={filtroProv} onChange={e => setFiltroProv(e.target.value)}>
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        )}
      </div>

      {cargando ? (
        <p className="text-pan-700 text-center py-10">Cargando...</p>
      ) : (
        <>
          {/* ===== TAB VENTAS ===== */}
          {tab === 'ventas' && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 gap-3">
                <div className="card"><p className="text-pan-600 text-xs">Total vendido</p><p className="text-pan-100 font-bold text-xl">{formatPrecio(totVentas)}</p></div>
                <div className="card"><p className="text-pan-600 text-xs">Cantidad ventas</p><p className="text-pan-100 font-bold text-xl">{ventasActivas.length}</p></div>
                <div className="card"><p className="text-pan-600 text-xs">Ticket promedio</p><p className="text-pan-300 font-bold text-lg">{ventasActivas.length > 0 ? formatPrecio(Math.round(totVentas / ventasActivas.length)) : '$0'}</p></div>
                <div className="card"><p className="text-pan-600 text-xs">Anuladas</p><p className="text-pan-300 font-bold text-lg">{ventas.filter(v=>v.anulada).length}</p></div>
              </div>

              {/* Por turno */}
              {!filtroTurno && (
                <div className="card space-y-2">
                  <h3 className="font-medium text-pan-300 text-sm">Por turno</h3>
                  {['MANIANA','TARDE'].map(turno => {
                    const ventasTurno = ventasActivas.filter(v => v.turnos?.tipo === turno);
                    const totTurno = ventasTurno.reduce((a,v) => a+v.total, 0);
                    if (ventasTurno.length === 0) return null;
                    return (
                      <div key={turno} className="flex items-center justify-between py-1.5 border-b border-bg-border last:border-0 text-sm">
                        <div>
                          <span className="text-pan-300">{turno === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'}</span>
                          <span className="text-pan-600 text-xs ml-2">{ventasTurno.length} ventas</span>
                        </div>
                        <span className="text-pan-200 font-bold">{formatPrecio(totTurno)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Por medio de pago */}
              <div className="card space-y-2">
                <h3 className="font-medium text-pan-300 text-sm">Por medio de pago</h3>
                {[
                  { label:'💵 Efectivo',       val: totEfectivo, pct: totVentas > 0 ? Math.round(totEfectivo/totVentas*100) : 0 },
                  { label:'📱 Transferencia',  val: totTransf,   pct: totVentas > 0 ? Math.round(totTransf/totVentas*100)   : 0 },
                  { label:'📋 Cta. Corriente', val: totCC,       pct: totVentas > 0 ? Math.round(totCC/totVentas*100)       : 0 },
                ].map(({ label, val, pct }) => val > 0 && (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-pan-400 text-sm w-36 shrink-0">{label}</span>
                    <div className="flex-1 bg-bg-card rounded-full h-2">
                      <div className="bg-pan-500 h-2 rounded-full" style={{ width: `${pct}%` }}/>
                    </div>
                    <span className="text-pan-300 text-sm font-medium w-24 text-right shrink-0">{formatPrecio(val)}</span>
                    <span className="text-pan-600 text-xs w-8 shrink-0">{pct}%</span>
                  </div>
                ))}
              </div>

              {/* Por día */}
              <div className="card space-y-1">
                <h3 className="font-medium text-pan-300 text-sm mb-2">Por día</h3>
                {diasVentas.length === 0 ? <p className="text-pan-700 text-sm">Sin ventas en el período</p> : diasVentas.map(d => (
                  <div key={d.fecha} className="flex items-center justify-between py-1.5 border-b border-bg-border last:border-0 text-sm">
                    <div>
                      <span className="text-pan-300">{new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short' })}</span>
                      <span className="text-pan-600 text-xs ml-2">{d.cant} venta{d.cant !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-pan-200 font-bold">{formatPrecio(d.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== TAB COMPRAS ===== */}
          {tab === 'compras' && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 gap-3">
                <div className="card"><p className="text-pan-600 text-xs">Total comprado</p><p className="text-pan-100 font-bold text-xl">{formatPrecio(totCompras)}</p></div>
                <div className="card"><p className="text-pan-600 text-xs">Compras</p><p className="text-pan-100 font-bold text-xl">{comprasFiltradas.length}</p></div>
              </div>

              {/* Por proveedor */}
              {!filtroProv && (
                <div className="card space-y-2">
                  <h3 className="font-medium text-pan-300 text-sm">Por proveedor</h3>
                  {provOrdenados.length === 0 ? <p className="text-pan-700 text-sm">Sin compras</p> : provOrdenados.map(p => (
                    <div key={p.nombre} className="flex items-center justify-between py-1.5 border-b border-bg-border last:border-0 text-sm">
                      <div>
                        <span className="text-pan-300">{p.nombre}</span>
                        <span className="text-pan-600 text-xs ml-2">{p.cant} compra{p.cant !== 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-pan-200 font-bold">{formatPrecio(p.total)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Artículos comprados */}
              {artCompOrdenados.length > 0 && (
                <div className="card space-y-1">
                  <h3 className="font-medium text-pan-300 text-sm mb-2">Artículos comprados</h3>
                  {artCompOrdenados.map((a, i) => (
                    <div key={a.nombre} className="flex items-center justify-between py-1.5 border-b border-bg-border last:border-0 text-sm">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-pan-700 text-xs w-5 shrink-0">{i+1}</span>
                        <span className="text-pan-300 truncate">{a.nombre}</span>
                        <span className="text-pan-600 text-xs shrink-0">{a.cantidad} u.</span>
                      </div>
                      <span className="text-pan-200 font-bold shrink-0 ml-2">{formatPrecio(a.total)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Lista de compras */}
              <div className="card space-y-2">
                <h3 className="font-medium text-pan-300 text-sm">Detalle de compras</h3>
                {comprasFiltradas.length === 0 ? <p className="text-pan-700 text-sm">Sin compras en el período</p> : comprasFiltradas.map(c => (
                  <div key={c.id} className="border-b border-bg-border last:border-0 py-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-pan-200 font-bold">{formatPrecio(c.total)}</span>
                          {c.proveedores?.nombre && <span className="badge badge-info text-xs">{c.proveedores.nombre}</span>}
                          <span className="text-pan-600 text-xs">{c.forma_pago}</span>
                        </div>
                        <p className="text-pan-600 text-xs">{formatFecha(c.fecha)}</p>
                        {(c.items ?? []).length > 0 && (
                          <p className="text-pan-700 text-xs mt-0.5 truncate">
                            {(c.items as any[]).slice(0,3).map((i:any) => `${i.nombre} ×${i.cantidad}`).join(' · ')}
                            {c.items.length > 3 && ` +${c.items.length-3} más`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== TAB PRODUCCIÓN ===== */}
          {tab === 'produccion' && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 gap-3">
                <div className="card"><p className="text-pan-600 text-xs">Total producido</p><p className="text-pan-100 font-bold text-xl">{totProdUnidades.toLocaleString('es-AR')} u.</p></div>
                <div className="card"><p className="text-pan-600 text-xs">Valor producción</p><p className="text-pan-100 font-bold text-xl">{formatPrecio(totProdValor)}</p></div>
              </div>

              {/* Ranking por producto */}
              {rankingProdOrdenado.length === 0 ? (
                <p className="text-pan-700 text-sm text-center py-8">Sin producción en el período</p>
              ) : (
                <>
                  <div className="card space-y-1">
                    <h3 className="font-medium text-pan-300 text-sm mb-2">Por producto</h3>
                    {rankingProdOrdenado.map((r, i) => {
                      const pct = totProdUnidades > 0 ? Math.round(r.cantidad / totProdUnidades * 100) : 0;
                      return (
                        <div key={r.nombre} className="py-2 border-b border-bg-border last:border-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-pan-700 text-xs w-5 font-mono">{i+1}</span>
                            <span className="text-pan-200 text-sm flex-1 truncate">{r.nombre}</span>
                            <span className="text-pan-200 font-bold text-sm shrink-0">{r.cantidad.toLocaleString('es-AR')} u.</span>
                          </div>
                          <div className="flex items-center gap-2 ml-7">
                            <div className="flex-1 bg-bg-card rounded-full h-1.5">
                              <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${pct}%` }}/>
                            </div>
                            <span className="text-pan-600 text-xs shrink-0">{formatPrecio(r.valor)} · {pct}% · {r.registros} reg.</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Por día */}
                  <div className="card space-y-1">
                    <h3 className="font-medium text-pan-300 text-sm mb-2">Por día</h3>
                    {diasProd.map(d => (
                      <div key={d.fecha} className="py-2 border-b border-bg-border last:border-0">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-pan-300">
                            {new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday:'short', day:'2-digit', month:'short' })}
                          </span>
                          <div className="text-right">
                            <span className="text-pan-200 font-bold">{d.cantidad.toLocaleString('es-AR')} u.</span>
                            <span className="text-pan-600 text-xs ml-2">{formatPrecio(d.valor)}</span>
                          </div>
                        </div>
                        <div className="ml-2 mt-1 space-y-0.5">
                          {d.items.map((m: any, idx: number) => (
                            <p key={idx} className="text-pan-700 text-xs">
                              {m.productos?.nombre}: <span className="text-amber-400">{m.cantidad} u.</span>
                              {m.notas && <span className="text-pan-800 ml-1">· {m.notas}</span>}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== TAB ARTÍCULOS ===== */}}
          {tab === 'articulos' && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 gap-3">
                <div className="card"><p className="text-pan-600 text-xs">Total facturado</p><p className="text-pan-100 font-bold text-xl">{formatPrecio(totArticulos)}</p></div>
                <div className="card"><p className="text-pan-600 text-xs">Artículos distintos</p><p className="text-pan-100 font-bold text-xl">{rankingOrdenado.length}</p></div>
              </div>

              {/* Ranking */}
              <div className="card space-y-1">
                <h3 className="font-medium text-pan-300 text-sm mb-2">Ranking por facturación</h3>
                {rankingOrdenado.length === 0 ? <p className="text-pan-700 text-sm">Sin ventas en el período</p> : rankingOrdenado.map((r, i) => {
                  const pct = totArticulos > 0 ? Math.round(r.total / totArticulos * 100) : 0;
                  return (
                    <div key={r.nombre} className="py-2 border-b border-bg-border last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-pan-700 text-xs w-5 shrink-0 font-mono">{i+1}</span>
                        <span className="text-pan-200 text-sm flex-1 truncate">{r.nombre}</span>
                        <span className="text-pan-200 font-bold text-sm shrink-0">{formatPrecio(r.total)}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-7">
                        <div className="flex-1 bg-bg-card rounded-full h-1.5">
                          <div className="bg-pan-500 h-1.5 rounded-full" style={{ width: `${pct}%` }}/>
                        </div>
                        <span className="text-pan-600 text-xs shrink-0">{r.cantidad} u. · {pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
