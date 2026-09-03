'use client';
// GridProductos: al tocar un producto abre ModalCantidad antes de agregar al carrito
import { useState, useMemo, useEffect } from 'react';
import { Flame, Search, X, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCarrito } from '@/lib/store';
import { ModalCantidad } from './ModalCantidad';
import { formatPrecio, cx } from '@/lib/utils';
import type { Producto, Promocion, Categoria } from '@/types';

interface Props {
  productos:   Producto[];
  promociones: Promocion[];
  categorias:  Categoria[];
}

export function GridProductos({ productos, promociones, categorias }: Props) {
  const { agregarItemConCantidad, agregarItemConMonto } = useCarrito();
  const supabase = createClient();
  const [busqueda,    setBus]      = useState('');
  const [catActiva,   setCat]      = useState<string | null>(null);
  const [ranking,     setRanking]  = useState<Record<string, number>>({});
  // Producto seleccionado para el modal de cantidad
  const [prodModal,   setProdModal] = useState<Producto | null>(null);

  useEffect(() => {
    async function cargarRanking() {
      const { data } = await supabase
        .from('venta_items')
        .select('producto_id, cantidad')
        .order('venta_id', { ascending: false })
        .limit(500);
      if (!data) return;
      const mapa: Record<string, number> = {};
      for (const row of data) {
        mapa[row.producto_id] = (mapa[row.producto_id] ?? 0) + row.cantidad;
      }
      setRanking(mapa);
    }
    cargarRanking();

    const canal = supabase.channel('ranking-ventas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'venta_items' },
        (payload) => {
          const { producto_id, cantidad } = payload.new as any;
          setRanking((prev) => ({ ...prev, [producto_id]: (prev[producto_id] ?? 0) + cantidad }));
        }
      ).subscribe();
    return () => { canal.unsubscribe(); };
  }, []);

  const filtrados = useMemo(() =>
    productos
      .filter((p) => p.activo)
      .filter((p) => !catActiva || p.categoria_id === catActiva)
      .filter((p) => !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase())),
    [productos, busqueda, catActiva]
  );

  const ordenados = useMemo(() => {
    if (busqueda.trim() !== '') return filtrados;
    const horneados = filtrados.filter((p) => p.tipo === 'HORNEADO')
      .sort((a, b) => (ranking[b.id] ?? 0) - (ranking[a.id] ?? 0));
    const reventa = filtrados.filter((p) => p.tipo === 'REVENTA')
      .sort((a, b) => (ranking[b.id] ?? 0) - (ranking[a.id] ?? 0));
    return [...horneados, ...reventa];
  }, [filtrados, busqueda, ranking]);

  function colorStock(p: Producto): string {
    if (p.tipo === 'REVENTA') {
      if (p.stock <= 0) return 'text-red-400';
      if (p.stock <= 3) return 'text-amber-400';
      return 'text-pan-700';
    }
    if (p.stock < 0)   return 'text-red-400';
    if (p.stock === 0) return 'text-amber-400';
    return 'text-pan-700';
  }

  function labelStock(p: Producto): string {
    const v = p.por_peso ? p.stock.toFixed(2) : Math.round(p.stock);
    if (p.tipo === 'HORNEADO' && Number(p.stock) < 0) return `Stock: ${v} ⚠`;
    return `Stock: ${v}`;
  }

  const tienePromo = (id: string) => promociones.some((p) => p.producto_id === id && p.activa);

  function handleConfirmarCantidad(cantidad: number, montoExacto?: number) {
    if (!prodModal) return;
    // Si viene montoExacto (modo $ monto), usar agregarItemConMonto para precio exacto
    if (montoExacto !== undefined && montoExacto > 0) {
      agregarItemConMonto(prodModal, cantidad, montoExacto);
    } else {
      agregarItemConCantidad(prodModal, cantidad, promociones);
    }
    setProdModal(null);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Buscador */}
      <div className="p-3 pb-2 space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pan-600 pointer-events-none"/>
          <input className="input pl-9 pr-10" type="search" placeholder="Buscar producto..."
            value={busqueda} onChange={(e) => setBus(e.target.value)}/>
          {busqueda && (
            <button onClick={() => setBus('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-pan-500 hover:text-pan-200 hover:bg-bg-hover transition-colors active:scale-90">
              <X size={16}/>
            </button>
          )}
        </div>

        {/* Chips de categoría */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setCat(null)}
            className={cx('btn btn-sm shrink-0 font-medium',
              !catActiva ? 'bg-pan-500 text-white border-pan-500' : 'btn-secondary')}>
            Todas
          </button>
          {categorias.filter((c) => c.activa).sort((a, b) => a.orden - b.orden).map((c) => (
            <button key={c.id} onClick={() => setCat(catActiva === c.id ? null : c.id)}
              className="btn btn-sm shrink-0 btn-secondary transition-all"
              style={catActiva === c.id
                ? { background: c.color + '33', borderColor: c.color, color: c.color }
                : {}}>
              {c.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3 pt-0 pb-20 md:pb-3">
        {ordenados.length === 0 ? (
          <div className="text-center py-16 text-pan-700">
            <Package size={48} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">{busqueda ? `Sin resultados para "${busqueda}"` : 'Sin productos'}</p>
            {busqueda && (
              <button onClick={() => setBus('')} className="mt-3 btn-ghost btn-sm text-pan-500">
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {ordenados.map((p) => (
              <button key={p.id} onClick={() => setProdModal(p)}
                className="prod-card text-left flex flex-col">
                <div className="flex gap-1 flex-wrap min-h-[18px]">
                  {p.tipo === 'HORNEADO' && (
                    <span className="badge badge-warn py-0 px-1"><Flame size={9}/> Horno</span>
                  )}
                  {tienePromo(p.id) && <span className="badge badge-pan py-0 px-1">🏷</span>}
                </div>
                <p className="text-pan-100 font-medium text-sm leading-tight line-clamp-3 flex-1 mt-1">
                  {p.nombre}
                </p>
                <div className="mt-2">
                  <p className="text-pan-300 font-bold text-base leading-none">
                    {formatPrecio(p.precio)}
                    {p.por_peso && <span className="text-xs font-normal text-pan-600">/kg</span>}
                  </p>
                  <p className={cx('text-xs mt-0.5', colorStock(p))}>{labelStock(p)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal de cantidad */}
      {prodModal && (
        <ModalCantidad
          producto={prodModal}
          promociones={promociones}
          onConfirmar={handleConfirmarCantidad}
          onCerrar={() => setProdModal(null)}
        />
      )}
    </div>
  );
}
