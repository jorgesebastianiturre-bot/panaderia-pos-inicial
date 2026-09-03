'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, AlertTriangle, Plus, Trash2, Edit2, X, Play, Square, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatPrecio, formatFecha, genId, cx } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { TipoTurno } from '@/types';

interface Egreso { id: string; monto: string; observacion: string; }
const nuevoEgreso = (): Egreso => ({ id: genId('e'), monto: '', observacion: '' });

interface EgresoProps { lista: Egreso[]; setLista: (l: Egreso[]) => void; titulo: string; color: string; }

function SeccionEgresos({ lista, setLista, titulo, color }: EgresoProps) {
  const total = lista.reduce((a, e) => a + (parseFloat(e.monto) || 0), 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="label mb-0" style={{ color }}>{titulo}</p>
        {total > 0 && <span className="text-sm font-medium" style={{ color }}>{formatPrecio(total)}</span>}
      </div>
      {lista.map((egreso, idx) => (
        <div key={egreso.id} className="flex gap-2 items-center">
          <input className="input text-sm" style={{ maxWidth: 130 }} type="tel" placeholder="$ Monto"
            defaultValue={egreso.monto}
            onBlur={(ev) => setLista(lista.map((e, i) => i === idx ? { ...e, monto: ev.target.value } : e))}/>
          <input className="input text-sm flex-1" placeholder="Observación"
            defaultValue={egreso.observacion}
            onBlur={(ev) => setLista(lista.map((e, i) => i === idx ? { ...e, observacion: ev.target.value } : e))}/>
          <button type="button"
            onClick={() => { const n = lista.filter((_, i) => i !== idx); setLista(n.length > 0 ? n : [nuevoEgreso()]); }}
            className="btn-ghost btn-sm p-2 text-pan-700 hover:text-red-400 shrink-0"><Trash2 size={14}/></button>
        </div>
      ))}
      <button type="button" onClick={() => setLista([...lista, nuevoEgreso()])}
        className="btn-ghost btn-sm gap-1 text-pan-600"><Plus size={13}/> Agregar otro</button>
    </div>
  );
}

export default function TurnoCierrePage() {
  const supabase = createClient();
  const { usuario, turnoActivo, setTurno } = useSesion();

  const [ventas,          setVentas]     = useState<any[]>([]);
  const [cierres,         setCierres]    = useState<any[]>([]);
  const [histTurnos,      setHistTurnos] = useState<any[]>([]);
  const [turnoManual,     setTurnoManual]= useState<any | null>(null);
  const [turnosSinCierre, setTurnosSC]  = useState<any[]>([]);
  const [efectivoReal,    setEfReal]     = useState('');
  const [transReal,       setTransReal]  = useState('');
  const [ccReal,          setCcReal]     = useState('');
  const [notas,           setNotas]      = useState('');
  const [cargando,        setCargando]   = useState(false);
  const [retiros,         setRetiros]    = useState<Egreso[]>([nuevoEgreso()]);
  const [gastos,          setGastos]     = useState<Egreso[]>([nuevoEgreso()]);
  const [editandoCierre,  setEditando]   = useState<any | null>(null);
  const [modalConfirmar,  setModalConf]  = useState(false);
  const [difDet,          setDifDet]     = useState<any[]>([]);
  const [filtroDesde,     setFiltroDesde]= useState('');
  const [filtroHasta,     setFiltroHasta]= useState('');
  const [tab,             setTab]        = useState<'turno'|'cierre'>('turno');

  const turnoEfectivo = turnoActivo ?? turnoManual;

  useEffect(() => { cargarTodo(); }, []);
  useEffect(() => { cargarVentas(); }, [turnoActivo, turnoManual]);

  async function cargarTodo() {
    await Promise.all([cargarCierres(), cargarTurnosSinCierre(), cargarHistTurnos()]);
  }

  async function cargarHistTurnos() {
    const { data } = await supabase.from('turnos').select('*, usuarios(nombre)')
      .order('inicio', { ascending: false }).limit(20);
    if (data) setHistTurnos(data);
  }

  async function cargarVentas() {
    const id = turnoActivo?.id ?? turnoManual?.id;
    if (!id) { setVentas([]); return; }
    const { data } = await supabase.from('ventas').select('*, clientes(nombre)')
      .eq('turno_id', id).eq('anulada', false);
    if (data) setVentas(data);
  }

  async function cargarCierres() {
    const { data } = await supabase.from('cierres')
      .select('*, turnos(tipo, fecha, usuarios(nombre))')
      .order('fecha', { ascending: false }).limit(30);
    if (data) setCierres(data);
  }

  async function cargarTurnosSinCierre() {
    const { data: turnos } = await supabase.from('turnos').select('*, usuarios(nombre)')
      .order('fecha', { ascending: false }).limit(30);
    if (!turnos) return;
    const { data: ce } = await supabase.from('cierres').select('turno_id');
    const conCierre = new Set((ce ?? []).map((c: any) => c.turno_id));
    setTurnosSC(turnos.filter((t: any) => !conCierre.has(t.id)));
  }

  async function recargarTurnoActivo() {
    const { data } = await supabase.from('turnos').select('*, usuarios(nombre, rol)')
      .eq('estado', 'ABIERTO').order('inicio', { ascending: false }).limit(1).maybeSingle();
    setTurno(data as any);
  }

  async function abrirTurno(tipo: TipoTurno) {
    if (!usuario) return;
    setCargando(true);
    const { data: abiertos } = await supabase.from('turnos').select('id').eq('estado', 'ABIERTO');
    if (abiertos && abiertos.length > 0) { toast.error('Hay un turno abierto. Cerralo primero.'); setCargando(false); return; }
    const hoy = new Date().toISOString().split('T')[0];
    await supabase.from('turnos').insert({ id: genId('t'), tipo, fecha: hoy, usuario_id: usuario.id, inicio: Date.now(), estado: 'ABIERTO', fin: null });
    await recargarTurnoActivo();
    toast.success(`Turno ${tipo === 'MANIANA' ? 'Mañana' : 'Tarde'} abierto`);
    cargarTodo(); setCargando(false);
  }

  async function cerrarTurno(id?: string) {
    const tid = id ?? turnoActivo?.id;
    if (!tid) return;
    setCargando(true);
    await supabase.from('turnos').update({ estado: 'CERRADO', fin: Date.now() }).eq('id', tid);
    if (!id || id === turnoActivo?.id) setTurno(null);
    toast.success('Turno cerrado');
    cargarTodo(); await recargarTurnoActivo(); setCargando(false);
  }

  async function reabrirTurno(t: any) {
    await supabase.from('turnos').update({ estado: 'ABIERTO', fin: null }).eq('id', t.id);
    toast.success('Turno reabierto');
    cargarTodo(); await recargarTurnoActivo();
  }

  async function eliminarTurno(t: any) {
    const { data: vs } = await supabase.from('ventas').select('id').eq('turno_id', t.id).limit(1);
    if (vs && vs.length > 0) { toast.error('No se puede eliminar — tiene ventas'); return; }
    if (!confirm(`¿Eliminás el turno ${t.tipo} del ${t.fecha}?`)) return;
    await supabase.from('turnos').delete().eq('id', t.id);
    toast.success('Turno eliminado'); cargarTodo(); await recargarTurnoActivo();
  }

  async function eliminarCierre(id: string) {
    if (!confirm('¿Eliminás este cierre?')) return;
    const { error } = await supabase.from('cierres').delete().eq('id', id);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('Cierre eliminado'); cargarTodo();
  }

  const totSistema = ventas.reduce((acc, v) => {
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

  const transferPend = ventas.filter((v) => v.medio_pago === 'TRANSFERENCIA' && !v.transferencia_confirmada);
  const transferConf = ventas.filter((v) => v.medio_pago === 'TRANSFERENCIA' && v.transferencia_confirmada);
  const totalRetiros = retiros.reduce((a, r) => a + (parseFloat(r.monto) || 0), 0);
  const totalGastos  = gastos.reduce((a, g)  => a + (parseFloat(g.monto)  || 0), 0);
  const ef = parseFloat(efectivoReal) || 0;
  const tr = parseFloat(transReal)    || 0;
  const cc = parseFloat(ccReal)       || 0;
  const efectivoAjustado = ef + totalRetiros + totalGastos;
  const difEf = efectivoReal !== '' ? efectivoAjustado - totSistema.efectivo : null;
  const difTr = transReal    !== '' ? tr - totSistema.transferencia : null;
  const difCc = ccReal       !== '' ? cc - totSistema.cc : null;

  function colorDif(d: number | null) {
    if (d === null) return 'text-pan-700';
    if (Math.abs(d) < 1) return 'text-green-400';
    return d > 0 ? 'text-blue-400' : 'text-red-400';
  }
  function labelDif(d: number | null) {
    if (d === null) return '—';
    return `${d >= 0 ? '+' : ''}${formatPrecio(d)}`;
  }

  async function confirmarTransferencia(id: string) {
    if (!usuario) return;
    await supabase.from('ventas').update({ transferencia_confirmada: true, transferencia_confirmada_en: Date.now(), transferencia_confirmada_por: usuario.id }).eq('id', id);
    cargarVentas(); toast.success('Transferencia confirmada');
  }

  function intentarCierre() {
    if (!turnoEfectivo) { toast.error('Seleccioná un turno'); return; }
    const dets: any[] = [];
    if (difEf !== null && Math.abs(difEf) >= 1) dets.push({ label: 'Efectivo', sistema: totSistema.efectivo, real: efectivoAjustado, dif: difEf });
    if (difTr !== null && Math.abs(difTr) >= 1) dets.push({ label: 'Transferencia', sistema: totSistema.transferencia, real: tr, dif: difTr });
    if (difCc !== null && Math.abs(difCc) >= 1) dets.push({ label: 'Cta. Cte.', sistema: totSistema.cc, real: cc, dif: difCc });
    if (dets.length > 0) { setDifDet(dets); setModalConf(true); }
    else realizarCierre();
  }

  async function realizarCierre() {
    if (!turnoEfectivo || !usuario) return;
    setCargando(true); setModalConf(false);
    const notasFinal = [
      notas,
      retiros.filter(r => +r.monto > 0).length > 0 ? 'RETIROS: ' + retiros.filter(r => +r.monto > 0).map(r => `${formatPrecio(+r.monto)} (${r.observacion || 'sin obs'})`).join(', ') : '',
      gastos.filter(g => +g.monto > 0).length > 0 ? 'GASTOS: ' + gastos.filter(g => +g.monto > 0).map(g => `${formatPrecio(+g.monto)} (${g.observacion || 'sin obs'})`).join(', ') : '',
      difDet.length > 0 ? 'DIFERENCIAS: ' + difDet.map(d => `${d.label}: ${labelDif(d.dif)}`).join(', ') : '',
    ].filter(Boolean).join('\n') || null;

    const { error } = await supabase.from('cierres').insert({
      id: genId('cc'), turno_id: turnoEfectivo.id, usuario_id: usuario.id, fecha: Date.now(),
      total_efectivo_sistema: totSistema.efectivo, total_transferencia_sistema: totSistema.transferencia,
      total_cc_sistema: totSistema.cc, total_sistema: totSistema.total,
      total_efectivo_real: ef, total_transferencia_real: tr, total_cc_real: cc,
      diferencia_efectivo: difEf ?? 0, diferencia_transferencia: difTr ?? 0, diferencia_cc: difCc ?? 0,
      total_ajustes: ventas.reduce((a, v) => a + (v.ajuste ?? 0), 0),
      diferencias_stock: [], detalle_ajustes: [],
      transferencias_confirmadas_ids: transferConf.map(v => v.id),
      transferencias_pendientes: transferPend.map(v => v.id), notas: notasFinal,
    });

    if (error) { toast.error('Error: ' + error.message); setCargando(false); return; }

    // Si el turno está abierto, cerrarlo automáticamente
    if (turnoEfectivo.estado === 'ABIERTO') {
      await supabase.from('turnos').update({ estado: 'CERRADO', fin: Date.now() }).eq('id', turnoEfectivo.id);
      setTurno(null);
    }

    toast.success('✓ Cierre guardado y turno cerrado');
    setEfReal(''); setTransReal(''); setCcReal(''); setNotas('');
    setRetiros([nuevoEgreso()]); setGastos([nuevoEgreso()]); setDifDet([]);
    setTurnoManual(null);
    cargarTodo(); await recargarTurnoActivo(); setCargando(false);
  }

  async function guardarEdicionCierre() {
    if (!editandoCierre) return;
    setCargando(true);
    await supabase.from('cierres').update({
      notas: editandoCierre.notas,
      total_efectivo_real: editandoCierre.total_efectivo_real,
      total_transferencia_real: editandoCierre.total_transferencia_real,
      total_cc_real: editandoCierre.total_cc_real,
    }).eq('id', editandoCierre.id);
    toast.success('Cierre actualizado');
    setEditando(null); cargarCierres(); setCargando(false);
  }

  const esAdmin = usuario?.rol === 'ADMIN';
  const turnosAbiertosViejos = histTurnos.filter(t => t.estado === 'ABIERTO' && t.fecha !== new Date().toISOString().split('T')[0]);

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-5">
      <div className="flex items-center gap-3">
        <ClipboardList className="text-pan-500"/>
        <h1 className="font-display font-bold text-xl text-pan-200">Turno y Cierre</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('turno')}
          className={cx('btn flex-1', tab === 'turno' ? 'btn-primary' : 'btn-secondary')}>
          🕐 Turno
        </button>
        <button onClick={() => setTab('cierre')}
          className={cx('btn flex-1', tab === 'cierre' ? 'btn-primary' : 'btn-secondary')}>
          📋 Cierre de caja
        </button>
      </div>

      {/* ===== TAB TURNO ===== */}
      {tab === 'turno' && (
        <div className="space-y-4">
          {/* Turnos viejos sin cerrar */}
          {turnosAbiertosViejos.length > 0 && (
            <div className="card border-red-800/40 bg-red-900/10 space-y-3">
              <p className="font-medium text-red-300 text-sm flex items-center gap-2">
                <AlertTriangle size={14}/> {turnosAbiertosViejos.length} turno{turnosAbiertosViejos.length !== 1 ? 's' : ''} sin cerrar de días anteriores
              </p>
              {turnosAbiertosViejos.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-red-900/20 border border-red-800/30">
                  <div>
                    <p className="text-red-200 text-sm font-medium">{t.tipo === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'} — {t.fecha}</p>
                    <p className="text-red-600 text-xs">{t.usuarios?.nombre}</p>
                  </div>
                  <button onClick={() => cerrarTurno(t.id)} className="btn btn-sm bg-red-900/40 border border-red-700 text-red-300 shrink-0">
                    <Square size={12}/> Cerrar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Estado actual */}
          <div className="card space-y-3">
            <h3 className="font-medium text-pan-300">Estado actual</h3>
            {turnoActivo ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-900/20 border border-green-800/30">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
                  <span className="text-green-300 font-medium">{turnoActivo.tipo === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'} activo</span>
                  <span className="text-green-700 text-xs ml-auto">desde {formatFecha(turnoActivo.inicio)}</span>
                </div>
                <button onClick={() => cerrarTurno()} disabled={cargando} className="btn-danger w-full gap-2">
                  <Square size={16}/> Cerrar turno
                </button>
                <button onClick={() => setTab('cierre')} className="btn-secondary w-full gap-2">
                  📋 Ir al cierre de caja
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {turnosAbiertosViejos.length > 0
                  ? <p className="text-amber-400 text-sm">⚠ Cerrá los turnos anteriores primero.</p>
                  : <p className="text-pan-600 text-sm">No hay turno activo.</p>}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => abrirTurno('MANIANA')} disabled={cargando || turnosAbiertosViejos.length > 0}
                    className="btn-primary gap-2 disabled:opacity-40"><Play size={16}/>Mañana</button>
                  <button onClick={() => abrirTurno('TARDE')} disabled={cargando || turnosAbiertosViejos.length > 0}
                    className="btn-secondary gap-2 disabled:opacity-40"><Play size={16}/>Tarde</button>
                </div>
              </div>
            )}
          </div>

          {/* Historial de turnos */}
          <div className="space-y-2">
            <h3 className="font-medium text-pan-300 text-sm">Historial de turnos</h3>
            {histTurnos.map((t: any) => (
              <div key={t.id} className="card-sm flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cx('w-2 h-2 rounded-full shrink-0', t.estado === 'ABIERTO' ? 'bg-green-400' : 'bg-pan-700')}/>
                    <span className="text-pan-200 font-medium text-sm">{t.tipo === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'} — {t.fecha}</span>
                    <span className={cx('badge', t.estado === 'ABIERTO' ? 'badge-ok' : 'badge-info')}>{t.estado === 'ABIERTO' ? 'Abierto' : 'Cerrado'}</span>
                  </div>
                  <p className="text-pan-600 text-xs ml-4">{t.usuarios?.nombre} · {formatFecha(t.inicio, true)}</p>
                </div>
                {esAdmin && (
                  <div className="flex gap-1 shrink-0">
                    {t.estado === 'CERRADO' && <button onClick={() => reabrirTurno(t)} title="Reabrir" className="btn-ghost btn-sm p-1.5 text-green-500"><RotateCcw size={13}/></button>}
                    {t.estado === 'ABIERTO' && t.id !== turnoActivo?.id && <button onClick={() => cerrarTurno(t.id)} className="btn btn-sm btn-danger text-xs">Cerrar</button>}
                    <button onClick={() => eliminarTurno(t)} className="btn-ghost btn-sm p-1.5 text-red-600"><Trash2 size={13}/></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== TAB CIERRE ===== */}
      {tab === 'cierre' && (
        <div className="space-y-4">
          {/* Selector de turno */}
          {turnosSinCierre.length > 0 && (
            <div className="card border-amber-800/30 bg-amber-900/10 space-y-3">
              <h3 className="font-medium text-amber-300 text-sm">Seleccioná el turno a cerrar</h3>
              {turnosSinCierre.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-900/20 border border-amber-800/30">
                  <div>
                    <p className="text-amber-200 text-sm font-medium">
                      {t.tipo === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'} — {t.fecha}
                      {t.estado === 'ABIERTO' && <span className="ml-2 text-green-400 text-xs">● Activo</span>}
                    </p>
                    <p className="text-amber-600 text-xs">{t.usuarios?.nombre}</p>
                  </div>
                  <button onClick={() => setTurnoManual(turnoManual?.id === t.id ? null : t)}
                    className={cx('btn btn-sm shrink-0', turnoManual?.id === t.id ? 'btn-primary' : 'bg-amber-900/40 border border-amber-700 text-amber-300')}>
                    {turnoManual?.id === t.id ? 'Cancelar' : 'Seleccionar'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {turnoEfectivo ? (
            <div className="space-y-4">
              {/* Banner turno seleccionado */}
              <div className="px-3 py-2 rounded-xl bg-pan-500/10 border border-pan-500/20">
                <p className="text-pan-300 font-medium text-sm">
                  {turnoEfectivo.tipo === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'} — {turnoEfectivo.fecha} · {ventas.length} ventas
                </p>
              </div>

              {/* Transferencias */}
              <div className="card space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-pan-300">Transferencias</h3>
                  <span className="badge badge-info">{ventas.filter(v => v.medio_pago === 'TRANSFERENCIA').length}</span>
                </div>
                {transferPend.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-amber-400 text-xs font-medium"><AlertTriangle size={12} className="inline"/> Pendientes</p>
                    {transferPend.map(v => (
                      <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-900/10 border border-amber-800/30 gap-2">
                        <div>
                          <span className="text-pan-300 text-sm font-medium">#{v.numero} · {formatPrecio(v.total)}</span>
                          {v.clientes?.nombre && <span className="ml-2 badge badge-info text-xs">{v.clientes.nombre}</span>}
                          <p className="text-pan-600 text-xs">{formatFecha(v.fecha)}</p>
                        </div>
                        <button onClick={() => confirmarTransferencia(v.id)} className="btn btn-sm bg-amber-900/40 border border-amber-700 text-amber-300 shrink-0">Confirmar</button>
                      </div>
                    ))}
                  </div>
                )}
                {transferConf.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-green-400 text-xs">✓ Confirmadas</p>
                    {transferConf.map(v => (
                      <div key={v.id} className="flex justify-between px-3 py-1.5 rounded-xl bg-green-900/10 border border-green-800/20 text-sm">
                        <span className="text-pan-400">#{v.numero} {v.clientes?.nombre && `· ${v.clientes.nombre}`}</span>
                        <span className="text-pan-300">{formatPrecio(v.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {ventas.filter(v => v.medio_pago === 'TRANSFERENCIA').length === 0 && <p className="text-pan-700 text-sm">Sin transferencias</p>}
              </div>

              {/* Totales sistema */}
              <div className="card">
                <h3 className="font-medium text-pan-300 mb-3">Ventas del turno (sistema)</h3>
                <div className="space-y-2 text-sm">
                  {[{label:'Efectivo',val:totSistema.efectivo},{label:'Transferencia',val:totSistema.transferencia},{label:'Cta. Cte.',val:totSistema.cc}].map(({label,val}) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-pan-600">{label}</span>
                      <span className="text-pan-300 font-medium">{formatPrecio(val)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-bg-border pt-2">
                    <span className="text-pan-400 font-medium">Total</span>
                    <span className="text-pan-100 font-bold text-base">{formatPrecio(totSistema.total)}</span>
                  </div>
                </div>
              </div>

              {/* Retiros y gastos */}
              <div className="card space-y-4">
                <h3 className="font-medium text-pan-300">Retiros y gastos de caja</h3>
                <SeccionEgresos titulo="💸 Retiros" color="#f0a020" lista={retiros} setLista={setRetiros}/>
                <div className="border-t border-bg-border"/>
                <SeccionEgresos titulo="🧾 Gastos" color="#e05252" lista={gastos} setLista={setGastos}/>
                {(totalRetiros + totalGastos) > 0 && (
                  <div className="flex justify-between text-sm border-t border-bg-border pt-2">
                    <span className="text-pan-600">Total retiros y gastos</span>
                    <span className="text-pan-300 font-bold">{formatPrecio(totalRetiros + totalGastos)}</span>
                  </div>
                )}
              </div>

              {/* Arqueo */}
              <div className="card space-y-3">
                <h3 className="font-medium text-pan-300">Arqueo — montos reales contados</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-pan-700 text-xs">
                      <td className="pb-2">Concepto</td>
                      <td className="pb-2 text-right">Sistema</td>
                      <td className="pb-2 text-right">Real</td>
                      <td className="pb-2 text-right">Diferencia</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-bg-border">
                      <td className="py-2 text-pan-400">Efectivo</td>
                      <td className="py-2 text-right text-pan-500">{formatPrecio(totSistema.efectivo)}</td>
                      <td className="py-2 text-right">
                        <input className="input text-sm text-right" style={{maxWidth:110}} type="tel" placeholder="0"
                          defaultValue={efectivoReal} onBlur={(e) => setEfReal(e.target.value)}/>
                      </td>
                      <td className={cx('py-2 text-right font-medium', colorDif(difEf))}>{labelDif(difEf)}</td>
                    </tr>
                    <tr className="border-t border-bg-border">
                      <td className="py-2 text-pan-400">Transferencia</td>
                      <td className="py-2 text-right text-pan-500">{formatPrecio(totSistema.transferencia)}</td>
                      <td className="py-2 text-right">
                        <input className="input text-sm text-right" style={{maxWidth:110}} type="tel" placeholder="0"
                          defaultValue={transReal} onBlur={(e) => setTransReal(e.target.value)}/>
                      </td>
                      <td className={cx('py-2 text-right font-medium', colorDif(difTr))}>{labelDif(difTr)}</td>
                    </tr>
                    <tr className="border-t border-bg-border">
                      <td className="py-2 text-pan-400">Cta. Cte.</td>
                      <td className="py-2 text-right text-pan-500">{formatPrecio(totSistema.cc)}</td>
                      <td className="py-2 text-right">
                        <input className="input text-sm text-right" style={{maxWidth:110}} type="tel" placeholder="0"
                          defaultValue={ccReal} onBlur={(e) => setCcReal(e.target.value)}/>
                      </td>
                      <td className={cx('py-2 text-right font-medium', colorDif(difCc))}>{labelDif(difCc)}</td>
                    </tr>
                  </tbody>
                </table>

                {ef > 0 && (totalRetiros + totalGastos) > 0 && (
                  <div className="px-3 py-2 rounded-xl border bg-bg-card border-bg-border text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-pan-600">En caja ahora</span><span>{formatPrecio(ef)}</span></div>
                    <div className="flex justify-between"><span className="text-pan-600">+ Retiros y gastos</span><span className="text-amber-400">+{formatPrecio(totalRetiros + totalGastos)}</span></div>
                    <div className="flex justify-between font-bold border-t border-bg-border pt-1 text-pan-200">
                      <span>Total vendido en efectivo</span><span>{formatPrecio(efectivoAjustado)}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="label">Notas</label>
                  <textarea className="input min-h-[60px] resize-none" placeholder="Observaciones..."
                    value={notas} onChange={(e) => setNotas(e.target.value)}/>
                </div>
              </div>

              <button onClick={intentarCierre} disabled={cargando}
                className="btn-primary w-full btn-lg gap-2 disabled:opacity-40">
                <CheckCircle size={18}/>
                {cargando ? 'Guardando...' : 'Guardar cierre y cerrar turno'}
              </button>
            </div>
          ) : turnosSinCierre.length === 0 ? (
            <div className="card text-center py-8 text-pan-600">
              <p>No hay turnos pendientes de cierre.</p>
              <button onClick={() => setTab('turno')} className="btn-primary btn-sm mt-3">Ir a Turnos →</button>
            </div>
          ) : null}

          {/* Historial de cierres */}
          {cierres.length > 0 && (
            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-medium text-pan-300">Historial de cierres</h3>
                <div className="flex gap-2">
                  <input className="input text-xs" style={{maxWidth:130}} type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)}/>
                  <input className="input text-xs" style={{maxWidth:130}} type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)}/>
                  {(filtroDesde || filtroHasta) && <button onClick={() => {setFiltroDesde(''); setFiltroHasta('');}} className="btn-ghost btn-sm text-pan-600">✕</button>}
                </div>
              </div>
              {cierres.filter((c: any) => {
                const f = new Date(c.fecha).toISOString().split('T')[0];
                if (filtroDesde && f < filtroDesde) return false;
                if (filtroHasta && f > filtroHasta) return false;
                return true;
              }).map((c: any) => (
                <div key={c.id} className="card-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-pan-200 font-medium text-sm">
                        {c.turnos?.tipo === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'} — {c.turnos?.fecha}
                      </span>
                      <p className="text-pan-600 text-xs">{c.turnos?.usuarios?.nombre} · {formatFecha(c.fecha)}</p>
                      <p className="text-pan-600 text-xs">Sistema: {formatPrecio(c.total_sistema)}</p>
                      {c.notas && <p className="text-pan-700 text-xs whitespace-pre-line mt-1">{c.notas}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-pan-300 font-bold">{formatPrecio(c.total_sistema)}</span>
                      {esAdmin && <>
                        <button onClick={() => setEditando({...c})} className="btn-ghost btn-sm p-1.5 text-pan-600 hover:text-pan-300"><Edit2 size={13}/></button>
                        <button onClick={() => eliminarCierre(c.id)} className="btn-ghost btn-sm p-1.5 text-red-600 hover:text-red-400"><Trash2 size={13}/></button>
                      </>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal diferencias */}
      {modalConfirmar && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalConf(false)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-400 shrink-0"/>
              <h2 className="font-display font-bold text-amber-300">Diferencias detectadas</h2>
            </div>
            <div className="p-4 space-y-3">
              {difDet.map((d, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-bg-card border border-bg-border text-sm">
                  <span className="text-pan-400">{d.label}</span>
                  <div className="text-right">
                    <p className="text-pan-600 text-xs">Sistema: {formatPrecio(d.sistema)} · Real: {formatPrecio(d.real)}</p>
                    <p className={cx('font-bold', d.dif > 0 ? 'text-blue-400' : 'text-red-400')}>
                      {d.dif > 0 ? '+' : ''}{formatPrecio(d.dif)} {d.dif > 0 ? '(sobrante)' : '(faltante)'}
                    </p>
                  </div>
                </div>
              ))}
              <p className="text-pan-600 text-sm">¿Confirmás el cierre con estas diferencias?</p>
            </div>
            <div className="p-4 border-t border-bg-border flex gap-2">
              <button onClick={() => setModalConf(false)} className="btn-secondary flex-1">Corregir</button>
              <button onClick={realizarCierre} disabled={cargando} className="btn-primary flex-1">
                {cargando ? 'Guardando...' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar cierre */}
      {editandoCierre && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditando(null)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">Editar cierre</h2>
              <button onClick={() => setEditando(null)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className="label">Efectivo real</label><input className="input" type="number" value={editandoCierre.total_efectivo_real} onChange={e => setEditando({...editandoCierre, total_efectivo_real: +e.target.value})}/></div>
              <div><label className="label">Transferencia real</label><input className="input" type="number" value={editandoCierre.total_transferencia_real} onChange={e => setEditando({...editandoCierre, total_transferencia_real: +e.target.value})}/></div>
              <div><label className="label">Cta. Cte. real</label><input className="input" type="number" value={editandoCierre.total_cc_real} onChange={e => setEditando({...editandoCierre, total_cc_real: +e.target.value})}/></div>
              <div><label className="label">Notas</label><textarea className="input min-h-[70px] resize-none" value={editandoCierre.notas ?? ''} onChange={e => setEditando({...editandoCierre, notas: e.target.value})}/></div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardarEdicionCierre} disabled={cargando} className="btn-primary w-full btn-lg">{cargando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
