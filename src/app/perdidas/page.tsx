'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, X, Search, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatFecha, formatPrecio, genId } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function PerdidasPage() {
  const supabase = createClient();
  const { usuario, turnoActivo } = useSesion();
  const [productos,  setProductos] = useState<any[]>([]);
  const [perdidas,   setPerdidas]  = useState<any[]>([]);
  const [modal,      setModal]     = useState(false);
  const [cargando,   setCargando]  = useState(false);

  // Form
  const [busqProd,    setBusqProd]  = useState('');
  const [prodSel,     setProdSel]   = useState<any | null>(null);
  const [busqAbierta, setBusqAb]    = useState(false);
  const [cantidad,    setCantidad]  = useState('');
  const [motivo,      setMotivo]    = useState('');
  const refBusq = useRef<HTMLInputElement>(null);

  // Filtros
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [{ data: prods }, { data: perds }] = await Promise.all([
      supabase.from('productos').select('id, nombre, stock, tipo').eq('activo', true).order('nombre'),
      supabase.from('perdidas').select('*, productos(nombre)').order('fecha', { ascending: false }).limit(200),
    ]);
    if (prods) setProductos(prods);
    if (perds) setPerdidas(perds);
  }

  const productosFiltrados = productos.filter((p) =>
    busqProd.trim().length > 0 && p.nombre.toLowerCase().includes(busqProd.toLowerCase())
  );

  function seleccionar(p: any) {
    setProdSel(p); setBusqProd(p.nombre); setBusqAb(false);
    setTimeout(() => document.getElementById('inp-cant-perd')?.focus(), 50);
  }

  function limpiar() { setProdSel(null); setBusqProd(''); setCantidad(''); setMotivo(''); }

  async function guardar() {
    if (!prodSel || !cantidad) { toast.error('Seleccioná producto y cantidad'); return; }
    if (!usuario) return;
    setCargando(true);

    const cant = parseFloat(cantidad.replace(',', '.'));
    if (isNaN(cant) || cant <= 0) { toast.error('Cantidad inválida'); setCargando(false); return; }

    const nuevoStock = (prodSel.stock ?? 0) - cant;

    const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
      // Descontar del stock
      supabase.from('productos').update({ stock: nuevoStock }).eq('id', prodSel.id),
      // Registrar movimiento
      supabase.from('movimientos_stock').insert({
        id: genId('m'), producto_id: prodSel.id, tipo: 'PERDIDA',
        cantidad: -cant, fecha: Date.now(), usuario_id: usuario.id,
        referencia_id: turnoActivo?.id ?? null,
      }),
      // Registrar en tabla pérdidas
      supabase.from('perdidas').insert({
        id: genId('pd'), producto_id: prodSel.id, cantidad: cant,
        motivo: motivo || null, turno_id: turnoActivo?.id ?? null,
        usuario_id: usuario.id, fecha: Date.now(),
      }),
    ]);

    if (e1 || e2 || e3) {
      toast.error('Error al registrar pérdida');
      setCargando(false); return;
    }

    toast.success(`✓ Pérdida registrada — Stock: ${nuevoStock}`);
    limpiar(); setModal(false); cargar(); setCargando(false);
  }

  // Filtrar para informe
  const filtradas = perdidas.filter((p) => {
    const fechaP = new Date(p.fecha).toISOString().split('T')[0];
    if (filtroDesde && fechaP < filtroDesde) return false;
    if (filtroHasta && fechaP > filtroHasta) return false;
    return true;
  });

  // Totales por producto
  const totales = filtradas.reduce((acc: Record<string, any>, p) => {
    const id = p.producto_id;
    if (!acc[id]) acc[id] = { nombre: p.productos?.nombre ?? id, total: 0 };
    acc[id].total += p.cantidad;
    return acc;
  }, {});

  function generarInforme() {
    const desde = filtroDesde || 'inicio';
    const hasta = filtroHasta || 'hoy';
    const lineas = [
      `INFORME DE PÉRDIDAS — ${desde} a ${hasta}`,
      `Generado: ${new Date().toLocaleString('es-AR')}`,
      `Total registros: ${filtradas.length}`,
      '',
      'DETALLE:',
      ...filtradas.map((p) =>
        `${formatFecha(p.fecha)} | ${p.productos?.nombre ?? p.producto_id} | ${p.cantidad} u. | ${p.motivo ?? 'Sin motivo'}`
      ),
      '',
      'TOTALES POR PRODUCTO:',
      ...Object.values(totales).map((t: any) => `${t.nombre}: ${t.total} u.`),
      '',
      `TOTAL GENERAL: ${filtradas.reduce((a, p) => a + p.cantidad, 0)} u.`,
    ].join('\n');

    const blob = new Blob([lineas], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `perdidas-${desde}-${hasta}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Informe descargado');
  }

  const esAdminGestor = usuario && ['ADMIN', 'GESTOR'].includes(usuario.rol);

  if (!esAdminGestor) return (
    <div className="flex-1 flex items-center justify-center p-4">
      <p className="text-pan-600 text-sm">Solo administradores y gestores.</p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trash2 className="text-red-500"/>
          <h1 className="font-display font-bold text-xl text-pan-200">Pérdidas</h1>
        </div>
        <button onClick={() => { limpiar(); setModal(true); }} className="btn-primary btn-sm gap-1">
          <Plus size={15}/> Registrar pérdida
        </button>
      </div>

      <div className="card border-pan-700/30 bg-pan-500/5 text-xs text-pan-600 space-y-1">
        <p className="text-pan-400 font-medium">🗑 Pérdidas de producción</p>
        <p>Registrá lo que sobró, se dañó o se tiró al final del turno. <strong className="text-pan-500">Descuenta del stock</strong> automáticamente.</p>
      </div>

      {/* Filtros e informe */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-pan-300 text-sm">Informe</h3>
          <button onClick={generarInforme} className="btn-secondary btn-sm gap-1">
            <FileText size={13}/> Descargar
          </button>
        </div>
        <div className="flex gap-2">
          <div className="flex-1"><label className="label text-xs">Desde</label><input className="input text-sm" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}/></div>
          <div className="flex-1"><label className="label text-xs">Hasta</label><input className="input text-sm" type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}/></div>
        </div>
        {Object.values(totales).length > 0 && (
          <div className="space-y-1 pt-2 border-t border-bg-border">
            <p className="text-pan-600 text-xs font-medium">Total por producto</p>
            {Object.values(totales).sort((a: any, b: any) => b.total - a.total).map((t: any) => (
              <div key={t.nombre} className="flex justify-between text-sm">
                <span className="text-pan-400 truncate flex-1 pr-2">{t.nombre}</span>
                <span className="text-red-400 font-medium">−{t.total} u.</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold border-t border-bg-border pt-1">
              <span className="text-pan-400">Total pérdidas</span>
              <span className="text-red-400">{filtradas.reduce((a, p) => a + p.cantidad, 0)} u.</span>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtradas.length === 0 ? (
          <p className="text-pan-700 text-sm text-center py-6">Sin pérdidas registradas</p>
        ) : filtradas.map((p) => (
          <div key={p.id} className="card-sm flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-pan-200 font-medium text-sm truncate">{p.productos?.nombre ?? p.producto_id}</p>
              <p className="text-pan-600 text-xs">{formatFecha(p.fecha)}{p.motivo && ` · ${p.motivo}`}</p>
            </div>
            <span className="text-red-400 font-bold shrink-0">−{p.cantidad} u.</span>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">Registrar pérdida</h2>
              <button onClick={() => setModal(false)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="label">Producto *</label>
                {prodSel ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-card border border-pan-600/40">
                    <p className="text-pan-200 text-sm flex-1 font-medium">{prodSel.nombre}</p>
                    <span className="text-pan-600 text-xs">Stock: {prodSel.stock}</span>
                    <button onClick={limpiar} className="text-pan-600 hover:text-red-400 text-sm">✕</button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-pan-600 pointer-events-none"/>
                    <input ref={refBusq} className="input pl-9 text-sm" autoFocus
                      placeholder="Buscar producto..." value={busqProd} autoComplete="off"
                      onChange={(e) => { setBusqProd(e.target.value); setBusqAb(true); }}
                      onFocus={() => setBusqAb(true)}/>
                    {busqProd && <button onClick={limpiar} className="absolute right-3 top-1/2 -translate-y-1/2 text-pan-600"><X size={13}/></button>}
                    {busqAbierta && busqProd.trim() && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {productosFiltrados.length > 0 ? productosFiltrados.map((p) => (
                          <button key={p.id} onMouseDown={() => seleccionar(p)}
                            className="w-full px-3 py-2.5 text-left text-sm hover:bg-bg-hover flex justify-between gap-2">
                            <span className="text-pan-200 truncate">{p.nombre}</span>
                            <span className="text-pan-600 text-xs shrink-0">Stock: {p.stock}</span>
                          </button>
                        )) : <p className="px-3 py-3 text-pan-700 text-sm text-center">No se encontraron productos</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Cantidad perdida *</label>
                <input id="inp-cant-perd" className="input" type="number" placeholder="0"
                  value={cantidad} onChange={(e) => setCantidad(e.target.value)}/>
                {prodSel && cantidad && (
                  <p className="text-xs text-pan-600 mt-1">
                    Stock actual: {prodSel.stock} → después: <span className={parseFloat(cantidad) > prodSel.stock ? 'text-red-400' : 'text-pan-400'}>{prodSel.stock - parseFloat(cantidad||'0')}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="label">Motivo (opcional)</label>
                <input className="input" placeholder="Ej: sobraron del turno, se dañaron..."
                  value={motivo} onChange={(e) => setMotivo(e.target.value)}/>
              </div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardar} disabled={cargando} className="btn-primary w-full btn-lg">
                {cargando ? 'Guardando...' : 'Registrar pérdida'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
