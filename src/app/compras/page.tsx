'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef } from 'react';
import { TrendingDown, Plus, X, Trash2, Search, Edit2, AlertTriangle , Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatPrecio, formatFecha, calcularPrecioSugerido, genId } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Proveedor, Producto, ItemCompra } from '@/types';

const MEDIOS_PAGO = [
  { val: 'efectivo',         label: 'Efectivo' },
  { val: 'transferencia',    label: 'Transferencia' },
  { val: 'cuenta_corriente', label: 'Cuenta Corriente' },
];

export default function ComprasPage() {
  const supabase  = createClient();
  const { usuario } = useSesion();
  const [compras,     setCompras]   = useState<any[]>([]);
  const [proveedores, setProvs]     = useState<Proveedor[]>([]);
  const [productos,   setProductos] = useState<Producto[]>([]);
  const [busqCompra,  setBusqCompra]  = useState('');
  const [modal,       setModal]     = useState(false);
  const [editandoCompra, setEditandoCompra] = useState<any | null>(null);
  const [cargando,    setCargando]  = useState(false);

  const [provId,    setProvId]    = useState('');
  const [margen,    setMargen]    = useState('40');
  const [formaPago, setFormaPago] = useState('efectivo');
  const [destino,   setDestino]   = useState<'VENTA' | 'INSUMO'>('VENTA');
  const [items,     setItems]     = useState<ItemCompra[]>([]);

  // Búsqueda producto
  const [busqProd,    setBusqProd]  = useState('');
  const [prodSel,     setProdSel]   = useState<Producto | null>(null);
  const [busqAbierta, setBusqAb]    = useState(false);
  const [cant,        setCant]      = useState('');
  const [costo,       setCosto]     = useState('');
  const [precioVenta, setPrecioVenta] = useState(''); // editable por el usuario
  const [usarSugerido, setUsarSugerido] = useState(true);
  const [focusIdx,    setFocusIdx]  = useState(-1);
  const refBusq = useRef<HTMLInputElement>(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [{ data: cs }, { data: ps }, { data: prods }] = await Promise.all([
      supabase.from('compras').select('*, proveedores(nombre)').order('fecha', { ascending: false }).limit(30),
      supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
      supabase.from('productos').select('id, nombre, precio').eq('activo', true).order('nombre'),
    ]);
    if (cs)    setCompras(cs);
    if (ps)    setProvs(ps);
    if (prods) setProductos(prods as any);
  }

  const productosFiltrados = productos.filter((p) =>
    busqProd.trim().length > 0 && p.nombre.toLowerCase().includes(busqProd.toLowerCase())
  );

  const costoSugerido = costo ? calcularPrecioSugerido(+costo.replace(',', '.'), +(margen || 40)) : 0;
  // El precio de venta final es el sugerido si usarSugerido, o el que escribió el usuario
  const precioVentaFinal = usarSugerido ? costoSugerido : (parseFloat(precioVenta.replace(',', '.')) || 0);

  function seleccionarProducto(p: Producto) {
    setProdSel(p); setBusqProd(p.nombre); setBusqAb(false); setFocusIdx(-1);
    setPrecioVenta(String(p.precio)); // pre-llenar con precio actual
    setTimeout(() => document.getElementById('inp-cant')?.focus(), 50);
  }

  function limpiarSeleccion() {
    setProdSel(null); setBusqProd(''); setCant(''); setCosto(''); setPrecioVenta(''); setUsarSugerido(true);
    setTimeout(() => refBusq.current?.focus(), 50);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!busqAbierta || productosFiltrados.length === 0) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); setFocusIdx((i) => Math.min(i + 1, productosFiltrados.length - 1)); }
    else if (e.key === 'ArrowUp')  { e.preventDefault(); setFocusIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && focusIdx >= 0) { e.preventDefault(); seleccionarProducto(productosFiltrados[focusIdx]); }
    else if (e.key === 'Escape') { setBusqAb(false); }
  }

  function agregarItem() {
    if (!prodSel || !cant || !costo) { toast.error('Completá todos los campos'); return; }
    const c  = parseFloat(cant.replace(',', '.'));
    const co = parseFloat(costo.replace(',', '.'));
    if (isNaN(c) || isNaN(co) || c <= 0 || co <= 0) { toast.error('Valores inválidos'); return; }
    if (precioVentaFinal <= 0) { toast.error('El precio de venta debe ser mayor a 0'); return; }

    setItems([...items, {
      producto_id:  prodSel.id,
      nombre:       prodSel.nombre,
      cantidad:     c,
      precio_costo: co,
      precio_venta: precioVentaFinal,
      subtotal:     co * c,
      destino:      destino,
    }]);
    limpiarSeleccion();
  }

  function abrirModalNuevo() {
    setEditandoCompra(null);
    setItems([]); setProvId(''); setMargen('40'); setFormaPago('efectivo');
    limpiarSeleccion();
    setModal(true);
  }

  function abrirModalEditar(c: any) {
    setEditandoCompra(c);
    setItems(c.items ?? []);
    setProvId(c.proveedor_id ?? '');
    setMargen(String(c.margen ?? 40));
    setFormaPago(c.forma_pago ?? 'efectivo');
    limpiarSeleccion();
    setModal(true);
  }

  async function guardarCompra() {
    if (!usuario || items.length === 0) { toast.error('Agregá al menos un producto'); return; }
    setCargando(true);
    const total = items.reduce((a, i) => a + i.subtotal, 0);

    if (editandoCompra) {
      // Editar compra existente
      const { error } = await supabase.from('compras').update({
        proveedor_id: provId || null,
        margen:       parseFloat(margen) || 40,
        forma_pago:   formaPago,
        items,
        total,
      }).eq('id', editandoCompra.id);
      if (error) { toast.error('Error al actualizar'); setCargando(false); return; }
      toast.success('Compra actualizada ✓');
    } else {
      // Nueva compra
      const compra = { id: genId('co'), fecha: Date.now(), proveedor_id: provId || null, usuario_id: usuario.id, margen: parseFloat(margen) || 40, forma_pago: formaPago, items, total, creado_en: Date.now() };
      const { error } = await supabase.from('compras').insert(compra);
      if (error) { toast.error('Error al registrar'); setCargando(false); return; }

      // Actualizar stock y precio de productos
      for (const item of items) {
        const { data: prod } = await supabase.from('productos').select('stock').eq('id', item.producto_id).single();
        if (prod) await supabase.from('productos').update({ stock: prod.stock + item.cantidad, precio: item.precio_venta }).eq('id', item.producto_id);
        await supabase.from('movimientos_stock').insert({ id: genId('m'), producto_id: item.producto_id, tipo: 'COMPRA', cantidad: item.cantidad, fecha: Date.now(), usuario_id: usuario.id, referencia_id: compra.id });
      }
      toast.success('Compra registrada ✓');
    }

    setModal(false); cargar(); setCargando(false);
  }

  async function eliminarCompra(id: string) {
    if (!confirm('¿Eliminás esta compra? El stock NO se revierte automáticamente.')) return;
    await supabase.from('compras').delete().eq('id', id);
    toast.success('Compra eliminada');
    cargar();
  }

  const totalNueva = items.reduce((a, i) => a + i.subtotal, 0);

  function labelMedio(val: string) {
    return MEDIOS_PAGO.find((m) => m.val === val)?.label ?? val;
  }

  function imprimirComprobante(c: any) {
    const fechaStr = new Date(c.fecha).toLocaleDateString('es-AR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const items = c.items ?? [];
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Comprobante Compra</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:24px;max-width:480px;margin:0 auto}
  .header{text-align:center;border-bottom:3px solid #1a5276;padding-bottom:12px;margin-bottom:16px}
  .logo{font-size:20px;font-weight:bold;color:#1a5276}
  .tipo{font-size:11px;color:#666;margin-top:2px}
  .fecha{font-size:13px;font-weight:bold;margin-top:4px}
  .datos{background:#f7f7f7;border:1px solid #ddd;border-radius:6px;padding:10px;margin-bottom:12px;font-size:12px}
  .datos p{margin:3px 0}
  table{width:100%;border-collapse:collapse}
  th{background:#1a5276;color:white;padding:7px 8px;text-align:left;font-size:11px}
  th.r{text-align:right}
  td{padding:6px 8px;border-bottom:1px solid #eee;font-size:12px}
  td.r{text-align:right}
  tr:nth-child(even) td{background:#fafafa}
  .total-row td{background:#d6eaf8;font-weight:bold;font-size:13px}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px;padding-top:10px;border-top:1px solid #eee}
  @media print{@page{margin:10mm;size:A5}}
</style></head><body>
<div class="header">
  <div class="logo">🥖 Panadería</div>
  <div class="tipo">Comprobante de Compra</div>
  <div class="fecha">${fechaStr}</div>
</div>
<div class="datos">
  ${c.proveedores?.nombre ? `<p><strong>Proveedor:</strong> ${c.proveedores.nombre}</p>` : ''}
  <p><strong>Forma de pago:</strong> ${c.forma_pago ?? ''}</p>
  <p><strong>Margen configurado:</strong> ${c.margen ?? 0}%</p>
</div>
<table>
  <thead><tr><th>Artículo</th><th class="r">Cant.</th><th class="r">Costo unit.</th><th class="r">Subtotal</th></tr></thead>
  <tbody>
    ${items.map((i: any) => `<tr><td>${i.nombre ?? ''}<br><span style="font-size:10px;color:#888">${i.destino === 'INSUMO' ? '🧪 Insumo' : '🛒 Venta'}</span></td><td class="r">${i.cantidad}</td><td class="r">$${(i.precio_costo ?? 0).toLocaleString('es-AR')}</td><td class="r">$${(i.subtotal ?? 0).toLocaleString('es-AR')}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="3">TOTAL</td><td class="r">$${(c.total ?? 0).toLocaleString('es-AR')}</td></tr>
  </tbody>
</table>
<div class="footer">Panadería · Comprobante interno · ${new Date().toLocaleDateString('es-AR')}</div>
</body></html>`;
    const win = window.open('','_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="text-pan-500"/>
          <h1 className="font-display font-bold text-xl text-pan-200">Compras</h1>
        </div>
        <button onClick={abrirModalNuevo} className="btn-primary btn-sm gap-1">
          <Plus size={15}/> Nueva compra
        </button>
      </div>

      <div className="relative">
        <input className="input pl-8 text-sm" placeholder="Buscar por proveedor, artículo, fecha o forma de pago..."
          value={busqCompra} onChange={e => setBusqCompra(e.target.value)}/>
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-pan-600" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        {busqCompra && <button onClick={() => setBusqCompra('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-pan-600 text-xs">✕</button>}
      </div>

      <div className="space-y-2">
        {compras.filter((c: any) => {
          if (!busqCompra.trim()) return true;
          const q = busqCompra.toLowerCase();
          const items = Array.isArray(c.items) ? c.items : [];
          return (
            c.proveedores?.nombre?.toLowerCase().includes(q) ||
            c.forma_pago?.toLowerCase().includes(q) ||
            new Date(c.fecha).toLocaleDateString('es-AR').includes(q) ||
            items.some((i: any) => i.nombre?.toLowerCase().includes(q))
          );
        }).map((c: any) => (
          <div key={c.id} className="card-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-pan-200 font-medium text-sm">{c.proveedores?.nombre ?? 'Sin proveedor'}</p>
                <p className="text-pan-600 text-xs">
                  {formatFecha(c.fecha)} ·{' '}
                  <span className={c.forma_pago === 'cuenta_corriente' ? 'text-amber-400' : 'text-pan-600'}>
                    {labelMedio(c.forma_pago ?? '')}
                  </span>
                  {' · '}{(c.items ?? []).length} producto{(c.items ?? []).length !== 1 ? 's' : ''}
                  {' · '}Margen {c.margen}%
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-pan-300 font-bold">{formatPrecio(c.total)}</span>
                <button onClick={() => imprimirComprobante(c)} className="btn-ghost btn-sm p-1.5 text-pan-600" title="Comprobante">
                  <Download size={13}/>
                </button>
                <button onClick={() => abrirModalEditar(c)} className="btn-ghost btn-sm p-1.5">
                  <Edit2 size={13}/>
                </button>
                <button onClick={() => eliminarCompra(c.id)} className="btn-ghost btn-sm p-1.5 text-red-500 hover:text-red-400">
                  <X size={13}/>
                </button>
              </div>
            </div>
          </div>
        ))}
        {compras.length === 0 && <p className="text-pan-700 text-sm text-center py-8">Sin compras registradas</p>}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">
                {editandoCompra ? 'Editar compra' : 'Nueva compra'}
              </h2>
              <button onClick={() => setModal(false)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Proveedor</label>
                  <select className="input" value={provId} onChange={(e) => {
                    setProvId(e.target.value);
                    const p = proveedores.find((p) => p.id === e.target.value);
                    if (p) setMargen(String(p.margen_default));
                  }}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Margen %</label>
                  <input className="input" type="number" value={margen} onChange={(e) => setMargen(e.target.value)}/>
                </div>
              </div>

              <div>
                <label className="label">Forma de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {MEDIOS_PAGO.map((m) => (
                    <button key={m.val} onClick={() => setFormaPago(m.val)}
                      className={`btn py-2.5 h-auto border text-sm ${formaPago === m.val ? 'bg-pan-500/20 border-pan-500 text-pan-300' : 'bg-bg-card border-bg-border text-pan-500 hover:border-pan-600'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {formaPago === 'cuenta_corriente' && (
                  <p className="text-amber-400 text-xs mt-1 px-1 flex items-center gap-1">
                    <AlertTriangle size={11}/> Suma deuda en la cta. cte. del proveedor.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="label">Productos comprados</p>
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-card border border-bg-border text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-pan-200 font-medium truncate">{item.nombre}</p>
                      <p className="text-pan-600 text-xs">
                        {item.destino === 'INSUMO' && <span className="badge badge-warn text-xs mr-1">🧪 Insumo</span>}
                        {item.cantidad} u. × costo {formatPrecio(item.precio_costo)} → venta: {formatPrecio(item.precio_venta)}
                      </p>
                    </div>
                    <span className="text-pan-300 font-medium shrink-0">{formatPrecio(item.subtotal)}</span>
                    <button onClick={() => setItems(items.filter((_, j) => j !== i))}
                      className="text-pan-700 hover:text-red-400 shrink-0"><Trash2 size={14}/></button>
                  </div>
                ))}

                <div className="p-3 rounded-xl border border-dashed border-bg-border space-y-2">
                  {/* Buscador producto */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pan-600 pointer-events-none"/>
                    <input ref={refBusq} className="input pl-9 pr-9 text-sm" placeholder="Buscar producto..."
                      value={busqProd} autoComplete="off"
                      onChange={(e) => { setBusqProd(e.target.value); setProdSel(null); setBusqAb(true); setFocusIdx(-1); }}
                      onFocus={() => setBusqAb(true)} onKeyDown={onKeyDown}/>
                    {busqProd && <button onClick={limpiarSeleccion} className="absolute right-3 top-1/2 -translate-y-1/2 text-pan-600 hover:text-pan-400"><X size={14}/></button>}
                    {busqAbierta && busqProd.trim() !== '' && !prodSel && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                        {productosFiltrados.length > 0 ? productosFiltrados.map((p, idx) => (
                          <button key={p.id}
                            className={`w-full px-3 py-2.5 text-left text-sm flex items-center justify-between gap-2 ${focusIdx === idx ? 'bg-pan-500/20 text-pan-200' : 'hover:bg-bg-hover text-pan-200'}`}
                            onMouseDown={() => seleccionarProducto(p)} onMouseEnter={() => setFocusIdx(idx)}>
                            <span className="truncate">{p.nombre}</span>
                            <span className="text-pan-600 text-xs shrink-0">{formatPrecio(p.precio)}</span>
                          </button>
                        )) : (
                          <div>
                            <p className="px-3 py-3 text-pan-700 text-sm text-center">No se encontró "{busqProd}"</p>
                            <button
                              onMouseDown={async () => {
                                if (!busqProd.trim()) return;
                                const { createClient } = await import('@/lib/supabase/client');
                                const sb = createClient();
                                const id = Math.random().toString(36).slice(2);
                                const { data, error } = await sb.from('productos').insert({
                                  id, nombre: busqProd.trim(), precio: 0, tipo: 'REVENTA',
                                  stock: 0, por_peso: false, activo: true,
                                  controla_vencimiento: false, creado_en: Date.now(),
                                }).select().single();
                                if (!error && data) {
                                  setProductos((prev) => [...prev, data]);
                                  seleccionarProducto(data);
                                }
                              }}
                              className="w-full px-3 py-3 text-left text-sm hover:bg-bg-hover flex items-center gap-2 border-t border-bg-border text-pan-400">
                              <Plus size={14} className="text-pan-500 shrink-0"/>
                              <span>Crear producto <strong className="text-pan-200">"{busqProd.trim()}"</strong></span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {prodSel && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="label text-xs">Cantidad</label>
                          <input id="inp-cant" className="input text-sm" type="number" placeholder="0"
                            value={cant} onChange={(e) => setCant(e.target.value)}/>
                        </div>
                        <div>
                          <label className="label text-xs">Precio de costo</label>
                          <input className="input text-sm" type="number" placeholder="0"
                            value={costo} onChange={(e) => setCosto(e.target.value)}/>
                        </div>
                      </div>

                      {/* Precio de venta: sugerido o manual */}
                      {costo && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 px-1">
                            <label className="flex items-center gap-2 text-xs text-pan-400 cursor-pointer flex-1">
                              <input type="checkbox" checked={usarSugerido}
                                onChange={(e) => {
                                  setUsarSugerido(e.target.checked);
                                  if (e.target.checked) setPrecioVenta(String(costoSugerido));
                                }}/>
                              Usar precio sugerido: <span className="text-pan-300 font-bold ml-1">{formatPrecio(costoSugerido)}</span>
                            </label>
                          </div>
                          {!usarSugerido && (
                            <div>
                              <label className="label text-xs">Precio de venta personalizado</label>
                              <input className="input text-sm border-pan-500" type="number"
                                placeholder={String(costoSugerido)}
                                value={precioVenta}
                                onChange={(e) => setPrecioVenta(e.target.value)}
                                autoFocus/>
                            </div>
                          )}
                          <p className="text-pan-700 text-xs px-1">
                            Precio actual en catálogo: {formatPrecio(prodSel.precio)}
                            {' → '}
                            <span className="text-pan-400">Nuevo: {formatPrecio(precioVentaFinal)}</span>
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Destino del artículo */}
                  <div>
                    <label className="label text-xs">Destino</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setDestino('VENTA')}
                        className={`btn flex-1 btn-sm ${destino === 'VENTA' ? 'btn-primary' : 'btn-secondary'}`}>
                        🛒 Venta
                      </button>
                      <button type="button" onClick={() => setDestino('INSUMO')}
                        className={`btn flex-1 btn-sm ${destino === 'INSUMO' ? 'btn-primary' : 'btn-secondary'}`}>
                        🧪 Insumo
                      </button>
                    </div>
                    <p className="text-pan-700 text-xs mt-1">
                      {destino === 'VENTA' ? 'Suma al stock disponible para venta' : 'Va al stock de insumos de producción'}
                    </p>
                  </div>

                  <button onClick={agregarItem} disabled={!prodSel || !cant || !costo}
                    className="btn-secondary w-full btn-sm disabled:opacity-40">
                    + Agregar ítem
                  </button>
                </div>
              </div>

              {items.length > 0 && (
                <div className="flex justify-between font-bold text-pan-200 px-1 text-base">
                  <span>Total compra:</span>
                  <span>{formatPrecio(totalNueva)}</span>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardarCompra} disabled={cargando || items.length === 0}
                className="btn-primary w-full btn-lg disabled:opacity-40">
                {cargando ? 'Guardando...' : editandoCompra ? 'Guardar cambios' : 'Registrar compra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
