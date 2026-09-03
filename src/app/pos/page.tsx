'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Flame } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { GridProductos }  from '@/components/pos/GridProductos';
import { Carrito }        from '@/components/pos/Carrito';
import { ModalCobro }     from '@/components/pos/ModalCobro';
import { ModalHorneado }  from '@/components/pos/ModalHorneado';
import type { Producto, Promocion, Categoria, Cliente } from '@/types';

export default function PosPage() {
  const supabase = createClient();
  const { usuario, turnoActivo } = useSesion();

  const [productos,   setProductos]   = useState<Producto[]>([]);
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [categorias,  setCategorias]  = useState<Categoria[]>([]);
  const [clientes,    setClientes]    = useState<Cliente[]>([]);
  const [ventas,      setVentas]      = useState<any[]>([]);
  const [modalCobro,    setModalCobro]    = useState(false);
  const [modalHorneado, setModalHorneado] = useState(false);

  const cargarProductos   = useCallback(async () => {
    const [{ data }, { data: cats }] = await Promise.all([
      supabase.from('productos').select('*').eq('activo', true).order('nombre'),
      supabase.from('categorias').select('id').eq('es_insumo', true),
    ]);
    const catInsumo = new Set((cats ?? []).map((c: any) => c.id));
    if (data) setProductos(catInsumo.size > 0 ? data.filter((p: any) => !catInsumo.has(p.categoria_id)) : data);
  }, []);
  const cargarCategorias  = useCallback(async () => { const { data } = await supabase.from('categorias').select('*').eq('activa', true).order('orden'); if (data) setCategorias(data); }, []);
  const cargarPromociones = useCallback(async () => { const { data } = await supabase.from('promociones').select('*').eq('activa', true); if (data) setPromociones(data); }, []);
  const cargarClientes    = useCallback(async () => { const { data } = await supabase.from('clientes').select('*').eq('activo', true).order('nombre'); if (data) setClientes(data); }, []);
  const cargarVentas      = useCallback(async () => {
    if (!turnoActivo) { setVentas([]); return; }
    const { data } = await supabase.from('ventas').select('*, venta_items(*)').eq('turno_id', turnoActivo.id).eq('anulada', false);
    if (data) setVentas(data);
  }, [turnoActivo]);

  useEffect(() => { cargarProductos(); cargarCategorias(); cargarPromociones(); cargarClientes(); }, []);
  useEffect(() => { cargarVentas(); }, [turnoActivo]);
  useEffect(() => {
    const canal = supabase.channel('pos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, cargarProductos)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, cargarVentas)
      .subscribe();
    return () => { canal.unsubscribe(); };
  }, [turnoActivo]);

  const resumenTurno = ventas.reduce(
    (acc, v) => {
      acc.total += v.total;
      if (v.medio_pago === 'EFECTIVO') acc.efectivo += v.total;
      else if (v.medio_pago === 'TRANSFERENCIA') acc.transferencia += v.total;
      else if (v.medio_pago === 'CUENTA_CORRIENTE') acc.cc += v.total;
      else if (v.medio_pago === 'MIXTO') {
        (v.pagos ?? []).forEach((p: any) => {
          if (p.medio === 'EFECTIVO') acc.efectivo += p.monto;
          else if (p.medio === 'TRANSFERENCIA') acc.transferencia += p.monto;
          else if (p.medio === 'CUENTA_CORRIENTE') acc.cc += p.monto;
        });
      }
      if (!v.transferencia_confirmada && v.medio_pago === 'TRANSFERENCIA') acc.pendientes++;
      return acc;
    },
    { efectivo: 0, transferencia: 0, cc: 0, total: 0, pendientes: 0 }
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {!turnoActivo && (
        <div className="shrink-0 bg-amber-900/30 border-b border-amber-800/40 px-4 py-2 text-center">
          <p className="text-amber-300 text-sm">
            ⚠ No hay turno activo.{' '}
            <a href="/turnos" className="underline font-medium">Abrir turno →</a>
          </p>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col md:grid md:grid-cols-[1fr_380px]">
        {/* Carrito compacto arriba en mobile */}
        <div className="md:hidden shrink-0 border-b border-bg-border bg-bg-surface" style={{ maxHeight:'40vh' }}>
          <Carrito
            turno={turnoActivo} clientes={clientes} promociones={promociones} productos={productos}
            onCobrar={() => setModalCobro(true)} resumenTurno={resumenTurno} compacto
          />
        </div>

        {/* Grid productos */}
        <div className="overflow-hidden flex flex-col min-h-0">
          {usuario && ['ADMIN','GESTOR'].includes(usuario.rol) && (
            <div className="px-3 pt-3 shrink-0">
              <button onClick={() => setModalHorneado(true)}
                className="btn btn-secondary btn-sm gap-2 text-amber-400 border-amber-800/40 hover:bg-amber-900/20">
                <Flame size={15}/> Registrar Horneado
              </button>
            </div>
          )}
          <GridProductos productos={productos} promociones={promociones} categorias={categorias}/>
        </div>

        {/* Carrito desktop */}
        <div className="hidden md:flex border-l border-bg-border overflow-hidden">
          <Carrito
            turno={turnoActivo} clientes={clientes} promociones={promociones} productos={productos}
            onCobrar={() => setModalCobro(true)} resumenTurno={resumenTurno}
          />
        </div>
      </div>

      {modalCobro && (
        <ModalCobro
          onCerrar={() => setModalCobro(false)}
          onExito={() => { setModalCobro(false); cargarProductos(); cargarVentas(); }}
          clientes={clientes}
        />
      )}
      {modalHorneado && (
        <ModalHorneado
          productos={productos.filter((p) => p.tipo === 'HORNEADO')}
          onCerrar={() => setModalHorneado(false)}
          onExito={() => { setModalHorneado(false); cargarProductos(); }}
        />
      )}
    </div>
  );
}
