'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, X, Calendar, Edit2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { genId } from '@/lib/utils';
import toast from 'react-hot-toast';

function diasParaVencer(fechaISO: string): number {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const vence = new Date(fechaISO + 'T00:00:00');
  return Math.round((vence.getTime() - hoy.getTime()) / 86400000);
}

function formatFechaISO(f: string) {
  const [y, m, d] = f.split('-');
  return `${d}/${m}/${y}`;
}

export default function VencimientosPage() {
  const supabase = createClient();
  const { usuario } = useSesion();
  const [items,     setItems]    = useState<any[]>([]);
  const [productos, setProds]    = useState<any[]>([]);
  const [modal,     setModal]    = useState(false);
  const [editando,  setEditando] = useState<any | null>(null);
  const [cargando,  setCargando] = useState(false);
  const [prodId,    setProdId]   = useState('');
  const [fecha,     setFecha]    = useState('');
  const [cantIni,   setCantIni]  = useState('');
  const [cantRest,  setCantRest] = useState('');
  const [diasAv,    setDiasAv]   = useState('7');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [{ data: v }, { data: p }] = await Promise.all([
      supabase.from('vencimientos').select('*, productos(nombre)').order('fecha_vencimiento'),
      supabase.from('productos').select('id, nombre').eq('activo', true).order('nombre'),
    ]);
    if (v) setItems(v);
    if (p) setProds(p);
  }

  function abrirNuevo() {
    setEditando(null); setProdId(''); setFecha(''); setCantIni(''); setCantRest(''); setDiasAv('7');
    setModal(true);
  }

  function abrirEditar(v: any) {
    setEditando(v); setProdId(v.producto_id); setFecha(v.fecha_vencimiento);
    setCantIni(String(v.cantidad_inicial)); setCantRest(String(v.cantidad_restante)); setDiasAv(String(v.dias_aviso));
    setModal(true);
  }

  async function guardar() {
    if (!prodId || !fecha || !cantIni) { toast.error('Completá todos los campos'); return; }
    setCargando(true);
    const datos = {
      producto_id: prodId, fecha_vencimiento: fecha,
      cantidad_inicial: parseFloat(cantIni), cantidad_restante: parseFloat(cantRest || cantIni),
      dias_aviso: parseInt(diasAv) || 7,
    };
    if (editando) {
      await supabase.from('vencimientos').update(datos).eq('id', editando.id);
      toast.success('Actualizado');
    } else {
      await supabase.from('vencimientos').insert({ ...datos, id: genId('vc'), creado_en: Date.now(), creado_por: usuario?.id });
      toast.success('Registrado');
    }
    setModal(false); cargar(); setCargando(false);
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminás este vencimiento?')) return;
    await supabase.from('vencimientos').delete().eq('id', id);
    cargar();
  }

  function colorDias(v: any) {
    const d = diasParaVencer(v.fecha_vencimiento);
    if (d < 0) return 'text-red-400';
    if (d <= v.dias_aviso) return 'text-amber-400';
    return 'text-green-400';
  }

  function labelDias(v: any) {
    const d = diasParaVencer(v.fecha_vencimiento);
    if (d < 0) return `Venció hace ${Math.abs(d)} día${Math.abs(d) !== 1 ? 's' : ''}`;
    if (d === 0) return '¡Vence hoy!';
    return `Vence en ${d} día${d !== 1 ? 's' : ''}`;
  }

  const puedeEditar = usuario && ['ADMIN', 'GESTOR'].includes(usuario.rol);
  const vencidos = items.filter(v => diasParaVencer(v.fecha_vencimiento) < 0);
  const urgentes = items.filter(v => { const d = diasParaVencer(v.fecha_vencimiento); return d >= 0 && d <= v.dias_aviso; });
  const resto    = items.filter(v => diasParaVencer(v.fecha_vencimiento) > v.dias_aviso);

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="text-pan-500"/>
          <h1 className="font-display font-bold text-xl text-pan-200">Vencimientos</h1>
          {(vencidos.length + urgentes.length) > 0 && <span className="badge badge-bad">{vencidos.length + urgentes.length} urgentes</span>}
        </div>
        {puedeEditar && <button onClick={abrirNuevo} className="btn-primary btn-sm gap-1"><Plus size={14}/> Agregar</button>}
      </div>

      {items.length === 0 ? (
        <div className="card text-center py-10 text-pan-700"><Calendar size={40} className="mx-auto mb-3 opacity-30"/><p className="text-sm">Sin vencimientos</p></div>
      ) : (
        <div className="space-y-4">
          {[
            { titulo: '🔴 Vencidos', lista: vencidos },
            { titulo: '🟡 Por vencer pronto', lista: urgentes },
            { titulo: '🟢 Próximos', lista: resto },
          ].map(({ titulo, lista }) => lista.length > 0 && (
            <div key={titulo} className="space-y-2">
              <p className="text-sm font-medium text-pan-400">{titulo}</p>
              {lista.map(v => (
                <div key={v.id} className="card-sm flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-pan-200 font-medium text-sm">{v.productos?.nombre}</p>
                    <p className="text-pan-600 text-xs">Vence: {formatFechaISO(v.fecha_vencimiento)} · Restante: {v.cantidad_restante}</p>
                    <p className={`text-xs font-medium mt-0.5 ${colorDias(v)}`}>{labelDias(v)}</p>
                  </div>
                  {puedeEditar && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => abrirEditar(v)} className="btn-ghost btn-sm p-1.5"><Edit2 size={13}/></button>
                      <button onClick={() => eliminar(v.id)} className="btn-ghost btn-sm p-1.5 text-red-500"><Trash2 size={13}/></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">{editando ? 'Editar' : 'Registrar vencimiento'}</h2>
              <button onClick={() => setModal(false)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className="label">Producto *</label>
                <select className="input" value={prodId} onChange={e => setProdId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div><label className="label">Fecha de vencimiento *</label><input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Cantidad inicial *</label><input className="input" type="number" value={cantIni} onChange={e => setCantIni(e.target.value)}/></div>
                <div><label className="label">Cantidad restante</label><input className="input" type="number" placeholder={cantIni} value={cantRest} onChange={e => setCantRest(e.target.value)}/></div>
              </div>
              <div><label className="label">Días de aviso</label><input className="input" type="number" value={diasAv} onChange={e => setDiasAv(e.target.value)}/></div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardar} disabled={cargando} className="btn-primary w-full btn-lg">{cargando ? 'Guardando...' : editando ? 'Guardar' : 'Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
