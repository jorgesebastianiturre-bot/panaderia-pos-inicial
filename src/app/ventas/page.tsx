'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Receipt, Search, X, ChevronDown, ChevronUp, AlertOctagon, Share2, Filter, KeyRound, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatPrecio, formatFecha, labelMedio, cx } from '@/lib/utils';
import toast from 'react-hot-toast';

// ── PIN para anular ────────────────────────────────────────────────────────────
const PIN_ANULAR = '1111';

// ── Tipos de medio de pago disponibles para filtro ────────────────────────────
const MEDIOS_FILTRO = [
  { id: '',                  label: 'Todos los pagos' },
  { id: 'EFECTIVO',          label: 'Efectivo' },
  { id: 'TRANSFERENCIA',     label: 'Transferencia' },
  { id: 'CUENTA_CORRIENTE',  label: 'Cta. Corriente' },
  { id: 'MIXTO',             label: 'Mixto' },
];

export default function VentasPage() {
  const supabase = createClient();
  const { usuario } = useSesion();

  // ── Datos ──────────────────────────────────────────────────────────────────
  const [ventas,    setVentas]   = useState<any[]>([]);
  const [turnos,    setTurnos]   = useState<any[]>([]);   // lista de turnos para el dropdown
  const [cargando,  setCargando] = useState(true);

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [busqueda,    setBusqueda]   = useState('');
  const [fechaDesde,  setFechaD]     = useState('');
  const [fechaHasta,  setFechaH]     = useState('');
  const [turnoFiltro, setTurnoFiltro] = useState('');    // '' = todos los turnos
  const [medioFiltro, setMedioFiltro] = useState('');    // '' = todos los medios

  // ── UI: acordeón ──────────────────────────────────────────────────────────
  const [ventaAbierta, setVentaAb] = useState<string | null>(null);

  // ── Modal anulación: pasos PIN → Motivo → Confirmar ───────────────────────
  const [modalAnular,  setModalAn]    = useState<any | null>(null);
  const [pasoAnular,   setPasoAnular] = useState<'pin' | 'motivo'>('pin');
  const [pinIngresado, setPinIngresado] = useState('');
  const [motivoAnul,   setMotivo]     = useState('');
  const [anulando,     setAnulando]   = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    cargarTurnos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta, turnoFiltro]);
  // Nota: medioFiltro NO dispara cargar() — se filtra en memoria en el useMemo de arriba

  // ── Foco automático en input PIN al abrir modal ───────────────────────────
  useEffect(() => {
    if (modalAnular && pasoAnular === 'pin') {
      setTimeout(() => pinRef.current?.focus(), 80);
    }
  }, [modalAnular, pasoAnular]);

  // ── Cargar lista de turnos para el dropdown ───────────────────────────────
  async function cargarTurnos() {
    const { data } = await supabase
      .from('turnos')
      .select('id, tipo, fecha, estado')
      .order('inicio', { ascending: false })
      .limit(60);
    setTurnos(data ?? []);
  }

  // ── Cargar ventas con los filtros activos ─────────────────────────────────
  async function cargar() {
    setCargando(true);
    try {
      let q = supabase
        .from('ventas')
        .select(
          'id, numero, fecha, total, subtotal, ajuste, medio_pago, pagos, anulada, motivo_anulacion, cliente_id, turno_id, ' +
          'venta_items(id, nombre_snapshot, cantidad, por_peso, precio_unitario, subtotal, promo_id), ' +
          'clientes(nombre)'
        )
        .order('fecha', { ascending: false })
        .limit(500);

      // Filtro por rango de fechas
      if (fechaDesde) {
        q = q.gte('fecha', new Date(fechaDesde + 'T00:00:00').getTime());
      }
      if (fechaHasta) {
        q = q.lte('fecha', new Date(fechaHasta + 'T23:59:59').getTime());
      }

      // Filtro por turno
      if (turnoFiltro) {
        q = q.eq('turno_id', turnoFiltro);
      }

      // Nota: medio_pago es un enum en PostgreSQL — NO se puede filtrar con .eq()
      // desde el cliente sin cast explícito. Se filtra en memoria después de traer los datos.

      const { data, error } = await q;
      if (error) { console.error(error); toast.error('Error cargando ventas'); }
      setVentas(data ?? []);
    } finally {
      setCargando(false);
    }
  }

  // ── Filtrado local (búsqueda + medio de pago — no van a la query) ─────────
  const filtradas = useMemo(() => {
    let resultado = ventas;

    // Filtro por medio de pago (en memoria — medio_pago es enum en Postgres)
    if (medioFiltro) {
      resultado = resultado.filter((v) => v.medio_pago === medioFiltro);
    }

    // Búsqueda por texto
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      resultado = resultado.filter((v) =>
        String(v.numero).includes(q) ||
        v.clientes?.nombre?.toLowerCase().includes(q) ||
        v.venta_items?.some((i: any) => i.nombre_snapshot?.toLowerCase().includes(q))
      );
    }

    return resultado;
  }, [ventas, busqueda, medioFiltro]);

  // ── Resumen de totales por medio ──────────────────────────────────────────
  const resumen = useMemo(() =>
    filtradas.filter((v) => !v.anulada).reduce((acc, v) => {
      acc.total += v.total;
      if (v.medio_pago === 'EFECTIVO') acc.efectivo += v.total;
      else if (v.medio_pago === 'TRANSFERENCIA') acc.transferencia += v.total;
      else if (v.medio_pago === 'CUENTA_CORRIENTE') acc.cc += v.total;
      else if (v.medio_pago === 'MIXTO') {
        const pagosArr = Array.isArray(v.pagos)
          ? v.pagos
          : (typeof v.pagos === 'string' ? JSON.parse(v.pagos || '[]') : []);
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

  // ── Limpiar todos los filtros ─────────────────────────────────────────────
  function limpiarFiltros() {
    setFechaD('');
    setFechaH('');
    setTurnoFiltro('');
    setMedioFiltro('');
    setBusqueda('');
  }

  const hayFiltros = fechaDesde || fechaHasta || turnoFiltro || medioFiltro || busqueda;

  // ── Abrir modal de anulación: siempre empieza en paso PIN ─────────────────
  function abrirModalAnular(v: any) {
    setModalAn(v);
    setPasoAnular('pin');
    setPinIngresado('');
    setMotivo('');
  }

  function cerrarModalAnular() {
    setModalAn(null);
    setPinIngresado('');
    setMotivo('');
  }

  // ── Verificar PIN ─────────────────────────────────────────────────────────
  function verificarPin() {
    if (pinIngresado === PIN_ANULAR) {
      setPasoAnular('motivo');
      setMotivo('');
    } else {
      toast.error('PIN incorrecto');
      setPinIngresado('');
      setTimeout(() => pinRef.current?.focus(), 50);
    }
  }

  // ── Confirmar anulación (solo si PIN y motivo están correctos) ────────────
  async function anularVenta() {
    if (!modalAnular || !usuario) return;
    if (!motivoAnul.trim()) { toast.error('El motivo es obligatorio'); return; }
    setAnulando(true);
    const { data, error } = await supabase.rpc('anular_venta', {
      p_venta_id:   modalAnular.id,
      p_usuario_id: usuario.id,
      p_motivo:     motivoAnul.trim(),
    });
    if (error || !data?.ok) {
      toast.error(data?.error ?? 'Error al anular');
      setAnulando(false);
      return;
    }
    toast.success(`Venta #${modalAnular.numero} anulada`);
    cerrarModalAnular();
    setAnulando(false);
    cargar();
  }

  // ── Compartir venta por WhatsApp ──────────────────────────────────────────
  function compartir(v: any) {
    const items = (v.venta_items ?? []).map((i: any) =>
      `  • ${i.nombre_snapshot} x${i.por_peso ? i.cantidad.toFixed(2) + 'kg' : i.cantidad} = ${formatPrecio(i.subtotal)}`
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

  // ── Label legible para un turno ───────────────────────────────────────────
  function labelTurno(t: any) {
    const tipo = t.tipo === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde';
    const est  = t.estado === 'ABIERTO' ? ' ✓' : '';
    return `${tipo} — ${t.fecha}${est}`;
  }

  const noAnuladas = filtradas.filter((v) => !v.anulada).length;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="text-pan-500"/>
        <h1 className="font-display font-bold text-xl text-pan-200">Historial de Ventas</h1>
      </div>

      {/* ── Panel de filtros ─────────────────────────────────────────────── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-pan-500"/>
            <span className="text-pan-400 text-sm font-medium">Filtros</span>
            {hayFiltros && (
              <span className="badge badge-info text-xs">activos</span>
            )}
          </div>
          {hayFiltros && (
            <button onClick={limpiarFiltros} className="btn-ghost btn-sm text-pan-600 text-xs gap-1">
              <X size={12}/> Limpiar todo
            </button>
          )}
        </div>

        {/* Fila 1: Turno + Medio de pago */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Selector de turno */}
          <div>
            <label className="label text-xs">Turno</label>
            <select
              className="input text-sm"
              value={turnoFiltro}
              onChange={(e) => setTurnoFiltro(e.target.value)}
            >
              <option value="">Todos los turnos</option>
              {turnos.map((t) => (
                <option key={t.id} value={t.id}>{labelTurno(t)}</option>
              ))}
            </select>
          </div>

          {/* Selector de medio de pago */}
          <div>
            <label className="label text-xs">Medio de pago</label>
            <select
              className="input text-sm"
              value={medioFiltro}
              onChange={(e) => setMedioFiltro(e.target.value)}
            >
              {MEDIOS_FILTRO.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila 2: Rango de fechas */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-xs">Desde</label>
            <input
              className="input text-sm"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaD(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Hasta</label>
            <input
              className="input text-sm"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaH(e.target.value)}
            />
          </div>
        </div>

        {/* Búsqueda por texto */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pan-600"/>
          <input
            className="input pl-8 pr-8 text-sm"
            placeholder="Buscar por #, cliente o producto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-pan-600"
            >
              <X size={14}/>
            </button>
          )}
        </div>
      </div>

      {/* ── Resumen de totales ────────────────────────────────────────────── */}
      <div className="card">
        <h3 className="font-medium text-pan-300 text-sm mb-3">
          {noAnuladas} venta{noAnuladas !== 1 ? 's' : ''}
          {turnoFiltro
            ? ` — ${labelTurno(turnos.find((t) => t.id === turnoFiltro) ?? {})}`
            : (fechaDesde || fechaHasta)
              ? ' en el período'
              : ' en total'}
          {medioFiltro ? ` · ${labelMedio(medioFiltro)}` : ''}
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
              <span className={cx(bold ? 'text-pan-100 font-bold text-base' : 'text-pan-300')}>
                {formatPrecio(val)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Lista de ventas ──────────────────────────────────────────────── */}
      {cargando ? (
        <p className="text-pan-700 text-center py-8">Cargando ventas...</p>
      ) : filtradas.length === 0 ? (
        <div className="card text-center py-10 text-pan-700">
          <p className="text-sm">Sin ventas para mostrar</p>
          {hayFiltros && (
            <button onClick={limpiarFiltros} className="btn-ghost btn-sm mt-3 text-pan-500">
              Quitar filtros →
            </button>
          )}
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
                          v.medio_pago === 'EFECTIVO'         ? 'badge-ok' :
                          v.medio_pago === 'TRANSFERENCIA'    ? 'badge-info' :
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
                    {abierta
                      ? <ChevronUp   size={16} className="text-pan-600 shrink-0 mt-1"/>
                      : <ChevronDown size={16} className="text-pan-600 shrink-0 mt-1"/>}
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
                            <span className="text-pan-600 ml-1">
                              × {item.por_peso ? item.cantidad.toFixed(2) + 'kg' : item.cantidad}
                            </span>
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
                        {usuario && ['ADMIN', 'GESTOR'].includes(usuario.rol) && (
                          <button
                            onClick={() => abrirModalAnular(v)}
                            className="btn-danger btn-sm gap-1 flex-1"
                          >
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

      {/* ══ Modal de anulación: 2 pasos ════════════════════════════════════ */}
      {modalAnular && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && cerrarModalAnular()}
        >
          <div className="modal-box max-w-sm">

            {/* ── Encabezado ────────────────────────────────────────────── */}
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                {pasoAnular === 'pin'
                  ? <Lock size={16} className="text-red-400"/>
                  : <KeyRound size={16} className="text-red-400"/>}
                <h2 className="font-display font-bold text-red-300">
                  {pasoAnular === 'pin' ? 'Verificar identidad' : `Anular venta #${modalAnular.numero}`}
                </h2>
              </div>
              <button onClick={cerrarModalAnular} className="btn-ghost btn-sm p-2">
                <X size={18}/>
              </button>
            </div>

            {/* ── Paso 1: PIN ───────────────────────────────────────────── */}
            {pasoAnular === 'pin' && (
              <div className="p-4 space-y-4">
                <div className="px-3 py-2 rounded-xl bg-red-900/20 border border-red-800/30 text-sm">
                  <p className="text-red-300 font-medium">Venta #{modalAnular.numero} — {formatPrecio(modalAnular.total)}</p>
                  <p className="text-red-500 text-xs mt-0.5">Ingresá el PIN para autorizar la anulación.</p>
                </div>

                <div>
                  <label className="label">PIN de anulación</label>
                  <input
                    ref={pinRef}
                    className="input text-center text-2xl font-mono tracking-[0.5em] max-w-[160px] mx-auto block"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={pinIngresado}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPinIngresado(v);
                      // Auto-verificar cuando se completan 4 dígitos
                      if (v.length === 4) {
                        setTimeout(() => {
                          if (v === PIN_ANULAR) {
                            setPasoAnular('motivo');
                            setMotivo('');
                          } else {
                            toast.error('PIN incorrecto');
                            setPinIngresado('');
                          }
                        }, 100);
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') verificarPin(); }}
                  />
                </div>

                <button
                  onClick={verificarPin}
                  disabled={pinIngresado.length !== 4}
                  className="btn-primary w-full disabled:opacity-40"
                >
                  Verificar PIN
                </button>
              </div>
            )}

            {/* ── Paso 2: Motivo ────────────────────────────────────────── */}
            {pasoAnular === 'motivo' && (
              <>
                <div className="p-4 space-y-3">
                  <div className="px-3 py-2 rounded-xl bg-red-900/20 border border-red-800/30 text-sm">
                    <p className="text-red-300 font-medium">Venta #{modalAnular.numero} — {formatPrecio(modalAnular.total)}</p>
                    <p className="text-red-500 text-xs mt-0.5">Repone el stock y revierte el saldo CC.</p>
                  </div>
                  <div>
                    <label className="label">
                      Motivo <span className="text-red-400">*</span>
                    </label>
                    <input
                      className="input"
                      placeholder="Ej: error en el precio, devolución..."
                      value={motivoAnul}
                      autoFocus
                      onChange={(e) => setMotivo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && motivoAnul.trim()) anularVenta(); }}
                    />
                    <p className="text-pan-700 text-xs mt-1">Campo obligatorio — quedará registrado en la auditoría.</p>
                  </div>
                </div>
                <div className="p-4 border-t border-bg-border flex gap-2">
                  <button
                    onClick={() => { setPasoAnular('pin'); setPinIngresado(''); }}
                    className="btn-secondary flex-1"
                  >
                    ← Volver
                  </button>
                  <button
                    onClick={anularVenta}
                    disabled={anulando || !motivoAnul.trim()}
                    className="btn-danger flex-1 disabled:opacity-40"
                  >
                    {anulando ? 'Anulando...' : 'Confirmar anulación'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
