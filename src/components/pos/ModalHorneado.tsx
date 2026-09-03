'use client';
import { useState } from 'react';
import { X, Flame } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatPrecio, genId } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Producto } from '@/types';

interface Props {
  producto: Producto;
  onCerrar: () => void;
  onHorneado: () => void;
}

const TECLAS = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

export function ModalHorneado({ producto, onCerrar, onHorneado }: Props) {
  const supabase = createClient();
  const { usuario } = useSesion();
  const [valor,    setValor]    = useState('');
  const [cargando, setCargando] = useState(false);

  function presionar(tecla: string) {
    if (tecla === '⌫') { setValor(v => v.slice(0, -1)); return; }
    if (tecla === '.') { if (valor.includes('.')) return; setValor(v => v === '' ? '0.' : v + '.'); return; }
    const partes = valor.split('.');
    if (!valor.includes('.') && partes[0].length >= 4) return;
    if (valor.includes('.') && partes[1]?.length >= 2) return;
    setValor(v => v + tecla);
  }

  async function confirmar() {
    const cant = parseFloat(valor);
    if (isNaN(cant) || cant <= 0) { toast.error('Ingresá una cantidad válida'); return; }
    if (!usuario) return;
    setCargando(true);

    const nuevoStock = (producto.stock ?? 0) + cant;
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('productos').update({ stock: nuevoStock }).eq('id', producto.id),
      supabase.from('movimientos_stock').insert({
        id: genId('m'), producto_id: producto.id, tipo: 'HORNEADO',
        cantidad: cant, fecha: Date.now(), usuario_id: usuario.id, referencia_id: null,
      }),
    ]);

    if (e1 || e2) { toast.error('Error al registrar'); setCargando(false); return; }
    toast.success(`✓ ${cant} u. horneadas — Stock: ${nuevoStock}`);
    onHorneado();
    onCerrar();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-box max-w-xs">
        <div className="p-4 border-b border-bg-border flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-pan-200 text-base">{producto.nombre}</h2>
            <p className="text-pan-600 text-xs">Stock actual: {producto.stock}</p>
          </div>
          <button onClick={onCerrar} className="btn-ghost btn-sm p-2"><X size={18}/></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="px-3 py-3 rounded-xl bg-bg-card border border-bg-border text-center">
            <p className="text-pan-600 text-xs mb-1">Cantidad a hornear</p>
            <p className="text-pan-100 font-bold text-4xl font-mono min-h-[48px]">
              {valor || <span className="text-pan-700">0</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['50','100','150','200','300'].map(r => (
              <button key={r} onClick={() => setValor(r)}
                className={`btn btn-sm flex-1 text-sm ${valor === r ? 'btn-primary' : 'btn-secondary'}`}>{r}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TECLAS.map(t => (
              <button key={t} onClick={() => presionar(t)}
                className={`rounded-xl py-4 text-xl font-medium transition-all active:scale-95 ${
                  t === '⌫' ? 'bg-red-900/20 text-red-400 border border-red-800/30'
                  : 'bg-bg-card text-pan-200 border border-bg-border hover:bg-bg-hover'
                }`}>{t}</button>
            ))}
          </div>
          {valor && parseFloat(valor) > 0 && (
            <div className="px-3 py-2 rounded-xl bg-pan-500/10 border border-pan-500/20 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-pan-600">Stock actual</span><span>{producto.stock}</span></div>
              <div className="flex justify-between font-bold"><span className="text-pan-400">Stock después</span><span className="text-green-400">{(producto.stock ?? 0) + parseFloat(valor)}</span></div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-bg-border">
          <button onClick={confirmar} disabled={cargando || !valor || parseFloat(valor) <= 0}
            className="btn-primary w-full btn-lg gap-2 disabled:opacity-40">
            <Flame size={18}/>{cargando ? 'Registrando...' : 'Registrar horneado'}
          </button>
        </div>
      </div>
    </div>
  );
}
