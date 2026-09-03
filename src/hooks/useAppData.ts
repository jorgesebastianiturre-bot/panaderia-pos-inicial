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

    async function recargarTurno() {
      // Buscar cualquier turno ABIERTO, no solo el de hoy
      const { data } = await supabase
        .from('turnos')
        .select('*, usuarios(nombre, rol)')
        .eq('estado', 'ABIERTO')
        .order('inicio', { ascending: false })
        .limit(1)
        .maybeSingle();
      setTurno(data as Turno | null);
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
        () => { recargarTurno(); }
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
