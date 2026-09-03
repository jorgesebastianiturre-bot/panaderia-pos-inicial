'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { genId } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function CategoriasPage() {
  const supabase = createClient();
  const { usuario } = useSesion();
  const [categorias, setCategorias] = useState<any[]>([]);
  const [modal,      setModal]      = useState(false);
  const [editando,   setEditando]   = useState<any | null>(null);
  const [cargando,   setCargando]   = useState(false);
  const [nombre,     setNombre]     = useState('');
  const [color,      setColor]      = useState('#f0a020');
  const [orden,      setOrden]      = useState('0');
  const [esInsumo,   setEsInsumo]   = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data } = await supabase.from('categorias').select('*').order('orden');
    if (data) setCategorias(data);
  }

  function abrirNuevo() {
    setEditando(null); setNombre(''); setColor('#f0a020'); setOrden('0'); setEsInsumo(false);
    setModal(true);
  }

  function abrirEditar(c: any) {
    setEditando(c); setNombre(c.nombre); setColor(c.color ?? '#f0a020');
    setOrden(String(c.orden ?? 0)); setEsInsumo(c.es_insumo ?? false);
    setModal(true);
  }

  async function guardar() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setCargando(true);
    const datos = { nombre: nombre.trim(), color, orden: parseInt(orden) || 0, activa: true, es_insumo: esInsumo };
    if (editando) {
      const { error } = await supabase.from('categorias').update(datos).eq('id', editando.id);
      if (error) { toast.error('Error: ' + error.message); setCargando(false); return; }
      toast.success('Categoría actualizada');
    } else {
      const { error } = await supabase.from('categorias').insert({ ...datos, id: genId('cat') });
      if (error) { toast.error('Error: ' + error.message); setCargando(false); return; }
      toast.success('Categoría creada');
    }
    setModal(false); cargar(); setCargando(false);
  }

  async function toggleActiva(c: any) {
    await supabase.from('categorias').update({ activa: !c.activa }).eq('id', c.id);
    cargar();
  }

  async function eliminar(c: any) {
    const { data: prods } = await supabase.from('productos').select('id').eq('categoria_id', c.id).limit(1);
    if (prods && prods.length > 0) { toast.error('No se puede eliminar — tiene productos'); return; }
    if (!confirm(`¿Eliminás "${c.nombre}"?`)) return;
    const { error } = await supabase.from('categorias').delete().eq('id', c.id);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('Categoría eliminada'); cargar();
  }

  if (usuario?.rol !== 'ADMIN') return (
    <div className="flex-1 flex items-center justify-center p-4"><p className="text-pan-600 text-sm">Solo administradores.</p></div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="text-pan-500"/>
          <h1 className="font-display font-bold text-xl text-pan-200">Categorías</h1>
        </div>
        <button onClick={abrirNuevo} className="btn-primary btn-sm gap-1"><Plus size={15}/> Nueva</button>
      </div>

      <div className="card border-pan-700/30 bg-pan-500/5 text-xs text-pan-600 space-y-1">
        <p className="text-pan-400 font-medium">ℹ️ Insumos</p>
        <p>Las categorías marcadas como <strong className="text-pan-500">Insumo</strong> no aparecen en el POS. Solo para compras y producción.</p>
      </div>

      <div className="space-y-2">
        {categorias.map((c) => (
          <div key={c.id} className={`card-sm flex items-center gap-3 ${!c.activa ? 'opacity-50' : ''}`}>
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color ?? '#888' }}/>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-pan-200 font-medium text-sm">{c.nombre}</p>
                {c.es_insumo && <span className="badge badge-warn text-xs">🧪 Insumo</span>}
                {!c.activa && <span className="badge badge-bad text-xs">Inactiva</span>}
              </div>
              <p className="text-pan-600 text-xs">Orden: {c.orden}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => abrirEditar(c)} className="btn-ghost btn-sm p-1.5"><Edit2 size={13}/></button>
              <button onClick={() => toggleActiva(c)} className="btn-ghost btn-sm text-xs px-2 text-pan-600 hover:text-pan-300">
                {c.activa ? 'Desactivar' : 'Activar'}
              </button>
              <button onClick={() => eliminar(c)} className="btn-ghost btn-sm p-1.5 text-red-600 hover:text-red-400"><Trash2 size={13}/></button>
            </div>
          </div>
        ))}
        {categorias.length === 0 && <p className="text-pan-700 text-sm text-center py-6">Sin categorías</p>}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">{editando ? 'Editar categoría' : 'Nueva categoría'}</h2>
              <button onClick={() => setModal(false)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Insumos, Panificación..."/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Color</label>
                  <input className="input" type="color" value={color} onChange={(e) => setColor(e.target.value)}/>
                </div>
                <div>
                  <label className="label">Orden</label>
                  <input className="input" type="number" value={orden} onChange={(e) => setOrden(e.target.value)}/>
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-bg-border bg-bg-card cursor-pointer">
                <input type="checkbox" checked={esInsumo} onChange={(e) => setEsInsumo(e.target.checked)}/>
                <div>
                  <p className="text-pan-300 text-sm font-medium">🧪 Categoría de insumos</p>
                  <p className="text-pan-600 text-xs">No aparece en el POS. Solo para compras y producción.</p>
                </div>
              </label>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardar} disabled={cargando} className="btn-primary w-full btn-lg">
                {cargando ? 'Guardando...' : editando ? 'Guardar' : 'Crear categoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
