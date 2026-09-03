'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useMemo } from 'react';
import { Receipt, Search, X, ChevronDown, ChevronUp, AlertOctagon, Share2, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatPrecio, formatFecha, labelMedio, cx } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function VentasPage() {
  const supabase = createClient();
  const { usuario } = useSesion();

  const [ventas,       setVentas]   = useState<any[]>([]);
  const [cargando,     setCargando] = useState(true);
  const [busqueda,     setBusqueda] = useState('');
  const [filtro,       setFiltro]   = useState<'todas'|'hoy'|'rango'>('todas');
  const [fechaDesde,   setFechaD]   = useState('');
  const [fechaHasta,   setFechaH]   = useState('');
  const [ventaAbierta, setVentaAb]  = useState<string|null>(null);
  const [modalAnular,  setModalAn]  = useState<any|null>(null);
  const [motivoAnul,   setMotivo]   = useState('');
  const [anulando,     setAnulando] = useState(false);

  useEffect(() => { cargar(); }, [filtro, fechaDesde, fechaHasta]);

  async function cargar() {
    setCargando(true);
    try {
      let q = supabase
        .from('ventas')
        .select('id, numero, fecha, total, subtotal, ajuste, medio_pago, pagos, anulada, motivo_anulacion, cliente_id, turno_id, venta_items(id, nombre_snapshot, cantidad, por_peso, precio_unitario, subtotal, promo_id), clientes(nombre)')
        .order('fecha', { ascending: false })
        .limit(300);

      if (filtro === 'hoy') {
        const ini = new Date(); ini.setHours(0,0,0,0);
        const fin = new Date(); fin.setHours(23,59,59,999);
        q = q.gte('fecha', ini.getTime()).lte('fecha', fin.getTime());
      } else if (filtro === 'rango') {
        if (fechaDesde) q = q.gte('fecha', new Date(fechaDesde+'T00:00:00').getTime());
        if (fechaHasta) q = q.lte('fecha', new Date(fechaHasta+'T23:59:59').getTime());
      }

      const { data, error } = await q;
      if (error) { console.error(error); toast.error('Error cargando ventas'); }
      setVentas(data ?? []);
    } finally {
      setCargando(false);
    }
  }

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return ventas;
    const q = busqueda.toLowerCase();
    return ventas.filter((v) =>
      String(v.numero).includes(q) ||
      v.clientes?.nombre?.toLowerCase().includes(q) ||
      v.venta_items?.some((i: any) => i.nombre_snapshot?.toLowerCase().includes(q))
    );
  }, [ventas, busqueda]);

  const resumen = useMemo(() =>
    filtradas.filter((v) => !v.anulada).reduce((acc, v) => {
      acc.total += v.total;
      if (v.medio_pago === 'EFECTIVO') acc.efectivo += v.total;
      else if (v.medio_pago === 'TRANSFERENCIA') acc.transferencia += v.total;
      else if (v.medio_pago === 'CUENTA_CORRIENTE') acc.cc += v.total;
      else if (v.medio_pago === 'MIXTO') {
        const pagosArr = Array.isArray(v.pagos) ? v.pagos : (typeof v.pagos === 'string' ? JSON.parse(v.pagos || '[]') : []);
        pagosArr.forEach((p: any) => {
          if (p.medio === 'EFECTIVO') acc.efectivo += p.monto;
          else if (p.medio === 'TRANSFERENCIA') acc.transferencia += p.monto;
          else if (p.medio === 'CUENTA_CORRIENTE') acc.cc += p.monto;
        });
      }
      return acc;
    }, { efectivo: 0, transferencia: 0, cc: 0, total: 0 }),
    [filtradas]
  );

  async function anularVenta() {
    if (!modalAnular || !usuario) return;
    setAnulando(true);
    const { data, error } = await supabase.rpc('anular_venta', {
      p_venta_id:   modalAnular.id,
      p_usuario_id: usuario.id,
      p_motivo:     motivoAnul || 'Sin motivo',
    });
    if (error || !data?.ok) { toast.error(data?.error ?? 'Error al anular'); setAnulando(false); return; }
    toast.success(`Venta #${modalAnular.numero} anulada`);
    setModalAn(null); setMotivo(''); setAnulando(false);
    cargar();
  }

  function compartir(v: any) {
    const items = (v.venta_items ?? []).map((i: any) =>
      `  • ${i.nombre_snapshot} x${i.por_peso ? i.cantidad.toFixed(2)+'kg' : i.cantidad} = ${formatPrecio(i.subtotal)}`
    ).join('\n');
    const texto = [
      `🥖 *Factura #${v.numero}*`,
      `📅 ${formatFecha(v.fecha)}`,
      v.clientes ? `👤 ${v.clientes.nombre}` : '',
      '', '*Productos:*', items, '',
      `*Total: ${formatPrecio(v.total)}*`,
      `Pago: ${labelMedio(v.medio_pago)}`,
    ].filter(Boolean).join('\n');
    if (navigator.share) navigator.share({ text: texto }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  }

  const noAnuladas = filtradas.filter((v) => !v.anulada).length;

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="text-pan-500"/>
        <h1 className="font-display font-bold text-xl text-pan-200">Historial de Ventas</h1>
      </div>

      <div className="card space-y-3">
        <div className="flex gap-2 flex-wrap">
          {(['todas','hoy','rango'] as const).map((f) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={cx('btn btn-sm capitalize', filtro === f ? 'btn-primary' : 'btn-secondary')}>
              {f === 'todas' ? 'Todas' : f === 'hoy' ? 'Hoy' : <><Filter size={13}/> Rango</>}
            </button>
          ))}
        </div>

        {filtro === 'rango' && (
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[130px]">
              <label className="label text-xs">Desde</label>
              <input className="input text-sm" type="date" value={fechaDesde} onChange={(e) => setFechaD(e.target.value)}/>
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="label text-xs">Hasta</label>
              <input className="input text-sm" type="date" value={fechaHasta} onChange={(e) => setFechaH(e.target.value)}/>
            </div>
          </div>
        )}

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pan-600"/>
          <input className="input pl-8 pr-8 text-sm" placeholder="Buscar por #, cliente o producto..."
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}/>
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-pan-600"><X size={14}/></button>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium text-pan-300 text-sm mb-3">
          {noAnuladas} venta{noAnuladas !== 1 ? 's' : ''}
          {filtro === 'hoy' ? ' hoy' : filtro === 'rango' ? ' en el rango' : ' en total'}
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            { label: 'Efectivo',      val: resumen.efectivo },
            { label: 'Transferencia', val: resumen.transferencia },
            { label: 'Cta. Cte.',    val: resumen.cc },
            { label: 'Total',         val: resumen.total, bold: true },
          ].map(({ label, val, bold }) => (
            <div key={label} className="flex justify-between">
              <span className="text-pan-600">{label}</span>
              <span className={cx(bold ? 'text-pan-100 font-bold text-base' : 'text-pan-300')}>{formatPrecio(val)}</span>
            </div>
          ))}
        </div>
      </div>

      {cargando ? (
        <p className="text-pan-700 text-center py-8">Cargando ventas...</p>
      ) : filtradas.length === 0 ? (
        <div className="card text-center py-10 text-pan-700">
          <p className="text-sm">Sin ventas para mostrar</p>
          {filtro === 'hoy' && <button onClick={() => setFiltro('todas')} className="btn-ghost btn-sm mt-3 text-pan-500">Ver todas →</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((v) => {
            const abierta = ventaAbierta === v.id;
            return (
              <div key={v.id} className={cx('card-sm', v.anulada && 'opacity-50 border-red-900/40')}>
                <button className="w-full text-left" onClick={() => setVentaAb(abierta ? null : v.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-pan-400 text-xs font-mono">#{v.numero}</span>
                        <span className="text-pan-200 font-medium text-sm">{formatPrecio(v.total)}</span>
                        <span className={cx('badge text-xs',
                          v.medio_pago === 'EFECTIVO' ? 'badge-ok' :
                          v.medio_pago === 'TRANSFERENCIA' ? 'badge-info' :
                          v.medio_pago === 'CUENTA_CORRIENTE' ? 'badge-warn' : 'badge-pan')}>
                          {labelMedio(v.medio_pago)}
                        </span>
                        {v.anulada && <span className="badge badge-bad">ANULADA</span>}
                      </div>
                      <p className="text-pan-600 text-xs mt-0.5">
                        {formatFecha(v.fecha)}
                        {v.clientes && ` · ${v.clientes.nombre}`}
                        {' · '}{(v.venta_items ?? []).length} ítem{(v.venta_items ?? []).length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {abierta ? <ChevronUp size={16} className="text-pan-600 shrink-0 mt-1"/> : <ChevronDown size={16} className="text-pan-600 shrink-0 mt-1"/>}
                  </div>
                </button>

                {abierta && (
                  <div className="mt-3 pt-3 border-t border-bg-border space-y-3">
                    <div className="space-y-1">
                      <p className="text-pan-600 text-xs font-medium uppercase tracking-wide">Productos</p>
                      {(v.venta_items ?? []).map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-pan-300 truncate flex-1 pr-2">
                            {item.nombre_snapshot}
                            <span className="text-pan-600 ml-1">× {item.por_peso ? item.cantidad.toFixed(2)+'kg' : item.cantidad}</span>
                            {item.promo_id && <span className="ml-1 text-pan-500 text-xs">🏷</span>}
                          </span>
                          <span className="text-pan-300 shrink-0">{formatPrecio(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1 text-sm">
                      {v.ajuste !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-pan-600">Ajuste</span>
                          <span className={v.ajuste >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {v.ajuste >= 0 ? '+' : ''}{formatPrecio(v.ajuste)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold">
                        <span className="text-pan-400">Total</span>
                        <span className="text-pan-100">{formatPrecio(v.total)}</span>
                      </div>
                    </div>
                    {v.medio_pago === 'MIXTO' && (v.pagos ?? []).length > 0 && (
                      <div className="space-y-1 text-sm">
                        <p className="text-pan-600 text-xs font-medium uppercase tracking-wide">Formas de pago</p>
                        {(v.pagos as any[]).map((p: any, i: number) => (
                          <div key={i} className="flex justify-between">
                            <span className="text-pan-500">{labelMedio(p.medio)}</span>
                            <span className="text-pan-300">{formatPrecio(p.monto)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {v.anulada && v.motivo_anulacion && (
                      <div className="px-3 py-2 rounded-xl bg-red-900/20 border border-red-800/30 text-sm">
                        <p className="text-red-400">Anulada: {v.motivo_anulacion}</p>
                      </div>
                    )}
                    {!v.anulada && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => compartir(v)} className="btn-secondary btn-sm gap-1 flex-1">
                          <Share2 size={14}/> Compartir
                        </button>
                        {usuario && ['ADMIN','GESTOR'].includes(usuario.rol) && (
                          <button onClick={() => { setModalAn(v); setMotivo(''); }} className="btn-danger btn-sm gap-1 flex-1">
                            <AlertOctagon size={14}/> Anular
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalAnular && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalAn(null)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-red-300">Anular venta #{modalAnular.numero}</h2>
              <button onClick={() => setModalAn(null)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="px-3 py-2 rounded-xl bg-red-900/20 border border-red-800/30 text-sm">
                <p className="text-red-300">Total: {formatPrecio(modalAnular.total)}</p>
                <p className="text-red-500 text-xs mt-0.5">Repone el stock y revierte el saldo CC.</p>
              </div>
              <div>
                <label className="label">Motivo</label>
                <input className="input" placeholder="Ej: error en el precio..."
                  value={motivoAnul} onChange={(e) => setMotivo(e.target.value)}/>
              </div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={anularVenta} disabled={anulando} className="btn-danger w-full btn-lg">
                {anulando ? 'Anulando...' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
