'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef } from 'react';
import { Flame, Search, X, Edit2, Trash2, Download, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatPrecio, genId } from '@/lib/utils';
import toast from 'react-hot-toast';

const hoy = new Date().toISOString().split('T')[0];

export default function ProduccionPage() {
  const supabase = createClient();
  const { usuario } = useSesion();

  const [productos,   setProductos]  = useState<any[]>([]);
  const [busqueda,    setBusq]       = useState('');
  const [seleccion,   setSel]        = useState<any | null>(null);
  const [cantidad,    setCantidad]   = useState('');
  const [fecha,       setFecha]      = useState(hoy);
  const [notas,       setNotas]      = useState('');
  const [cargando,    setCargando]   = useState(false);
  const [historial,   setHistorial]  = useState<any[]>([]);
  const [editando,    setEditando]   = useState<any | null>(null);
  const [editCant,    setEditCant]   = useState('');
  const [editFecha,   setEditFecha]  = useState('');
  const [editNotas,   setEditNotas]  = useState('');
  const [verDetalle,  setVerDetalle] = useState<string | null>(null);
  const [filtroDesde, setFiltroDesde]= useState('');
  const [filtroHasta, setFiltroHasta]= useState('');
  const refInput = useRef<HTMLInputElement>(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [{ data: prods }, { data: hist }] = await Promise.all([
      supabase.from('productos').select('id, nombre, stock, precio, tipo, por_peso')
        .eq('activo', true).order('nombre'),
      supabase.from('movimientos_stock')
        .select('id, cantidad, fecha, notas, producto_id, productos(nombre, precio)')
        .eq('tipo', 'HORNEADO')
        .order('fecha', { ascending: false }).limit(200),
    ]);
    if (prods) setProductos(prods);
    if (hist)  setHistorial(hist);
  }

  const prodsFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  async function registrar() {
    if (!seleccion || !cantidad) { toast.error('Seleccioná un producto y la cantidad'); return; }
    const cant = parseFloat(cantidad.replace(',', '.'));
    if (isNaN(cant) || cant <= 0) { toast.error('Cantidad inválida'); return; }
    if (!usuario) return;
    setCargando(true);

    const fechaTs = new Date(fecha + 'T12:00:00').getTime();
    const nuevoStock = (seleccion.stock ?? 0) + cant;

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('productos').update({ stock: nuevoStock }).eq('id', seleccion.id),
      supabase.from('movimientos_stock').insert({
        id: genId('m'), producto_id: seleccion.id, tipo: 'HORNEADO',
        cantidad: cant, fecha: fechaTs, usuario_id: usuario.id,
        notas: notas || `Producción registrada. Stock: ${seleccion.stock} → ${nuevoStock}`,
      }),
    ]);

    if (e1 || e2) { toast.error('Error al registrar'); setCargando(false); return; }
    toast.success(`✓ ${cant} u. de ${seleccion.nombre} → Stock: ${nuevoStock}`);
    setSel(null); setCantidad(''); setNotas(''); setBusq('');
    cargar(); setCargando(false);
  }

  function seleccionar(p: any) {
    setSel(p); setBusq(p.nombre); setCantidad('');
    setTimeout(() => refInput.current?.focus(), 80);
  }

  function limpiar() { setSel(null); setBusq(''); setCantidad(''); setNotas(''); }

  function abrirEdicion(h: any) {
    setEditando(h);
    setEditCant(String(h.cantidad));
    setEditFecha(new Date(h.fecha).toISOString().split('T')[0]);
    setEditNotas(h.notas ?? '');
  }

  async function guardarEdicion() {
    if (!editando) return;
    const nuevaCant = parseFloat(editCant);
    if (isNaN(nuevaCant) || nuevaCant <= 0) { toast.error('Cantidad inválida'); return; }
    setCargando(true);

    // Revertir cantidad anterior y aplicar nueva en el stock
    const { data: prod } = await supabase.from('productos').select('stock').eq('id', editando.producto_id).maybeSingle();
    if (prod) {
      const stockAjustado = (prod.stock ?? 0) - editando.cantidad + nuevaCant;
      await supabase.from('productos').update({ stock: stockAjustado }).eq('id', editando.producto_id);
    }

    await supabase.from('movimientos_stock').update({
      cantidad: nuevaCant,
      fecha: new Date(editFecha + 'T12:00:00').getTime(),
      notas: editNotas || null,
    }).eq('id', editando.id);

    toast.success('Producción actualizada');
    setEditando(null); cargar(); setCargando(false);
  }

  async function eliminar(h: any) {
    if (!confirm(`¿Eliminás la producción de ${h.cantidad} u. de ${h.productos?.nombre}?`)) return;
    setCargando(true);

    // Revertir en stock
    const { data: prod } = await supabase.from('productos').select('stock').eq('id', h.producto_id).maybeSingle();
    if (prod) {
      await supabase.from('productos').update({ stock: (prod.stock ?? 0) - h.cantidad }).eq('id', h.producto_id);
    }
    await supabase.from('movimientos_stock').delete().eq('id', h.id);
    toast.success('Producción eliminada y stock revertido');
    cargar(); setCargando(false);
  }

  function imprimirComprobante(h: any) {
    const fechaStr = new Date(h.fecha).toLocaleDateString('es-AR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Comprobante Producción</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:24px;max-width:400px;margin:0 auto}
  .header{text-align:center;border-bottom:3px solid #2a5c1e;padding-bottom:12px;margin-bottom:16px}
  .logo{font-size:20px;font-weight:bold;color:#2a5c1e}
  .tipo{font-size:11px;color:#666;margin-top:2px}
  .id{font-size:13px;font-weight:bold;margin-top:6px;color:#333}
  .fecha{font-size:11px;color:#888}
  .cuerpo{background:#f7f7f7;border:1px solid #ddd;border-radius:6px;padding:14px;margin-bottom:16px}
  .row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid #eee}
  .row:last-child{border:none;font-weight:bold;font-size:14px;padding-top:8px}
  .label{color:#666}
  .valor{font-weight:500;color:#222}
  .notas{font-size:11px;color:#666;font-style:italic;margin-top:8px;padding-top:8px;border-top:1px solid #eee}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px;padding-top:10px;border-top:1px solid #eee}
  @media print{@page{margin:10mm;size:A5}}
</style></head><body>
<div class="header">
  <div class="logo">🥖 Panadería</div>
  <div class="tipo">Comprobante de Producción</div>
  <div class="id">Mov. #${h.id.slice(-8).toUpperCase()}</div>
  <div class="fecha">${fechaStr}</div>
</div>
<div class="cuerpo">
  <div class="row"><span class="label">Producto</span><span class="valor">${h.productos?.nombre ?? ''}</span></div>
  <div class="row"><span class="label">Cantidad producida</span><span class="valor">${h.cantidad} u.</span></div>
  <div class="row"><span class="label">Precio unitario</span><span class="valor">${formatPrecio(h.productos?.precio ?? 0)}</span></div>
  <div class="row"><span class="label">Valor producción</span><span class="valor">${formatPrecio((h.productos?.precio ?? 0) * h.cantidad)}</span></div>
  ${h.notas ? `<div class="notas">Notas: ${h.notas}</div>` : ''}
</div>
<div class="footer">Panadería · Registro interno de producción · ${new Date().toLocaleDateString('es-AR')}</div>
</body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
  }

  const histFiltrado = historial.filter(h => {
    if (filtroDesde) { const d = new Date(h.fecha).toISOString().split('T')[0]; if (d < filtroDesde) return false; }
    if (filtroHasta) { const d = new Date(h.fecha).toISOString().split('T')[0]; if (d > filtroHasta) return false; }
    return true;
  });

  // Agrupar historial por fecha
  const histPorFecha: Record<string, any[]> = {};
  histFiltrado.forEach(h => {
    const dia = new Date(h.fecha).toISOString().split('T')[0];
    if (!histPorFecha[dia]) histPorFecha[dia] = [];
    histPorFecha[dia].push(h);
  });
  const diasOrdenados = Object.keys(histPorFecha).sort().reverse();

  const formatDia = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { weekday:'short', day:'2-digit', month:'short' });

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center gap-2">
        <Flame className="text-pan-500"/>
        <h1 className="font-display font-bold text-xl text-pan-200">Producción</h1>
      </div>

      {/* Formulario de registro */}
      <div className="card space-y-3">
        <h3 className="font-medium text-pan-300 text-sm">Registrar producción</h3>

        {/* Buscador */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pan-600"/>
          <input className="input pl-8 text-sm" placeholder="Buscar producto..."
            value={busqueda}
            onChange={e => { setBusq(e.target.value); if (seleccion && e.target.value !== seleccion.nombre) setSel(null); }}/>
          {busqueda && <button onClick={limpiar} className="absolute right-3 top-1/2 -translate-y-1/2 text-pan-600"><X size={14}/></button>}
        </div>

        {/* Lista de resultados */}
        {busqueda && !seleccion && prodsFiltrados.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {prodsFiltrados.map(p => (
              <button key={p.id} onClick={() => seleccionar(p)}
                className="w-full text-left px-3 py-2 rounded-xl bg-bg-card border border-bg-border hover:bg-bg-hover transition-colors">
                <div className="flex justify-between items-center">
                  <span className="text-pan-200 text-sm font-medium">{p.nombre}</span>
                  <span className={`text-xs font-medium ${(p.stock ?? 0) < 0 ? 'text-red-400' : 'text-pan-500'}`}>
                    Stock: {p.stock ?? 0}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Producto seleccionado */}
        {seleccion && (
          <>
            <div className="px-3 py-2 rounded-xl bg-pan-500/10 border border-pan-500/20 flex justify-between items-center">
              <div>
                <p className="text-pan-200 font-medium text-sm">{seleccion.nombre}</p>
                <p className="text-pan-600 text-xs">Stock actual: <span className={`font-bold ${(seleccion.stock ?? 0) < 0 ? 'text-red-400' : 'text-pan-400'}`}>{seleccion.stock ?? 0}</span></p>
              </div>
              <button onClick={limpiar} className="btn-ghost btn-sm p-1.5 text-pan-600"><X size={14}/></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Cantidad producida</label>
                <input ref={refInput} className="input text-xl font-bold text-center py-3"
                  type="number" inputMode="decimal" placeholder="0"
                  value={cantidad} onChange={e => setCantidad(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && registrar()} autoComplete="off"/>
              </div>
              <div>
                <label className="label">Fecha de producción</label>
                <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)}/>
              </div>
            </div>

            {/* Accesos rápidos */}
            <div className="flex gap-2 flex-wrap">
              {['50','100','150','200','300','500'].map(r => (
                <button key={r} onClick={() => { setCantidad(r); setTimeout(() => refInput.current?.focus(), 0); }}
                  className={`btn btn-sm flex-1 ${cantidad === r ? 'btn-primary' : 'btn-secondary'}`}>{r}</button>
              ))}
            </div>

            <div>
              <label className="label">Notas (opcional)</label>
              <input className="input text-sm" placeholder="Ej: producción de mañana, lote extra..."
                value={notas} onChange={e => setNotas(e.target.value)}/>
            </div>

            {cantidad && parseFloat(cantidad) > 0 && (
              <div className="px-3 py-2 rounded-xl bg-green-900/10 border border-green-800/20 text-sm flex justify-between">
                <span className="text-pan-600">Stock después de registrar</span>
                <span className="text-green-400 font-bold">{(seleccion.stock ?? 0) + parseFloat(cantidad)}</span>
              </div>
            )}

            <button onClick={registrar} disabled={cargando || !cantidad || parseFloat(cantidad) <= 0}
              className="btn-primary w-full btn-lg gap-2 disabled:opacity-40">
              <Flame size={18}/>{cargando ? 'Registrando...' : 'Registrar producción'}
            </button>
          </>
        )}
      </div>

      {/* Historial */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-medium text-pan-300">Historial de producción</h3>
          <div className="flex gap-2">
            <input className="input text-xs" style={{maxWidth:130}} type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} placeholder="Desde"/>
            <input className="input text-xs" style={{maxWidth:130}} type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} placeholder="Hasta"/>
            {(filtroDesde || filtroHasta) && <button onClick={() => { setFiltroDesde(''); setFiltroHasta(''); }} className="btn-ghost btn-sm text-pan-600">✕</button>}
          </div>
        </div>

        {diasOrdenados.length === 0 ? (
          <p className="text-pan-700 text-sm text-center py-6">Sin registros</p>
        ) : diasOrdenados.map(dia => {
          const items = histPorFecha[dia];
          const totalDia = items.reduce((a, h) => a + h.cantidad, 0);
          const abierto = verDetalle === dia;

          return (
            <div key={dia} className="card-sm">
              {/* Header del día */}
              <button className="w-full flex items-center justify-between gap-2 text-left"
                onClick={() => setVerDetalle(abierto ? null : dia)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pan-500/20 flex items-center justify-center shrink-0">
                    <Flame size={16} className="text-pan-400"/>
                  </div>
                  <div>
                    <p className="text-pan-200 font-medium text-sm">{formatDia(dia)}</p>
                    <p className="text-pan-600 text-xs">{items.length} producto{items.length !== 1 ? 's' : ''} · {totalDia.toLocaleString('es-AR')} u. totales</p>
                  </div>
                </div>
                {abierto ? <ChevronUp size={16} className="text-pan-600"/> : <ChevronDown size={16} className="text-pan-600"/>}
              </button>

              {/* Detalle del día */}
              {abierto && (
                <div className="mt-3 pt-3 border-t border-bg-border space-y-2">
                  {items.map(h => (
                    <div key={h.id} className="flex items-start justify-between gap-2 px-2 py-2 rounded-xl bg-bg-card border border-bg-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-pan-200 text-sm font-medium">{h.productos?.nombre}</p>
                        <p className="text-pan-600 text-xs">
                          <span className="text-green-400 font-bold">+{h.cantidad} u.</span>
                          {h.notas && ` · ${h.notas}`}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => imprimirComprobante(h)} className="btn-ghost btn-sm p-1.5 text-pan-600" title="Comprobante">
                          <Download size={13}/>
                        </button>
                        <button onClick={() => abrirEdicion(h)} className="btn-ghost btn-sm p-1.5 text-pan-600" title="Editar">
                          <Edit2 size={13}/>
                        </button>
                        <button onClick={() => eliminar(h)} className="btn-ghost btn-sm p-1.5 text-red-600" title="Eliminar">
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Comprobante del día completo */}
                  <button onClick={() => {
                    const fechaStr = new Date(dia + 'T12:00:00').toLocaleDateString('es-AR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
                    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Producción ${dia}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:24px;max-width:480px;margin:0 auto}
  .header{text-align:center;border-bottom:3px solid #2a5c1e;padding-bottom:12px;margin-bottom:16px}
  .logo{font-size:20px;font-weight:bold;color:#2a5c1e}
  .tipo{font-size:11px;color:#666;margin-top:2px}
  .fecha{font-size:13px;font-weight:bold;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#2a5c1e;color:white;padding:7px 8px;text-align:left;font-size:11px}
  th.r{text-align:right}
  td{padding:6px 8px;border-bottom:1px solid #eee;font-size:12px}
  td.r{text-align:right}
  tr:nth-child(even) td{background:#fafafa}
  .total-row td{background:#eaf3de;font-weight:bold;font-size:13px}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px;padding-top:10px;border-top:1px solid #eee}
  @media print{@page{margin:10mm;size:A5}}
</style></head><body>
<div class="header">
  <div class="logo">🥖 Panadería</div>
  <div class="tipo">Comprobante de Producción Diaria</div>
  <div class="fecha">${fechaStr}</div>
</div>
<table>
  <thead><tr><th>Producto</th><th class="r">Cantidad</th><th class="r">Precio unit.</th><th class="r">Valor</th></tr></thead>
  <tbody>
    ${items.map(h => `<tr><td>${h.productos?.nombre ?? ''}</td><td class="r">${h.cantidad} u.</td><td class="r">${formatPrecio(h.productos?.precio ?? 0)}</td><td class="r">${formatPrecio((h.productos?.precio ?? 0) * h.cantidad)}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="2">TOTAL PRODUCIDO</td><td class="r">${totalDia} u.</td><td class="r">${formatPrecio(items.reduce((a,h) => a + (h.productos?.precio ?? 0) * h.cantidad, 0))}</td></tr>
  </tbody>
</table>
<div class="footer">Panadería · Registro interno · ${new Date().toLocaleDateString('es-AR')}</div>
</body></html>`;
                    const win = window.open('','_blank');
                    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
                  }} className="btn-secondary w-full btn-sm gap-1 mt-1">
                    <Download size={13}/> Comprobante del día completo
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal edición */}
      {editando && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditando(null)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">Editar producción</h2>
              <button onClick={() => setEditando(null)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="px-3 py-2 rounded-xl bg-bg-card border border-bg-border text-sm">
                <p className="text-pan-400 font-medium">{editando.productos?.nombre}</p>
                <p className="text-pan-700 text-xs">Cantidad original: {editando.cantidad} u.</p>
              </div>
              <div>
                <label className="label">Nueva cantidad</label>
                <input className="input text-xl font-bold text-center" type="number"
                  value={editCant} onChange={e => setEditCant(e.target.value)}/>
              </div>
              <div>
                <label className="label">Fecha</label>
                <input className="input" type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)}/>
              </div>
              <div>
                <label className="label">Notas</label>
                <input className="input text-sm" value={editNotas} onChange={e => setEditNotas(e.target.value)}/>
              </div>
              <div className="px-3 py-2 rounded-xl bg-amber-900/10 border border-amber-800/20 text-xs text-amber-600">
                El stock se ajusta automáticamente: se revierte la cantidad anterior y se aplica la nueva.
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
    </div>
  );
}
