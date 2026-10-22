'use client';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import type { Usuario, Turno } from '@/types';

export function useAppData() {
  const { setUsuario, setTurno, setCargando } = useSesion();
  // Ref para evitar que múltiples recargas simultáneas pisoteen entre sí
  const recargandoRef  = useRef(false);
  const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnoIdRef     = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;

    /**
     * Recarga el turno activo desde la DB.
     * Si la query vuelve vacía y teníamos un turno (posible race condition al cerrar/abrir),
     * esperamos 800ms y volvemos a intentar antes de limpiar el store.
     * Si la query devuelve un turno, actualizamos inmediatamente — sin delays.
     */
    async function recargarTurno(origenEvento = false) {
      // Evitar recargas simultáneas que se pisen
      if (recargandoRef.current) return;
      recargandoRef.current = true;

      try {
        const { data } = await supabase
          .from('turnos')
          .select('*, usuarios(nombre, rol)')
          .eq('estado', 'ABIERTO')
          .order('inicio', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          // Turno encontrado: siempre actualizar de inmediato
          // Esto cubre el caso "otro dispositivo abrió turno" → se refleja al instante
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
          turnoIdRef.current = data.id;
          setTurno(data as Turno);
        } else if (origenEvento && turnoIdRef.current) {
          // Recibimos un evento realtime pero la query volvió vacía.
          // Puede ser race condition (la DB aún no propagó el estado).
          // Esperar 800ms y verificar una vez más antes de limpiar.
          if (!retryTimerRef.current) {
            retryTimerRef.current = setTimeout(async () => {
              retryTimerRef.current = null;
              const { data: retry } = await supabase
                .from('turnos')
                .select('*, usuarios(nombre, rol)')
                .eq('estado', 'ABIERTO')
                .order('inicio', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (retry) {
                turnoIdRef.current = retry.id;
                setTurno(retry as Turno);
              } else {
                // Confirmado: el turno fue cerrado
                turnoIdRef.current = null;
                setTurno(null);
              }
            }, 800);
          }
        } else {
          // Carga inicial sin turno activo, o cierre confirmado
          turnoIdRef.current = null;
          setTurno(null);
        }
      } finally {
        recargandoRef.current = false;
      }
    }

    async function cargar() {
      setCargando(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCargando(false); return; }

      const { data: perfil } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_id', user.id)
        .eq('activo', true)
        .single();

      if (!perfil) { setCargando(false); return; }
      setUsuario(perfil as Usuario);

      // Cargar turno inicial (sin lógica de retry — es carga fresca)
      await recargarTurno(false);
      setCargando(false);

      // Suscripción realtime: cualquier cambio en la tabla turnos (INSERT, UPDATE, DELETE)
      // se propaga a TODOS los dispositivos conectados en tiempo real.
      // Así, cuando un dispositivo abre o cierra el turno, los demás se enteran al instante.
      canal = supabase
        .channel('turno-global-watch')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'turnos' },
          () => { recargarTurno(true); }
        )
        .subscribe((status) => {
          // Si el canal se reconecta después de una desconexión, recargar el turno
          // para no quedarse con estado stale
          if (status === 'SUBSCRIBED') {
            recargarTurno(false);
          }
        });
    }

    cargar();

    // Detectar cuando el usuario vuelve a la pestaña/app después de estar ausente
    // Esto resuelve el caso "abrí el celular y quedó el estado viejo"
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        recargarTurno(false);
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // También recargar cuando la ventana recupera el foco (útil en desktop)
    function handleFocus() {
      recargarTurno(false);
    }
    window.addEventListener('focus', handleFocus);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setUsuario(null); setTurno(null); turnoIdRef.current = null; }
      if (event === 'SIGNED_IN')  { cargar(); }
    });

    return () => {
      canal?.unsubscribe();
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
