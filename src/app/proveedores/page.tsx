'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Truck, Plus, Edit2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { genId } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function ProveedoresPage() {
  const supabase = createClient();
  const { usuario } = useSesion();
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [modal,       setModal]       = useState(false);
  const [editando,    setEditando]    = useState<any | null>(null);
  const [cargando,    setCargando]    = useState(false);
  const [nombre,      setNombre]      = useState('');
  const [telefono,    setTelefono]    = useState('');
  const [email,       setEmail]       = useState('');
  const [notas,       setNotas]       = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data } = await supabase.from('proveedores').select('*').order('nombre');
    if (data) setProveedores(data);
  }

  function abrirNuevo() {
    setEditando(null); setNombre(''); setTelefono(''); setEmail(''); setNotas('');
    setModal(true);
  }

  function abrirEditar(p: any) {
    setEditando(p); setNombre(p.nombre ?? ''); setTelefono(p.telefono ?? '');
    setEmail(p.email ?? ''); setNotas(p.notas ?? '');
    setModal(true);
  }

  async function guardar() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setCargando(true);
    const datos = { nombre: nombre.trim(), telefono: telefono || null, email: email || null, notas: notas || null };
    if (editando) {
      const { error } = await supabase.from('proveedores').update(datos).eq('id', editando.id);
      if (error) { toast.error('Error: ' + error.message); setCargando(false); return; }
      toast.success('Proveedor actualizado');
    } else {
      const { error } = await supabase.from('proveedores').insert({ ...datos, id: genId('pv'), creado_en: Date.now() });
      if (error) { toast.error('Error: ' + error.message); setCargando(false); return; }
      toast.success('Proveedor creado');
    }
    setModal(false); cargar(); setCargando(false);
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="text-pan-500"/>
          <h1 className="font-display font-bold text-xl text-pan-200">Proveedores</h1>
          <span className="badge badge-info">{proveedores.length}</span>
        </div>
        <button onClick={abrirNuevo} className="btn-primary btn-sm gap-1"><Plus size={15}/> Nuevo</button>
      </div>

      <div className="space-y-2">
        {proveedores.map((p) => (
          <div key={p.id} className="card-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-pan-500/20 flex items-center justify-center text-pan-300 font-bold text-sm shrink-0">
              {p.nombre?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-pan-200 font-medium text-sm">{p.nombre}</p>
              {p.telefono && <p className="text-pan-600 text-xs">{p.telefono}</p>}
              {p.email    && <p className="text-pan-600 text-xs">{p.email}</p>}
            </div>
            <button onClick={() => abrirEditar(p)} className="btn-ghost btn-sm p-2 shrink-0"><Edit2 size={14}/></button>
          </div>
        ))}
        {proveedores.length === 0 && <p className="text-pan-700 text-sm text-center py-6">Sin proveedores</p>}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">{editando ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
              <button onClick={() => setModal(false)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className="label">Nombre *</label><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre o razón social"/></div>
              <div><label className="label">Teléfono</label><input className="input" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)}/></div>
              <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}/></div>
              <div><label className="label">Notas</label><textarea className="input min-h-[60px] resize-none" value={notas} onChange={(e) => setNotas(e.target.value)}/></div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardar} disabled={cargando} className="btn-primary w-full btn-lg">
                {cargando ? 'Guardando...' : editando ? 'Guardar' : 'Crear proveedor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
