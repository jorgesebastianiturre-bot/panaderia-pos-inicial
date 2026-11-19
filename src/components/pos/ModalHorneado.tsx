'use client';
import { useState } from 'react';
import { X, Flame, ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { genId } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Producto } from '@/types';

interface Props {
  productos: Producto[];   // lista de productos tipo HORNEADO
  onCerrar: () => void;
  onExito: () => void;
}

const TECLAS = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

export function ModalHorneado({ productos, onCerrar, onExito }: Props) {
  const supabase = createClient();
  const { usuario } = useSesion();

  // Paso 1: elegir producto  |  Paso 2: ingresar cantidad
  const [productoSel, setProductoSel] = useState<Producto | null>(null);
  const [valor,       setValor]       = useState('');
  const [cargando,    setCargando]    = useState(false);

  function presionar(tecla: string) {
    if (tecla === '⌫') { setValor(v => v.slice(0, -1)); return; }
    if (tecla === '.') {
      if (valor.includes('.')) return;
      setValor(v => v === '' ? '0.' : v + '.');
      return;
    }
    const partes = valor.split('.');
    if (!valor.includes('.') && partes[0].length >= 4) return;
    if (valor.includes('.') && partes[1]?.length >= 2) return;
    setValor(v => v + tecla);
  }

  async function confirmar() {
    if (!productoSel) return;
    const cant = parseFloat(valor);
    if (isNaN(cant) || cant <= 0) { toast.error('Ingresá una cantidad válida'); return; }
    if (!usuario) { toast.error('No estás autenticado'); return; }
    setCargando(true);

    const nuevoStock = (productoSel.stock ?? 0) + cant;
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('productos').update({ stock: nuevoStock }).eq('id', productoSel.id),
      supabase.from('movimientos_stock').insert({
        id: genId('m'),
        producto_id: productoSel.id,
        tipo: 'HORNEADO',
        cantidad: cant,
        fecha: Date.now(),
        usuario_id: usuario.id,
        referencia_id: null,
      }),
    ]);

    setCargando(false);
    if (e1 || e2) { toast.error('Error al registrar el horneado'); return; }

    toast.success(`✓ ${cant} u. de "${productoSel.nombre}" — Stock: ${nuevoStock}`);
    onExito();
    onCerrar();
  }

  // ── Pantalla 1: elegir producto ──────────────────────────────────────────
  if (!productoSel) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCerrar()}>
        <div className="modal-box max-w-sm">
          <div className="p-4 border-b border-bg-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-amber-400"/>
              <h2 className="font-display font-bold text-pan-200">Registrar Horneado</h2>
            </div>
            <button onClick={onCerrar} className="btn-ghost btn-sm p-2"><X size={18}/></button>
          </div>

          <div className="p-4">
            {productos.length === 0 ? (
              <p className="text-pan-500 text-sm text-center py-6">
                No hay productos de tipo Horneado configurados.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-pan-500 text-xs mb-3">Elegí el producto a hornear:</p>
                {productos.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setProductoSel(p); setValor(''); }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-bg-card border border-bg-border hover:border-pan-500/40 hover:bg-pan-500/5 transition-all text-left"
                  >
                    <div>
                      <p className="text-pan-200 font-medium">{p.nombre}</p>
                      <p className={`text-xs mt-0.5 ${(p.stock ?? 0) <= 0 ? 'text-amber-500' : 'text-pan-600'}`}>
                        Stock actual: {p.stock ?? 0}
                        {(p.stock ?? 0) <= 0 && ' ⚠ sin stock'}
                      </p>
                    </div>
                    <span className="text-pan-600 text-lg">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla 2: ingresar cantidad ────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-box max-w-xs">
        <div className="p-4 border-b border-bg-border flex items-center justify-between">
          <div>
            <button
              onClick={() => { setProductoSel(null); setValor(''); }}
              className="flex items-center gap-1 text-pan-500 hover:text-pan-300 text-sm mb-1"
            >
              <ChevronLeft size={14}/> Volver
            </button>
            <h2 className="font-display font-bold text-pan-200 text-base">{productoSel.nombre}</h2>
            <p className={`text-xs ${(productoSel.stock ?? 0) <= 0 ? 'text-amber-500' : 'text-pan-600'}`}>
              Stock actual: {productoSel.stock ?? 0}
            </p>
          </div>
          <button onClick={onCerrar} className="btn-ghost btn-sm p-2"><X size={18}/></button>
        </div>

        <div className="p-4 space-y-3">
          {/* Display cantidad */}
          <div className="px-3 py-3 rounded-xl bg-bg-card border border-bg-border text-center">
            <p className="text-pan-600 text-xs mb-1">Cantidad a hornear</p>
            <p className="text-pan-100 font-bold text-4xl font-mono min-h-[48px]">
              {valor || <span className="text-pan-700">0</span>}
            </p>
          </div>

          {/* Accesos rápidos */}
          <div className="flex gap-2 flex-wrap">
            {['50','100','150','200','300'].map(r => (
              <button key={r} onClick={() => setValor(r)}
                className={`btn btn-sm flex-1 text-sm ${valor === r ? 'btn-primary' : 'btn-secondary'}`}>
                {r}
              </button>
            ))}
          </div>

          {/* Teclado numérico */}
          <div className="grid grid-cols-3 gap-2">
            {TECLAS.map(t => (
              <button key={t} onClick={() => presionar(t)}
                className={`rounded-xl py-4 text-xl font-medium transition-all active:scale-95 ${
                  t === '⌫'
                    ? 'bg-red-900/20 text-red-400 border border-red-800/30'
                    : 'bg-bg-card text-pan-200 border border-bg-border hover:bg-bg-hover'
                }`}>
                {t}
              </button>
            ))}
          </div>

          {/* Preview del stock resultante */}
          {valor && parseFloat(valor) > 0 && (
            <div className="px-3 py-2 rounded-xl bg-pan-500/10 border border-pan-500/20 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-pan-600">Stock actual</span>
                <span>{productoSel.stock ?? 0}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-pan-400">Stock después</span>
                <span className="text-green-400">
                  {(productoSel.stock ?? 0) + parseFloat(valor)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-bg-border">
          <button
            onClick={confirmar}
            disabled={cargando || !valor || parseFloat(valor) <= 0}
            className="btn-primary w-full btn-lg gap-2 disabled:opacity-40"
          >
            <Flame size={18}/>
            {cargando ? 'Registrando...' : 'Registrar horneado'}
          </button>
        </div>
      </div>
    </div>
  );
}
