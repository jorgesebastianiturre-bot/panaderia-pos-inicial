'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { BarChart2, Search, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatPrecio, formatFecha } from '@/lib/utils';

export default function ReportesPage() {
  const supabase = createClient();
  const { usuario } = useSesion();
  const [ventas,     setVentas]   = useState<any[]>([]);
  const [cargando,   setCargando] = useState(false);
  const [desde,      setDesde]    = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [hasta,      setHasta]    = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => { buscar(); }, []);

  async function buscar() {
    setCargando(true);
    const ini = new Date(desde + 'T00:00:00').getTime();
    const fin = new Date(hasta + 'T23:59:59').getTime();

    const { data } = await supabase
      .from('ventas')
      .select('id, fecha, total, medio_pago, pagos, anulada, venta_items(nombre_snapshot, cantidad, subtotal)')
      .gte('fecha', ini)
      .lte('fecha', fin)
      .order('fecha', { ascending: true });

    if (data) setVentas(data);
    setCargando(false);
  }

  const activas = ventas.filter((v) => !v.anulada);

  // Totales generales
  const totales = activas.reduce((acc, v) => {
    acc.total += v.total;
    if (v.medio_pago === 'EFECTIVO') acc.efectivo += v.total;
    else if (v.medio_pago === 'TRANSFERENCIA') acc.transferencia += v.total;
    else if (v.medio_pago === 'CUENTA_CORRIENTE') acc.cc += v.total;
    else if (v.medio_pago === 'MIXTO') {
      const p = Array.isArray(v.pagos) ? v.pagos : (typeof v.pagos === 'string' ? JSON.parse(v.pagos || '[]') : []);
      p.forEach((x: any) => {
        if (x.medio === 'EFECTIVO') acc.efectivo += x.monto;
        else if (x.medio === 'TRANSFERENCIA') acc.transferencia += x.monto;
        else if (x.medio === 'CUENTA_CORRIENTE') acc.cc += x.monto;
      });
    }
    return acc;
  }, { efectivo: 0, transferencia: 0, cc: 0, total: 0 });

  // Agrupar por día
  const porDia: Record<string, { fecha: string; ventas: number; total: number; efectivo: number; transferencia: number; cc: number }> = {};
  activas.forEach((v) => {
    const dia = new Date(v.fecha).toISOString().split('T')[0];
    if (!porDia[dia]) porDia[dia] = { fecha: dia, ventas: 0, total: 0, efectivo: 0, transferencia: 0, cc: 0 };
    porDia[dia].ventas++;
    porDia[dia].total += v.total;
    if (v.medio_pago === 'EFECTIVO') porDia[dia].efectivo += v.total;
    else if (v.medio_pago === 'TRANSFERENCIA') porDia[dia].transferencia += v.total;
    else if (v.medio_pago === 'CUENTA_CORRIENTE') porDia[dia].cc += v.total;
    else if (v.medio_pago === 'MIXTO') {
      const p = Array.isArray(v.pagos) ? v.pagos : (typeof v.pagos === 'string' ? JSON.parse(v.pagos || '[]') : []);
      p.forEach((x: any) => {
        if (x.medio === 'EFECTIVO') porDia[dia].efectivo += x.monto;
        else if (x.medio === 'TRANSFERENCIA') porDia[dia].transferencia += x.monto;
        else if (x.medio === 'CUENTA_CORRIENTE') porDia[dia].cc += x.monto;
      });
    }
  });

  const diasOrdenados = Object.values(porDia).sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Productos más vendidos
  const prodMap: Record<string, { nombre: string; cantidad: number; total: number }> = {};
  activas.forEach((v) => {
    (v.venta_items ?? []).forEach((i: any) => {
      if (!prodMap[i.nombre_snapshot]) prodMap[i.nombre_snapshot] = { nombre: i.nombre_snapshot, cantidad: 0, total: 0 };
      prodMap[i.nombre_snapshot].cantidad += i.cantidad;
      prodMap[i.nombre_snapshot].total += i.subtotal;
    });
  });
  const topProductos = Object.values(prodMap).sort((a, b) => b.total - a.total).slice(0, 10);

  function descargarCSV() {
    const filas = [
      ['Fecha', 'Ventas', 'Total', 'Efectivo', 'Transferencia', 'Cta.Cte.'],
      ...diasOrdenados.map((d) => [d.fecha, d.ventas, d.total, d.efectivo, d.transferencia, d.cc]),
      [],
      ['TOTAL', activas.length, totales.total, totales.efectivo, totales.transferencia, totales.cc],
    ];
    const csv = filas.map((f) => f.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `reporte-ventas-${desde}-${hasta}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (!usuario || !['ADMIN', 'GESTOR'].includes(usuario.rol)) {
    return <div className="flex-1 flex items-center justify-center p-4"><p className="text-pan-600 text-sm">Solo administradores y gestores.</p></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="text-pan-500"/>
          <h1 className="font-display font-bold text-xl text-pan-200">Reportes</h1>
        </div>
        <button onClick={descargarCSV} className="btn-secondary btn-sm gap-1">
          <Download size={14}/> CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="card space-y-3">
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[130px]">
            <label className="label text-xs">Desde</label>
            <input className="input text-sm" type="date" value={desde} onChange={(e) => setDesde(e.target.value)}/>
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="label text-xs">Hasta</label>
            <input className="input text-sm" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}/>
          </div>
        </div>
        <button onClick={buscar} disabled={cargando} className="btn-primary w-full gap-2">
          <Search size={14}/> {cargando ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Resumen general */}
      <div className="card space-y-3">
        <h3 className="font-medium text-pan-300">Resumen del período</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="px-3 py-2 rounded-xl bg-bg-card border border-bg-border">
            <p className="text-pan-600 text-xs">Total ventas</p>
            <p className="text-pan-200 font-bold text-lg">{formatPrecio(totales.total)}</p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-bg-card border border-bg-border">
            <p className="text-pan-600 text-xs">Cantidad</p>
            <p className="text-pan-200 font-bold text-lg">{activas.length} ventas</p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-bg-card border border-bg-border">
            <p className="text-pan-600 text-xs">Efectivo</p>
            <p className="text-pan-300 font-bold">{formatPrecio(totales.efectivo)}</p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-bg-card border border-bg-border">
            <p className="text-pan-600 text-xs">Transferencia</p>
            <p className="text-pan-300 font-bold">{formatPrecio(totales.transferencia)}</p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-bg-card border border-bg-border">
            <p className="text-pan-600 text-xs">Cta. Cte.</p>
            <p className="text-pan-300 font-bold">{formatPrecio(totales.cc)}</p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-bg-card border border-bg-border">
            <p className="text-pan-600 text-xs">Promedio/día</p>
            <p className="text-pan-300 font-bold">
              {diasOrdenados.length > 0 ? formatPrecio(totales.total / diasOrdenados.length) : '$0'}
            </p>
          </div>
        </div>
      </div>

      {/* Por día */}
      {diasOrdenados.length > 0 && (
        <div className="card space-y-2">
          <h3 className="font-medium text-pan-300 mb-2">Desglose por día</h3>
          {diasOrdenados.map((d) => (
            <div key={d.fecha} className="border-b border-bg-border pb-2 last:border-0 last:pb-0">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-pan-300 font-medium text-sm">{d.fecha}</p>
                  <p className="text-pan-600 text-xs">{d.ventas} venta{d.ventas !== 1 ? 's' : ''}</p>
                </div>
                <p className="text-pan-200 font-bold">{formatPrecio(d.total)}</p>
              </div>
              <div className="flex gap-3 mt-1 text-xs text-pan-600">
                {d.efectivo > 0 && <span>Ef: {formatPrecio(d.efectivo)}</span>}
                {d.transferencia > 0 && <span>Tr: {formatPrecio(d.transferencia)}</span>}
                {d.cc > 0 && <span>CC: {formatPrecio(d.cc)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top productos */}
      {topProductos.length > 0 && (
        <div className="card space-y-2">
          <h3 className="font-medium text-pan-300 mb-2">Top 10 productos</h3>
          {topProductos.map((p, i) => (
            <div key={p.nombre} className="flex items-center gap-3">
              <span className="text-pan-700 text-xs w-4 shrink-0">{i + 1}</span>
              <p className="text-pan-300 text-sm flex-1 truncate">{p.nombre}</p>
              <div className="text-right shrink-0">
                <p className="text-pan-200 font-medium text-sm">{formatPrecio(p.total)}</p>
                <p className="text-pan-600 text-xs">{p.cantidad} u.</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activas.length === 0 && !cargando && (
        <p className="text-pan-700 text-sm text-center py-6">Sin ventas en el período seleccionado</p>
      )}
    </div>
  );
}
