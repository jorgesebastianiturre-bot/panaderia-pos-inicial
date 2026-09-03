'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Clock, Play, Square, AlertTriangle, Edit2, Trash2, X, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatFecha, genId } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Turno, TipoTurno } from '@/types';

export default function TurnosPage() {
  const supabase = createClient();
  const { usuario, turnoActivo, setTurno } = useSesion();
  const [historial,      setHistorial]     = useState<any[]>([]);
  const [turnosAbiertos, setAbiertos]      = useState<any[]>([]);
  const [cargando,       setCargando]      = useState(false);
  const [modalEditar,    setModalEditar]   = useState<any | null>(null);
  const [modalEliminar,  setModalEliminar] = useState<any | null>(null);
  const [editFecha,      setEditFecha]     = useState('');
  const [editTipo,       setEditTipo]      = useState<TipoTurno>('MANIANA');

  useEffect(() => { cargarHistorial(); }, []);

  async function cargarHistorial() {
    const { data } = await supabase
      .from('turnos').select('*, usuarios(nombre)')
      .order('inicio', { ascending: false }).limit(40);
    if (data) {
      setHistorial(data);
      const hoy = new Date().toISOString().split('T')[0];
      setAbiertos(data.filter((t) => t.estado === 'ABIERTO' && t.fecha !== hoy));
    }
  }

  async function recargarTurnoActivo() {
    const hoy = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('turnos')
      .select('*, usuarios(nombre, rol)').eq('estado', 'ABIERTO').eq('fecha', hoy)
      .order('inicio', { ascending: false }).limit(1).maybeSingle();
    setTurno(data as Turno | null);
  }

  async function abrirTurno(tipo: TipoTurno) {
    if (!usuario) return;
    setCargando(true);
    const { data: abiertos } = await supabase.from('turnos').select('id, fecha, tipo').eq('estado', 'ABIERTO');
    if (abiertos && abiertos.length > 0) {
      toast.error(`Hay un turno abierto del ${abiertos[0].fecha}. Cerralo primero.`);
      setCargando(false); return;
    }
    const hoy = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('turnos').insert({
      id: genId('t'), tipo, fecha: hoy, usuario_id: usuario.id,
      inicio: Date.now(), estado: 'ABIERTO', fin: null,
    });
    if (error) { toast.error('No se pudo abrir el turno'); setCargando(false); return; }
    await recargarTurnoActivo();
    toast.success(`Turno ${tipo === 'MANIANA' ? 'Mañana' : 'Tarde'} abierto`);
    cargarHistorial(); setCargando(false);
  }

  async function cerrarTurno(turnoId?: string) {
    const id = turnoId ?? turnoActivo?.id;
    if (!id) return;
    setCargando(true);
    await supabase.from('turnos').update({ estado: 'CERRADO', fin: Date.now() }).eq('id', id);
    if (!turnoId || turnoId === turnoActivo?.id) setTurno(null);
    toast.success('Turno cerrado');
    cargarHistorial(); await recargarTurnoActivo(); setCargando(false);
  }

  async function reabrirTurno(t: any) {
    if (!usuario || usuario.rol !== 'ADMIN') return;
    setCargando(true);
    await supabase.from('turnos').update({ estado: 'ABIERTO', fin: null }).eq('id', t.id);
    toast.success('Turno reabierto');
    cargarHistorial(); await recargarTurnoActivo(); setCargando(false);
  }

  async function guardarEdicion() {
    if (!modalEditar) return;
    setCargando(true);
    await supabase.from('turnos').update({ fecha: editFecha, tipo: editTipo }).eq('id', modalEditar.id);
    toast.success('Turno actualizado');
    setModalEditar(null); cargarHistorial(); await recargarTurnoActivo(); setCargando(false);
  }

  async function eliminarTurno(t: any) {
    if (!usuario || usuario.rol !== 'ADMIN') return;
    setCargando(true);
    // Verificar si tiene ventas
    const { data: ventas } = await supabase.from('ventas').select('id').eq('turno_id', t.id).limit(1);
    if (ventas && ventas.length > 0) {
      toast.error('No se puede eliminar — tiene ventas registradas');
      setCargando(false); return;
    }
    await supabase.from('turnos').delete().eq('id', t.id);
    toast.success('Turno eliminado');
    setModalEliminar(null); cargarHistorial(); await recargarTurnoActivo(); setCargando(false);
  }

  const esAdmin = usuario?.rol === 'ADMIN';

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="text-pan-500"/>
        <h1 className="font-display font-bold text-xl text-pan-200">Turnos</h1>
      </div>

      {/* Turnos abiertos de días anteriores */}
      {turnosAbiertos.length > 0 && (
        <div className="card border-red-800/40 bg-red-900/10 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400"/>
            <h3 className="font-medium text-red-300">{turnosAbiertos.length} turno{turnosAbiertos.length !== 1 ? 's' : ''} sin cerrar de días anteriores</h3>
          </div>
          {turnosAbiertos.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-red-900/20 border border-red-800/30">
              <div>
                <p className="text-red-200 text-sm font-medium">{t.tipo === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'} — {t.fecha}</p>
                <p className="text-red-600 text-xs">{t.usuarios?.nombre}</p>
              </div>
              {(esAdmin || t.usuario_id === usuario?.id) && (
                <button onClick={() => cerrarTurno(t.id)} disabled={cargando}
                  className="btn btn-sm bg-red-900/40 border border-red-700 text-red-300 shrink-0">
                  <Square size={13}/> Cerrar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Estado actual */}
      <div className="card space-y-4">
        <h2 className="font-medium text-pan-300">Estado actual</h2>
        {turnoActivo ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-900/20 border border-green-800/30">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-green-300 font-medium">Turno {turnoActivo.tipo === 'MANIANA' ? 'Mañana' : 'Tarde'} activo</span>
              <span className="text-green-700 text-sm ml-auto">desde {formatFecha(turnoActivo.inicio)}</span>
            </div>
            <button onClick={() => cerrarTurno()} disabled={cargando} className="btn-danger w-full gap-2">
              <Square size={16}/> Cerrar turno actual
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {turnosAbiertos.length > 0
              ? <p className="text-amber-400 text-sm">⚠ Cerrá los turnos anteriores para poder abrir uno nuevo.</p>
              : <p className="text-pan-600 text-sm">No hay turno activo.</p>}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => abrirTurno('MANIANA')} disabled={cargando || turnosAbiertos.length > 0}
                className="btn-primary gap-2 disabled:opacity-50"><Play size={16}/>Mañana</button>
              <button onClick={() => abrirTurno('TARDE')} disabled={cargando || turnosAbiertos.length > 0}
                className="btn-secondary gap-2 disabled:opacity-50"><Play size={16}/>Tarde</button>
            </div>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium text-pan-300">Historial</h2>
        </div>
        {historial.map((t: any) => (
          <div key={t.id} className="card-sm flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${t.estado === 'ABIERTO' ? 'bg-green-400' : 'bg-pan-700'}`}/>
                <span className="text-pan-200 font-medium text-sm">
                  {t.tipo === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'} — {t.fecha}
                </span>
              </div>
              <p className="text-pan-600 text-xs mt-0.5 ml-4">
                {t.usuarios?.nombre} · {formatFecha(t.inicio, true)}
                {t.fin && ` → ${formatFecha(t.fin, true)}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`badge ${t.estado === 'ABIERTO' ? 'badge-ok' : 'badge-info'}`}>
                {t.estado === 'ABIERTO' ? 'Abierto' : 'Cerrado'}
              </span>
              {esAdmin && (
                <div className="flex gap-1">
                  {/* Reabrir turno cerrado */}
                  {t.estado === 'CERRADO' && t.id !== turnoActivo?.id && (
                    <button onClick={() => reabrirTurno(t)} disabled={cargando}
                      title="Reabrir turno"
                      className="btn-ghost btn-sm p-1.5 text-green-500 hover:text-green-400">
                      <RotateCcw size={13}/>
                    </button>
                  )}
                  {/* Cerrar turno abierto que no es el activo */}
                  {t.estado === 'ABIERTO' && t.id !== turnoActivo?.id && (
                    <button onClick={() => cerrarTurno(t.id)} disabled={cargando}
                      className="btn btn-sm btn-danger">Cerrar</button>
                  )}
                  {/* Editar */}
                  <button onClick={() => { setModalEditar(t); setEditFecha(t.fecha); setEditTipo(t.tipo); }}
                    className="btn-ghost btn-sm p-1.5 text-pan-600 hover:text-pan-300">
                    <Edit2 size={13}/>
                  </button>
                  {/* Eliminar */}
                  <button onClick={() => setModalEliminar(t)}
                    className="btn-ghost btn-sm p-1.5 text-red-600 hover:text-red-400">
                    <Trash2 size={13}/>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal editar turno */}
      {modalEditar && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalEditar(null)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">Editar turno</h2>
              <button onClick={() => setModalEditar(null)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="label">Fecha</label>
                <input className="input" type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)}/>
              </div>
              <div>
                <label className="label">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['MANIANA', 'TARDE'] as TipoTurno[]).map((t) => (
                    <button key={t} onClick={() => setEditTipo(t)}
                      className={`btn py-2 border ${editTipo === t ? 'bg-pan-500/20 border-pan-500 text-pan-300' : 'bg-bg-card border-bg-border text-pan-500'}`}>
                      {t === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardarEdicion} disabled={cargando} className="btn-primary w-full btn-lg">
                {cargando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar turno */}
      {modalEliminar && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalEliminar(null)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-red-300">Eliminar turno</h2>
              <button onClick={() => setModalEliminar(null)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="px-3 py-2 rounded-xl bg-red-900/20 border border-red-800/30 text-sm">
                <p className="text-red-300 font-medium">
                  {modalEliminar.tipo === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'} — {modalEliminar.fecha}
                </p>
                <p className="text-red-500 text-xs mt-1">Solo se puede eliminar si no tiene ventas registradas.</p>
              </div>
            </div>
            <div className="p-4 border-t border-bg-border flex gap-2">
              <button onClick={() => setModalEliminar(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => eliminarTurno(modalEliminar)} disabled={cargando} className="btn-danger flex-1">
                {cargando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
