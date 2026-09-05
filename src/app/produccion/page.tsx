'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef } from 'react';
import { Flame, Search, X, Edit2, Trash2, Download, Plus, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatPrecio, genId } from '@/lib/utils';
import toast from 'react-hot-toast';

const hoy = new Date().toISOString().split('T')[0];

interface ItemTanda {
  producto_id: string;
  nombre: string;
  cantidad: number;
  por_peso: boolean;
  precio: number;
}

export default function ProduccionPage() {
  const supabase = createClient();
  const { usuario } = useSesion();

  const [productos,   setProductos]  = useState<any[]>([]);
  const [busqueda,    setBusq]       = useState('');
  const [prodSel,     setProdSel]    = useState<any | null>(null);
  const [cantInput,   setCantInput]  = useState('');
  const [fecha,       setFecha]      = useState(hoy);
  const [notas,       setNotas]      = useState('');
  const [itemsTanda,  setItemsTanda] = useState<ItemTanda[]>([]);
  const [cargando,    setCargando]   = useState(false);
  const [historial,   setHistorial]  = useState<any[]>([]);
  const [verDetalle,  setVerDetalle] = useState<string | null>(null);
  const [filtroDesde, setFiltroDesde]= useState('');
  const [filtroHasta, setFiltroHasta]= useState('');
  const [busqHist,    setBusqHist]   = useState('');
  const [editando,    setEditando]   = useState<any | null>(null);
  const [editCant,    setEditCant]   = useState('');
  const [editFecha,   setEditFecha]  = useState('');
  const [editNotas,   setEditNotas]  = useState('');
  const refInput = useRef<HTMLInputElement>(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [{ data: prods }, { data: hist }] = await Promise.all([
      supabase.from('productos').select('id, nombre, stock, precio, tipo, por_peso')
        .eq('activo', true).order('nombre'),
      supabase.from('movimientos_stock')
        .select('id, cantidad, fecha, notas, producto_id, productos(nombre, precio, por_peso)')
        .eq('tipo', 'HORNEADO')
        .order('fecha', { ascending: false }).limit(300),
    ]);
    if (prods) setProductos(prods);
    if (hist)  setHistorial(hist);
  }

  const prodsFiltrados = busqueda && !prodSel
    ? productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 8)
    : [];

  function agregarALaTanda() {
    if (!prodSel || !cantInput) return;
    const cant = parseFloat(cantInput.replace(',', '.'));
    if (isNaN(cant) || cant <= 0) { toast.error('Cantidad inválida'); return; }
    const existe = itemsTanda.find(i => i.producto_id === prodSel.id);
    if (existe) {
      setItemsTanda(itemsTanda.map(i =>
        i.producto_id === prodSel.id ? { ...i, cantidad: i.cantidad + cant } : i
      ));
    } else {
      setItemsTanda([...itemsTanda, {
        producto_id: prodSel.id, nombre: prodSel.nombre,
        cantidad: cant, por_peso: prodSel.por_peso, precio: prodSel.precio,
      }]);
    }
    setProdSel(null); setBusq(''); setCantInput('');
  }

  async function registrarTanda() {
    if (itemsTanda.length === 0) { toast.error('Agregá al menos un producto'); return; }
    if (!usuario) { toast.error('Sesión no iniciada'); return; }
    setCargando(true);
    const fechaTs = new Date(fecha + 'T12:00:00').getTime();
    const loteId  = genId('lote');
    const { data: turnoActivo } = await supabase.from('turnos')
      .select('id').eq('estado', 'ABIERTO').limit(1).maybeSingle();

    for (const item of itemsTanda) {
      const { data: prod } = await supabase.from('productos').select('stock').eq('id', item.producto_id).maybeSingle();
      const nuevoStock = (prod?.stock ?? 0) + item.cantidad;
      await supabase.from('productos').update({ stock: nuevoStock }).eq('id', item.producto_id);
      await supabase.from('movimientos_stock').insert({
        id: genId('m'), producto_id: item.producto_id, tipo: 'HORNEADO',
        cantidad: item.cantidad, fecha: fechaTs, usuario_id: usuario.id,
        turno_id: turnoActivo?.id ?? null,
        notas: `Lote ${loteId}${notas ? ' · ' + notas : ''}`,
      });
    }
    toast.success(`✓ Tanda registrada — ${itemsTanda.length} producto${itemsTanda.length !== 1 ? 's' : ''}`);
    setItemsTanda([]); setNotas(''); setBusq(''); setProdSel(null); setCantInput('');
    cargar(); setCargando(false);
  }

  async function eliminarItem(h: any) {
    if (!confirm(`¿Eliminás ${h.cantidad} ${h.productos?.por_peso ? 'kg' : 'u.'} de ${h.productos?.nombre}?`)) return;
    const { data: prod } = await supabase.from('productos').select('stock').eq('id', h.producto_id).maybeSingle();
    if (prod) await supabase.from('productos').update({ stock: (prod.stock ?? 0) - h.cantidad }).eq('id', h.producto_id);
    await supabase.from('movimientos_stock').delete().eq('id', h.id);
    toast.success('Eliminado y stock revertido');
    cargar();
  }

  async function guardarEdicion() {
    if (!editando) return;
    const nuevaCant = parseFloat(editCant);
    if (isNaN(nuevaCant) || nuevaCant <= 0) { toast.error('Cantidad inválida'); return; }
    setCargando(true);
    const { data: prod } = await supabase.from('productos').select('stock').eq('id', editando.producto_id).maybeSingle();
    if (prod) {
      await supabase.from('productos').update({ stock: (prod.stock ?? 0) - editando.cantidad + nuevaCant }).eq('id', editando.producto_id);
    }
    await supabase.from('movimientos_stock').update({
      cantidad: nuevaCant,
      fecha: new Date(editFecha + 'T12:00:00').getTime(),
      notas: editando.notas?.match(/Lote lote_[a-z0-9]+/)?.[0]
        ? `${editando.notas.match(/Lote lote_[a-z0-9]+/)[0]}${editNotas ? ' · ' + editNotas : ''}`
        : editNotas || null,
    }).eq('id', editando.id);
    toast.success('Actualizado'); setEditando(null); cargar(); setCargando(false);
  }

  function imprimirLote(lote: any) {
    const fechaStr = new Date(lote.fecha).toLocaleDateString('es-AR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Producción</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:20px;max-width:480px;margin:0 auto}
.header{text-align:center;border-bottom:3px solid #2a5c1e;padding-bottom:10px;margin-bottom:14px}.logo{font-size:18px;font-weight:bold;color:#2a5c1e}
.fecha{font-size:12px;font-weight:bold;margin-top:4px}table{width:100%;border-collapse:collapse}
th{background:#2a5c1e;color:white;padding:6px 8px;text-align:left;font-size:11px}th.r{text-align:right}
td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px}td.r{text-align:right}
.total-row td{background:#eaf3de;font-weight:bold}.footer{text-align:center;font-size:9px;color:#aaa;margin-top:14px}
@media print{@page{margin:10mm;size:A5}}</style></head><body>
<div class="header"><div class="logo">🥖 Panadería</div><div style="font-size:11px;color:#666">Comprobante de Producción</div>
<div class="fecha">${fechaStr}</div>
${lote.items[0]?.notas?.replace(/Lote lote_[a-z0-9]+\s*·?\s*/,'') ? `<div style="font-size:10px;color:#888">${lote.items[0].notas.replace(/Lote lote_[a-z0-9]+\s*·?\s*/,'')}</div>` : ''}</div>
<table><thead><tr><th>Producto</th><th class="r">Cantidad</th><th class="r">Valor unit.</th><th class="r">Total</th></tr></thead>
<tbody>${lote.items.map((h: any) => `<tr><td>${h.productos?.nombre??''}</td><td class="r">${h.cantidad} ${h.productos?.por_peso?'kg':'u.'}</td><td class="r">${formatPrecio(h.productos?.precio??0)}</td><td class="r">${formatPrecio((h.productos?.precio??0)*h.cantidad)}</td></tr>`).join('')}
<tr class="total-row"><td colspan="2">TOTAL</td><td class="r">${lote.items.reduce((a:number,h:any)=>a+h.cantidad,0).toLocaleString('es-AR')} u./kg</td>
<td class="r">${formatPrecio(lote.items.reduce((a:number,h:any)=>a+(h.productos?.precio??0)*h.cantidad,0))}</td></tr>
</tbody></table>
<div class="footer">Panadería · Registro de producción · ${new Date().toLocaleDateString('es-AR')}</div>
</body></html>`;
    const win = window.open('','_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(()=>win.print(),400); }
  }

  // Agrupar historial por lote
  const histPorLote: Record<string, { loteId: string; fecha: number; items: any[] }> = {};
  historial.forEach(h => {
    const match = h.notas?.match(/Lote (lote_[a-z0-9]+)/);
    const loteId = match ? match[1] : `solo_${h.id}`;
    if (!histPorLote[loteId]) histPorLote[loteId] = { loteId, fecha: h.fecha, items: [] };
    histPorLote[loteId].items.push(h);
  });

  const lotesFiltrados = Object.values(histPorLote)
    .filter(lote => {
      const dia = new Date(lote.fecha).toISOString().split('T')[0];
      if (filtroDesde && dia < filtroDesde) return false;
      if (filtroHasta && dia > filtroHasta) return false;
      if (busqHist) {
        const q = busqHist.toLowerCase();
        return lote.items.some(h => h.productos?.nombre?.toLowerCase().includes(q));
      }
      return true;
    })
    .sort((a, b) => b.fecha - a.fecha);

  function fmtDia(ts: number) {
    return new Date(ts).toLocaleDateString('es-AR', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center gap-2">
        <Flame className="text-pan-500"/>
        <h1 className="font-display font-bold text-xl text-pan-200">Producción</h1>
      </div>

      {/* Formulario tanda */}
      <div className="card space-y-4">
        <h3 className="font-medium text-pan-300 text-sm">Nueva tanda de producción</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Fecha</label><input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)}/></div>
          <div><label className="label">Notas (opcional)</label><input className="input text-sm" placeholder="Ej: tanda mañana..." value={notas} onChange={e => setNotas(e.target.value)}/></div>
        </div>

        <div className="space-y-2">
          <label className="label">Agregar producto</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pan-600"/>
            <input className="input pl-8 text-sm" placeholder="Buscar producto..."
              value={busqueda} onChange={e => { setBusq(e.target.value); setProdSel(null); setCantInput(''); }}/>
            {busqueda && <button onClick={() => { setBusq(''); setProdSel(null); setCantInput(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-pan-600"><X size={14}/></button>}
          </div>

          {prodsFiltrados.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {prodsFiltrados.map(p => (
                <button key={p.id} onClick={() => { setProdSel(p); setBusq(p.nombre); setCantInput(''); setTimeout(() => refInput.current?.focus(), 80); }}
                  className="w-full text-left px-3 py-2 rounded-xl bg-bg-card border border-bg-border hover:bg-bg-hover">
                  <div className="flex justify-between text-sm">
                    <span className="text-pan-200 font-medium">{p.nombre}</span>
                    <span className={`text-xs ${(p.stock??0)<0?'text-red-400':'text-pan-500'}`}>Stock: {p.stock??0}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {prodSel && (
            <div className="space-y-2">
              <div className="px-3 py-2 rounded-xl bg-pan-500/10 border border-pan-500/20 flex justify-between items-center">
                <div>
                  <p className="text-pan-200 text-sm font-medium">{prodSel.nombre}</p>
                  <p className="text-pan-600 text-xs">Stock: {prodSel.stock ?? 0}</p>
                </div>
                <button onClick={() => { setProdSel(null); setBusq(''); }} className="btn-ghost btn-sm p-1.5 text-pan-600"><X size={14}/></button>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="label">{prodSel.por_peso ? 'Kilogramos' : 'Unidades'}</label>
                  <input ref={refInput} className="input text-xl font-bold text-center"
                    type="number" inputMode="decimal"
                    placeholder={prodSel.por_peso ? '0.000' : '0'}
                    value={cantInput} onChange={e => setCantInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && agregarALaTanda()} autoFocus/>
                </div>
                <button onClick={agregarALaTanda} disabled={!cantInput || parseFloat(cantInput) <= 0}
                  className="btn-primary btn-lg gap-1 shrink-0 disabled:opacity-40">
                  <Plus size={16}/> Agregar
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(prodSel.por_peso ? ['0.5','1','1.5','2','3','5'] : ['50','100','150','200','300','500']).map(r => (
                  <button key={r} onClick={() => { setCantInput(r); setTimeout(() => refInput.current?.focus(), 0); }}
                    className={`btn btn-sm flex-1 ${cantInput === r ? 'btn-primary' : 'btn-secondary'}`}>{r}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Items de la tanda */}
        {itemsTanda.length > 0 && (
          <div className="space-y-2">
            <p className="text-pan-600 text-xs font-medium uppercase tracking-wide">Items de esta tanda ({itemsTanda.length})</p>
            <div className="rounded-xl border border-bg-border overflow-hidden">
              {itemsTanda.map((item, i) => (
                <div key={item.producto_id} className={`flex items-center justify-between px-3 py-2.5 gap-2 ${i > 0 ? 'border-t border-bg-border' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-pan-200 text-sm font-medium truncate">{item.nombre}</p>
                    <p className="text-pan-600 text-xs">{item.cantidad} {item.por_peso ? 'kg' : 'u.'} · {formatPrecio(item.precio * item.cantidad)}</p>
                  </div>
                  <button onClick={() => setItemsTanda(itemsTanda.filter((_, j) => j !== i))}
                    className="btn-ghost btn-sm p-1.5 text-red-600 shrink-0"><X size={14}/></button>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 bg-pan-500/10 border-t border-bg-border text-sm font-bold">
                <span className="text-pan-400">Total tanda</span>
                <span className="text-pan-200">{formatPrecio(itemsTanda.reduce((a,i) => a + i.precio * i.cantidad, 0))}</span>
              </div>
            </div>
            <button onClick={registrarTanda} disabled={cargando}
              className="btn-primary w-full btn-lg gap-2 disabled:opacity-40">
              <Check size={18}/>{cargando ? 'Registrando...' : `Confirmar tanda — ${itemsTanda.length} producto${itemsTanda.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="space-y-3">
        <h3 className="font-medium text-pan-300">Historial de tandas</h3>
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-pan-600"/>
            <input className="input pl-8 text-xs" placeholder="Buscar producto..." value={busqHist} onChange={e => setBusqHist(e.target.value)}/>
          </div>
          <input className="input text-xs" style={{maxWidth:130}} type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)}/>
          <input className="input text-xs" style={{maxWidth:130}} type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)}/>
          {(filtroDesde||filtroHasta||busqHist) && <button onClick={() => { setFiltroDesde(''); setFiltroHasta(''); setBusqHist(''); }} className="btn-ghost btn-sm text-pan-600">✕</button>}
        </div>

        {lotesFiltrados.length === 0 ? (
          <p className="text-pan-700 text-sm text-center py-6">Sin registros</p>
        ) : lotesFiltrados.map(lote => {
          const abierto = verDetalle === lote.loteId;
          const notaLimpia = lote.items[0]?.notas?.replace(/Lote lote_[a-z0-9]+\s*·?\s*/,'') ?? '';
          return (
            <div key={lote.loteId} className="card-sm">
              <button className="w-full flex items-center justify-between gap-2 text-left"
                onClick={() => setVerDetalle(abierto ? null : lote.loteId)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Flame size={16} className="text-amber-400"/>
                  </div>
                  <div>
                    <p className="text-pan-200 font-medium text-sm">{fmtDia(lote.fecha)}</p>
                    <p className="text-pan-600 text-xs">
                      {lote.items.length} producto{lote.items.length !== 1 ? 's' : ''}
                      {notaLimpia && ` · ${notaLimpia}`}
                    </p>
                  </div>
                </div>
                {abierto ? <ChevronUp size={16} className="text-pan-600"/> : <ChevronDown size={16} className="text-pan-600"/>}
              </button>

              {abierto && (
                <div className="mt-3 pt-3 border-t border-bg-border space-y-2">
                  {lote.items.map(h => (
                    <div key={h.id} className="flex items-center justify-between gap-2 px-2 py-2 rounded-xl bg-bg-card border border-bg-border">
                      <div className="flex-1 min-w-0">
                        <p className="text-pan-200 text-sm font-medium truncate">{h.productos?.nombre}</p>
                        <p className="text-pan-600 text-xs">
                          <span className="text-green-400 font-bold">+{h.cantidad} {h.productos?.por_peso?'kg':'u.'}</span>
                          {' · '}{formatPrecio((h.productos?.precio??0)*h.cantidad)}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditando(h); setEditCant(String(h.cantidad)); setEditFecha(new Date(h.fecha).toISOString().split('T')[0]); setEditNotas(h.notas?.replace(/Lote lote_[a-z0-9]+\s*·?\s*/,'')??''); }}
                          className="btn-ghost btn-sm p-1.5 text-pan-600"><Edit2 size={13}/></button>
                        <button onClick={() => eliminarItem(h)} className="btn-ghost btn-sm p-1.5 text-red-600"><Trash2 size={13}/></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => imprimirLote(lote)} className="btn-secondary w-full btn-sm gap-1">
                    <Download size={13}/> Comprobante de tanda
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
              <h2 className="font-display font-bold text-pan-200">Editar registro</h2>
              <button onClick={() => setEditando(null)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="px-3 py-2 rounded-xl bg-bg-card border border-bg-border text-sm">
                <p className="text-pan-400 font-medium">{editando.productos?.nombre}</p>
                <p className="text-pan-700 text-xs">Original: {editando.cantidad} {editando.productos?.por_peso?'kg':'u.'}</p>
              </div>
              <div><label className="label">Nueva cantidad</label>
                <input className="input text-xl font-bold text-center" type="number" value={editCant} onChange={e => setEditCant(e.target.value)}/></div>
              <div><label className="label">Fecha</label>
                <input className="input" type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)}/></div>
              <div><label className="label">Notas</label>
                <input className="input text-sm" value={editNotas} onChange={e => setEditNotas(e.target.value)}/></div>
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
