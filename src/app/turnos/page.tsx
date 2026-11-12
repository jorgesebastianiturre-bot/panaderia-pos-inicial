'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Clock, Play, Square, AlertTriangle, Edit2, Trash2, X, RotateCcw, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatFecha, genId } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Turno, TipoTurno } from '@/types';

export default function TurnosPage() {
  const supabase  = createClient();
  const router    = useRouter();
  const { usuario, turnoActivo, setTurno } = useSesion();

  const [historial,      setHistorial]   = useState<any[]>([]);
  const [turnosViejos,   setViejos]      = useState<any[]>([]);
  const [cargando,       setCargando]    = useState(false);
  const [actualizando,   setActualizando] = useState(false);
  const [modalEditar,    setModalEditar] = useState<any | null>(null);
  const [modalEliminar,  setModalEliminar] = useState<any | null>(null);
  const [editFecha,      setEditFecha]   = useState('');
  const [editTipo,       setEditTipo]    = useState<TipoTurno>('MANIANA');

  // Fuente única de verdad: siempre leer directo de la DB
  const sincronizar = useCallback(async (silencioso = false) => {
    if (!silencioso) setActualizando(true);
    try {
      // 1. Buscar el turno ABIERTO más reciente
      const { data: abierto } = await supabase
        .from('turnos')
        .select('*, usuarios(nombre, rol)')
        .eq('estado', 'ABIERTO')
        .order('inicio', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Actualizar el store global con lo que dice la DB ahora mismo
      setTurno(abierto as Turno | null);

      // 2. Historial completo
      const { data: lista } = await supabase
        .from('turnos')
        .select('*, usuarios(nombre)')
        .order('inicio', { ascending: false })
        .limit(40);

      if (lista) {
        setHistorial(lista);
        const hoy = new Date().toISOString().split('T')[0];
        // Turnos abiertos que NO son de hoy → requieren atención
        setViejos(lista.filter((t) => t.estado === 'ABIERTO' && t.fecha !== hoy));
      }
    } finally {
      if (!silencioso) setActualizando(false);
    }
  }, [supabase, setTurno]);

  useEffect(() => {
    sincronizar(true);

    // Realtime: cuando cambia cualquier turno, sincronizar
    const canal = supabase
      .channel('turnos-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' },
        () => sincronizar(true)
      )
      .subscribe();

    // Al volver a la pestaña (celular que se bloqueó, etc.) sincronizar
    function alVolver() {
      if (document.visibilityState === 'visible') sincronizar(true);
    }
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      canal.unsubscribe();
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [sincronizar]);

  async function abrirTurno(tipo: TipoTurno) {
    setCargando(true);
    try {
      // Obtener el usuario autenticado directo de Supabase Auth (no depende del store)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('No estás autenticado. Recargá la página.');
        return;
      }

      // Buscar el perfil en public.usuarios usando el auth_id
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('id, rol, activo')
        .eq('auth_id', user.id)
        .eq('activo', true)
        .single();

      if (!perfil) {
        toast.error('No se encontró tu perfil. Recargá la página e intentá de nuevo.');
        return;
      }

      // Verificar si ya hay un turno ABIERTO
      const { data: abiertos } = await supabase
        .from('turnos').select('id, fecha, tipo').eq('estado', 'ABIERTO');

      if (abiertos && abiertos.length > 0) {
        toast.error(`Ya hay un turno abierto (${abiertos[0].fecha}). Cerralo primero.`);
        await sincronizar(true);
        return;
      }

      const hoy = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('turnos').insert({
        id: genId('t'), tipo, fecha: hoy,
        usuario_id: perfil.id,
        inicio: Date.now(),
        estado: 'ABIERTO',
        fin: null,
      });

      if (error) {
        toast.error(`No se pudo abrir el turno: ${error.message}`);
        return;
      }

      // Sincronizar inmediatamente sin esperar el evento realtime
      await sincronizar(true);
      toast.success(`Turno ${tipo === 'MANIANA' ? 'Mañana' : 'Tarde'} abierto ✓`);

      // Ir al POS directamente
      router.push('/pos');
    } finally {
      setCargando(false);
    }
  }

  async function cerrarTurno(turnoId?: string) {
    const id = turnoId ?? turnoActivo?.id;
    if (!id) return;
    setCargando(true);
    try {
      await supabase.from('turnos')
        .update({ estado: 'CERRADO', fin: Date.now() })
        .eq('id', id);
      await sincronizar(true);
      toast.success('Turno cerrado');
    } finally {
      setCargando(false);
    }
  }

  async function reabrirTurno(t: any) {
    if (!usuario || usuario.rol !== 'ADMIN') return;
    setCargando(true);
    try {
      await supabase.from('turnos')
        .update({ estado: 'ABIERTO', fin: null })
        .eq('id', t.id);
      await sincronizar(true);
      toast.success('Turno reabierto');
    } finally {
      setCargando(false);
    }
  }

  async function guardarEdicion() {
    if (!modalEditar) return;
    setCargando(true);
    try {
      await supabase.from('turnos')
        .update({ fecha: editFecha, tipo: editTipo })
        .eq('id', modalEditar.id);
      setModalEditar(null);
      await sincronizar(true);
      toast.success('Turno actualizado');
    } finally {
      setCargando(false);
    }
  }

  async function eliminarTurno(t: any) {
    if (!usuario || usuario.rol !== 'ADMIN') return;
    setCargando(true);
    try {
      const { data: ventas } = await supabase
        .from('ventas').select('id').eq('turno_id', t.id).limit(1);
      if (ventas && ventas.length > 0) {
        toast.error('No se puede eliminar — tiene ventas registradas');
        return;
      }
      await supabase.from('turnos').delete().eq('id', t.id);
      setModalEliminar(null);
      await sincronizar(true);
      toast.success('Turno eliminado');
    } finally {
      setCargando(false);
    }
  }

  const esAdmin    = usuario?.rol === 'ADMIN';
  const hayAbierto = !!turnoActivo;
  const bloqueado  = turnosViejos.length > 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-6">

      {/* Encabezado con botón de actualizar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Clock className="text-pan-500"/>
          <h1 className="font-display font-bold text-xl text-pan-200">Turnos</h1>
        </div>
        <button
          onClick={() => sincronizar(false)}
          disabled={actualizando}
          className="btn-ghost btn-sm gap-2 text-pan-500 hover:text-pan-300"
          title="Actualizar estado"
        >
          <RefreshCw size={15} className={actualizando ? 'animate-spin' : ''}/>
          {actualizando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {/* Alerta: turnos viejos sin cerrar */}
      {turnosViejos.length > 0 && (
        <div className="card border-red-800/40 bg-red-900/10 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400"/>
            <h3 className="font-medium text-red-300">
              {turnosViejos.length} turno{turnosViejos.length !== 1 ? 's' : ''} sin cerrar de días anteriores
            </h3>
          </div>
          {turnosViejos.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-red-900/20 border border-red-800/30">
              <div>
                <p className="text-red-200 text-sm font-medium">
                  {t.tipo === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'} — {t.fecha}
                </p>
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

      {/* Panel principal: abrir / cerrar turno */}
      <div className="card space-y-4">
        <h2 className="font-medium text-pan-300">Estado actual</h2>

        {hayAbierto ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-900/20 border border-green-800/30">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-green-300 font-medium">
                Turno {turnoActivo!.tipo === 'MANIANA' ? 'Mañana' : 'Tarde'} activo
              </span>
              <span className="text-green-700 text-sm ml-auto">
                desde {formatFecha(turnoActivo!.inicio)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => router.push('/pos')} className="btn-primary gap-2">
                <Play size={16}/> Ir al POS
              </button>
              <button onClick={() => cerrarTurno()} disabled={cargando} className="btn-danger gap-2">
                <Square size={16}/> {cargando ? 'Cerrando…' : 'Cerrar turno'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {bloqueado
              ? <p className="text-amber-400 text-sm">⚠ Cerrá los turnos anteriores para abrir uno nuevo.</p>
              : <p className="text-pan-500 text-sm">No hay turno activo. Elegí el turno para comenzar:</p>
            }
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => abrirTurno('MANIANA')}
                disabled={cargando || bloqueado}
                className="btn-primary gap-2 py-4 text-base disabled:opacity-40"
              >
                <Play size={18}/> 🌅 Mañana
              </button>
              <button
                onClick={() => abrirTurno('TARDE')}
                disabled={cargando || bloqueado}
                className="btn-secondary gap-2 py-4 text-base disabled:opacity-40"
              >
                <Play size={18}/> 🌆 Tarde
              </button>
            </div>
            {cargando && (
              <p className="text-center text-pan-500 text-sm animate-pulse">Abriendo turno…</p>
            )}
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="space-y-3">
        <h2 className="font-medium text-pan-300">Historial</h2>
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
                  {t.estado === 'CERRADO' && t.id !== turnoActivo?.id && (
                    <button onClick={() => reabrirTurno(t)} disabled={cargando}
                      title="Reabrir turno"
                      className="btn-ghost btn-sm p-1.5 text-green-500 hover:text-green-400">
                      <RotateCcw size={13}/>
                    </button>
                  )}
                  {t.estado === 'ABIERTO' && t.id !== turnoActivo?.id && (
                    <button onClick={() => cerrarTurno(t.id)} disabled={cargando}
                      className="btn btn-sm btn-danger">Cerrar</button>
                  )}
                  <button onClick={() => { setModalEditar(t); setEditFecha(t.fecha); setEditTipo(t.tipo); }}
                    className="btn-ghost btn-sm p-1.5 text-pan-600 hover:text-pan-300">
                    <Edit2 size={13}/>
                  </button>
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

      {/* Modal editar */}
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
                {cargando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {modalEliminar && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalEliminar(null)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-red-300">Eliminar turno</h2>
              <button onClick={() => setModalEliminar(null)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4">
              <div className="px-3 py-2 rounded-xl bg-red-900/20 border border-red-800/30 text-sm">
                <p className="text-red-300 font-medium">
                  {modalEliminar.tipo === 'MANIANA' ? '🌅 Mañana' : '🌆 Tarde'} — {modalEliminar.fecha}
                </p>
                <p className="text-red-500 text-xs mt-1">Solo se puede eliminar si no tiene ventas.</p>
              </div>
            </div>
            <div className="p-4 border-t border-bg-border flex gap-2">
              <button onClick={() => setModalEliminar(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => eliminarTurno(modalEliminar)} disabled={cargando} className="btn-danger flex-1">
                {cargando ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
