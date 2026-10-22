'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import type { Usuario, Turno } from '@/types';

export function useAppData() {
  const { setUsuario, setTurno, setCargando } = useSesion();

  useEffect(() => {
    const supabase = createClient();
    let canal: any = null;

    // Control para evitar race conditions: si tenemos turno activo y la query
    // devuelve null, esperamos 1.5s y volvemos a verificar antes de borrarlo
    let turnoActualId: string | null = null;

    async function recargarTurno(conRetry = false) {
      const { data } = await supabase
        .from('turnos')
        .select('*, usuarios(nombre, rol)')
        .eq('estado', 'ABIERTO')
        .order('inicio', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        // Turno encontrado: actualizar siempre
        turnoActualId = data.id;
        setTurno(data as Turno);
      } else if (conRetry && turnoActualId) {
        // Hay un turno en el store pero la query volvió vacía — puede ser race condition
        // Esperar 1.5s y verificar de nuevo antes de borrar
        setTimeout(async () => {
          const { data: retry } = await supabase
            .from('turnos')
            .select('*, usuarios(nombre, rol)')
            .eq('estado', 'ABIERTO')
            .order('inicio', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (retry) {
            turnoActualId = retry.id;
            setTurno(retry as Turno);
          } else {
            turnoActualId = null;
            setTurno(null);
          }
        }, 1500);
      } else {
        // Carga inicial o cierre real confirmado
        turnoActualId = null;
        setTurno(null);
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
      await recargarTurno();
      setCargando(false);

      canal = supabase.channel('turno-watch').on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos' },
        // Pasar conRetry=true: si el turno desaparece en una sola query, verificar antes de borrar
        () => { recargarTurno(true); }
      ).subscribe();
    }

    cargar();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setUsuario(null); setTurno(null); }
      if (event === 'SIGNED_IN') { cargar(); }
    });

    return () => {
      canal?.unsubscribe();
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
