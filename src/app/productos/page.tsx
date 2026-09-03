'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Package, Plus, Edit2, X, Search, Tag, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPrecio, genId, cx } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Producto, Categoria, TipoProducto, Promocion } from '@/types';

interface PromoForm { id?: string; cantidad: string; precio_total: string; activa: boolean; }
function nuevaPromoForm(): PromoForm { return { cantidad: '', precio_total: '', activa: true }; }

export default function ProductosPage() {
  const supabase = createClient();
  const [productos,     setProductos]     = useState<any[]>([]);
  const [categorias,    setCategorias]    = useState<Categoria[]>([]);
  const [costos,        setCostos]        = useState<Record<string, number>>({});
  const [promosPorProd, setPromosPorProd] = useState<Record<string, Promocion[]>>({});
  const [busqueda,      setBusqueda]      = useState('');
  const [filtroTipo,    setFiltroTipo]    = useState<TipoProducto | ''>('');
  const [modal,         setModal]         = useState(false);
  const [editando,      setEditando]      = useState<Producto | null>(null);
  const [form,          setForm]          = useState<Partial<any>>({});
  const [precioCosto,   setPrecioCosto]   = useState('');
  const [promosForm,    setPromosForm]    = useState<PromoForm[]>([]);
  const [cargando,      setCargando]      = useState(false);
  const [modalAjuste,   setModalAjuste]   = useState<any | null>(null);
  const [ajusteCant,    setAjusteCant]    = useState('');
  const [ajusteMotivo,  setAjusteMotivo]  = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [{ data: prods }, { data: cats }, { data: promosData }, { data: compras }] = await Promise.all([
      supabase.from('productos').select('*, categorias(nombre, color)').order('nombre'),
      supabase.from('categorias').select('*').eq('activa', true).order('orden'),
      supabase.from('promociones').select('*').order('cantidad'),
      supabase.from('compras').select('id, items').order('fecha', { ascending: false }).limit(200),
    ]);

    if (prods)    setProductos(prods);
    if (cats)     setCategorias(cats);

    if (promosData) {
      const map: Record<string, Promocion[]> = {};
      for (const p of promosData) {
        if (!map[p.producto_id]) map[p.producto_id] = [];
        map[p.producto_id].push(p);
      }
      setPromosPorProd(map);
    }

    if (compras) {
      const costosMap: Record<string, number> = {};
      for (const c of compras) {
        for (const item of (c.items ?? [])) {
          if (item.producto_id && item.precio_costo && !costosMap[item.producto_id]) {
            costosMap[item.producto_id] = item.precio_costo;
          }
        }
      }
      setCostos(costosMap);
    }
  }

  function abrirModal(p?: any) {
    if (p) {
      setEditando(p);
      // Solo campos que sabemos que existen en la tabla
      setForm({
        nombre:               p.nombre,
        precio:               p.precio,
        tipo:                 p.tipo,
        categoria_id:         p.categoria_id,
        stock:                p.stock,
        por_peso:             p.por_peso,
        activo:               p.activo,
        controla_vencimiento: p.controla_vencimiento,
      });
      setPrecioCosto(costos[p.id] ? String(costos[p.id]) : '');
      const promos = promosPorProd[p.id] ?? [];
      setPrecioCosto(costos[p.id] ? String(costos[p.id]) : '');
      setPromosForm(promos.map((pr) => ({
        id:          pr.id,
        cantidad:    String(pr.cantidad),
        precio_total: String(pr.precio_total),
        activa:      pr.activa,
      })));
    } else {
      setEditando(null);
      setForm({ tipo: 'REVENTA', activo: true, por_peso: false, controla_vencimiento: false, stock: 0 });
      setPrecioCosto('');
      setPromosForm([]);
    }
    setModal(true);
  }

  function actualizarPromo(idx: number, campo: keyof PromoForm, valor: any) {
    setPromosForm((prev) => prev.map((p, i) => i === idx ? { ...p, [campo]: valor } : p));
  }

  async function guardar() {
    if (!form.nombre || form.precio === undefined || form.precio === '') {
      toast.error('Nombre y precio son obligatorios');
      return;
    }
    setCargando(true);

    // Solo enviamos los campos seguros que sabemos que existen
    const datosProducto = {
      nombre:               form.nombre,
      precio:               Number(form.precio),
      precio_mayorista:     form.precio_mayorista ? Number(form.precio_mayorista) : null,
      tipo:                 form.tipo ?? 'REVENTA',
      categoria_id:         form.categoria_id ?? null,
      stock:                Number(form.stock ?? 0),
      por_peso:             Boolean(form.por_peso),
      activo:               Boolean(form.activo ?? true),
      controla_vencimiento: Boolean(form.controla_vencimiento),
      ingreso_por_monto:    Boolean(form.ingreso_por_monto),
    };

    let productoId = editando?.id;

    if (editando) {
      const { error } = await supabase.from('productos').update(datosProducto).eq('id', editando.id);
      if (error) {
        console.error('Error al guardar producto:', error);
        toast.error('Error al guardar: ' + error.message);
        setCargando(false);
        return;
      }
    } else {
      productoId = genId('p');
      const { error } = await supabase.from('productos').insert({
        ...datosProducto,
        id:        productoId,
        creado_en: Date.now(),
      });
      if (error) {
        console.error('Error al crear producto:', error);
        toast.error('Error al crear: ' + error.message);
        setCargando(false);
        return;
      }
    }

    // Gestionar promociones
    if (productoId) {
      for (const pf of promosForm) {
        if (!pf.cantidad || !pf.precio_total) continue;
        const promoData = {
          producto_id:  productoId,
          tipo:         'CANTIDAD_FIJA' as const,
          cantidad:     parseFloat(pf.cantidad),
          precio_total: parseFloat(pf.precio_total),
          activa:       pf.activa,
          descripcion:  `${pf.cantidad} u. → ${formatPrecio(parseFloat(pf.precio_total))}`,
        };
        if (pf.id) {
          await supabase.from('promociones').update(promoData).eq('id', pf.id);
        } else {
          await supabase.from('promociones').insert({ ...promoData, id: genId('promo') });
        }
      }

      // Eliminar promos removidas
      const idsActuales = promosForm.filter((p) => p.id).map((p) => p.id!);
      for (const po of (promosPorProd[productoId] ?? [])) {
        if (!idsActuales.includes(po.id)) {
          await supabase.from('promociones').delete().eq('id', po.id);
        }
      }
    }

    toast.success(editando ? 'Producto actualizado' : 'Producto creado');
    setModal(false);
    cargar();
    setCargando(false);
  }

  async function aplicarAjuste() {
    if (!modalAjuste || !ajusteCant) { toast.error('Ingresá la cantidad'); return; }
    const cant = parseFloat(ajusteCant.replace(',', '.'));
    if (isNaN(cant)) { toast.error('Cantidad inválida'); return; }
    setCargando(true);

    const nuevoStock = (modalAjuste.stock ?? 0) + cant;
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('productos').update({ stock: nuevoStock }).eq('id', modalAjuste.id),
      supabase.from('movimientos_stock').insert({
        id:          genId('m'),
        producto_id: modalAjuste.id,
        tipo:        'AJUSTE',
        cantidad:    cant,
        fecha:       Date.now(),
        usuario_id:  null,
        referencia_id: null,
        notas:       ajusteMotivo || 'Ajuste manual',
      }),
    ]);

    if (e1) { toast.error('Error al ajustar: ' + e1.message); setCargando(false); return; }
    toast.success(`Stock ajustado: ${cant > 0 ? '+' : ''}${cant} u. → nuevo stock: ${nuevoStock}`);
    setModalAjuste(null); setAjusteCant(''); setAjusteMotivo('');
    cargar(); setCargando(false);
  }

  async function toggleActivo(p: any) {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id);
    cargar();
  }

  const filtrados = productos
    .filter((p) => !filtroTipo || p.tipo === filtroTipo)
    .filter((p) => !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  const activos   = filtrados.filter((p) => p.activo);
  const inactivos = filtrados.filter((p) => !p.activo);

  function FilaProducto({ p }: { p: any }) {
    const costo  = costos[p.id];
    const promos = (promosPorProd[p.id] ?? []).filter((pr) => pr.activa);
    const margen = costo && p.precio > 0 ? Math.round((1 - costo / p.precio) * 100) : null;

    return (
      <div className={cx('card-sm flex items-center gap-3', !p.activo && 'opacity-50')}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-pan-200 font-medium text-sm">{p.nombre}</p>
            <span className={cx('badge', p.tipo === 'HORNEADO' ? 'badge-warn' : 'badge-info')}>
              {p.tipo === 'HORNEADO' ? '🔥 Horno' : 'Reventa'}
            </span>
            {promos.length > 0 && (
              <span className="badge badge-pan">🏷 {promos.length} promo{promos.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-0.5 text-xs">
            <span className="text-pan-300 font-medium">
              Venta: {formatPrecio(p.precio)}{p.por_peso ? '/kg' : ''}
            </span>
            {costo ? (
              <span className="text-pan-600">
                Costo: {formatPrecio(costo)}{margen !== null ? ` · margen ${margen}%` : ''}
              </span>
            ) : (
              <span className="text-pan-700 text-xs">Sin costo registrado</span>
            )}
            {p.precio_mayorista && (
              <span className="text-pan-500 text-xs">
                ⭐ Mayorista: {formatPrecio(p.precio_mayorista)}
              </span>
            )}
            {promos.map((pr: any) => (
              <span key={pr.id} className="text-pan-500">
                🏷 {pr.cantidad}u → {formatPrecio(pr.precio_total)}
              </span>
            ))}
            <span className="text-pan-700">Stock: {p.stock}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { setModalAjuste(p); setAjusteCant(''); setAjusteMotivo(''); }} className="btn-ghost btn-sm p-2" title="Ajustar stock">📦</button>
          <button onClick={() => abrirModal(p)} className="btn-ghost btn-sm p-2"><Edit2 size={14}/></button>
          <button onClick={() => toggleActivo(p)}
            className={cx('btn btn-sm px-3', p.activo ? 'btn-secondary' : 'btn-primary')}>
            {p.activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="text-pan-500"/>
          <h1 className="font-display font-bold text-xl text-pan-200">Productos</h1>
          <span className="badge badge-info">{activos.length} activos</span>
        </div>
        <button onClick={() => abrirModal()} className="btn-primary btn-sm gap-1">
          <Plus size={15}/> Nuevo
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pan-600"/>
          <input className="input pl-8 text-sm" placeholder="Buscar..." value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}/>
          {busqueda && <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-pan-600"><X size={14}/></button>}
        </div>
        <select className="input text-sm" style={{ width:'auto', minWidth:130 }}
          value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as any)}>
          <option value="">Todos</option>
          <option value="HORNEADO">Horneado</option>
          <option value="REVENTA">Reventa</option>
        </select>
      </div>

      <div className="space-y-2">{activos.map((p) => <FilaProducto key={p.id} p={p}/>)}</div>

      {inactivos.length > 0 && (
        <details>
          <summary className="text-pan-600 text-sm cursor-pointer hover:text-pan-400 py-1">
            {inactivos.length} inactivo{inactivos.length !== 1 ? 's' : ''}
          </summary>
          <div className="space-y-2 mt-2">{inactivos.map((p) => <FilaProducto key={p.id} p={p}/>)}</div>
        </details>
      )}

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">{editando ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button onClick={() => setModal(false)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.nombre ?? ''}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Precio de venta *</label>
                  <input className="input" type="number" value={form.precio ?? ''}
                    onChange={(e) => setForm({ ...form, precio: e.target.value })}/>
                </div>
                <div>
                  <label className="label">Precio de costo</label>
                  <input className="input" type="number" placeholder="$ Costo de compra/producción"
                    value={precioCosto}
                    onChange={(e) => setPrecioCosto(e.target.value)}/>
                  {precioCosto && form.precio && parseFloat(precioCosto) > 0 && parseFloat(String(form.precio)) > 0 && (
                    <p className="text-pan-600 text-xs mt-1">
                      Markup: {Math.round((parseFloat(String(form.precio)) / parseFloat(precioCosto) - 1) * 100)}% · Ganancia: ${formatPrecio(parseFloat(String(form.precio)) - parseFloat(precioCosto))}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Tipo</label>
                  <select className="input" value={form.tipo ?? 'REVENTA'}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    <option value="HORNEADO">Horneado (propio)</option>
                    <option value="REVENTA">Reventa</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Categoría</label>
                <select className="input" value={form.categoria_id ?? ''}
                  onChange={(e) => setForm({ ...form, categoria_id: e.target.value || null })}>
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Stock {editando ? 'actual' : 'inicial'}</label>
                <input className="input" type="number" value={form.stock ?? 0}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}/>
              </div>
              <div>
                <label className="label">Precio mayorista <span className="text-pan-700">(opcional)</span></label>
                <input className="input" type="number" placeholder="Si no tiene, dejar vacío"
                  value={form.precio_mayorista ?? ''}
                  onChange={(e) => setForm({ ...form, precio_mayorista: e.target.value || null })}/>
                <p className="text-pan-700 text-xs mt-1">Se aplica automáticamente a clientes mayoristas</p>
              </div>
              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-pan-400 cursor-pointer">
                  <input type="checkbox" checked={Boolean(form.por_peso)}
                    onChange={(e) => setForm({ ...form, por_peso: e.target.checked, ingreso_por_monto: e.target.checked ? form.ingreso_por_monto : false })}/>
                  Venta por peso (kg)
                </label>
                {form.por_peso && (
                  <label className="flex items-start gap-2 text-sm cursor-pointer pl-4 border-l-2 border-pan-500/30">
                    <input type="checkbox" className="mt-0.5" checked={Boolean(form.ingreso_por_monto)}
                      onChange={(e) => setForm({ ...form, ingreso_por_monto: e.target.checked })}/>
                    <div>
                      <span className="text-pan-400">Facturar por monto $</span>
                      <p className="text-pan-700 text-xs">Vendedor tipea $ y el sistema calcula los kg automático</p>
                    </div>
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm text-pan-400 cursor-pointer">
                  <input type="checkbox" checked={Boolean(form.controla_vencimiento)}
                    onChange={(e) => setForm({ ...form, controla_vencimiento: e.target.checked })}/>
                  Controla vencimiento
                </label>
              </div>

              {/* Promociones */}
              <div className="border-t border-bg-border pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag size={14} className="text-pan-500"/>
                    <p className="text-pan-300 font-medium text-sm">Promociones de cantidad</p>
                  </div>
                  <button onClick={() => setPromosForm([...promosForm, nuevaPromoForm()])}
                    className="btn-ghost btn-sm gap-1 text-pan-500">
                    <Plus size={13}/> Agregar
                  </button>
                </div>

                {promosForm.length === 0 && (
                  <p className="text-pan-700 text-xs px-1">Sin promociones activas.</p>
                )}

                {promosForm.map((pf, idx) => (
                  <div key={idx} className="space-y-2 p-3 rounded-xl bg-bg-card border border-bg-border">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label text-xs">Cantidad</label>
                        <input className="input text-sm" type="number" placeholder="Ej: 10"
                          value={pf.cantidad} onChange={(e) => actualizarPromo(idx, 'cantidad', e.target.value)}/>
                      </div>
                      <div>
                        <label className="label text-xs">Precio total</label>
                        <input className="input text-sm" type="number" placeholder="Ej: 3000"
                          value={pf.precio_total} onChange={(e) => actualizarPromo(idx, 'precio_total', e.target.value)}/>
                      </div>
                    </div>
                    {pf.cantidad && pf.precio_total && (
                      <p className="text-pan-600 text-xs px-1">
                        {pf.cantidad} u. → {formatPrecio(+pf.precio_total)} · precio/u: {formatPrecio(+pf.precio_total / +pf.cantidad)}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-pan-400 cursor-pointer">
                        <input type="checkbox" checked={pf.activa}
                          onChange={(e) => actualizarPromo(idx, 'activa', e.target.checked)}/>
                        Activa
                      </label>
                      <button onClick={() => setPromosForm(promosForm.filter((_, i) => i !== idx))}
                        className="btn-ghost btn-sm p-1.5 text-red-500 hover:text-red-400">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardar} disabled={cargando} className="btn-primary w-full btn-lg">
                {cargando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal ajuste de stock */}
      {modalAjuste && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalAjuste(null)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">Ajuste de stock</h2>
              <button onClick={() => setModalAjuste(null)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="px-3 py-2 rounded-xl bg-bg-card border border-bg-border text-sm">
                <p className="text-pan-400 font-medium">{modalAjuste.nombre}</p>
                <p className="text-pan-600">Stock actual: <span className="text-pan-300 font-bold">{modalAjuste.stock}</span></p>
              </div>
              <div>
                <label className="label">Cantidad a agregar o quitar</label>
                <input className="input" type="number" placeholder="Ej: +50 o -10"
                  value={ajusteCant} onChange={(e) => setAjusteCant(e.target.value)}/>
                <p className="text-pan-700 text-xs mt-1">Usá número positivo para sumar, negativo para restar</p>
                {ajusteCant && !isNaN(parseFloat(ajusteCant)) && (
                  <p className="text-pan-500 text-xs mt-1">
                    Nuevo stock: {(modalAjuste.stock ?? 0) + parseFloat(ajusteCant)}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Motivo del ajuste *</label>
                <input className="input" placeholder="Ej: conteo físico, diferencia de horneado..."
                  value={ajusteMotivo} onChange={(e) => setAjusteMotivo(e.target.value)}/>
              </div>
              <div className="px-3 py-2 rounded-xl bg-amber-900/10 border border-amber-800/30 text-xs text-amber-600">
                Este ajuste queda registrado en el historial de movimientos como tipo AJUSTE, separado de ventas y horneado.
              </div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={aplicarAjuste} disabled={cargando || !ajusteMotivo.trim()} className="btn-primary w-full btn-lg disabled:opacity-40">
                {cargando ? 'Guardando...' : 'Aplicar ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
