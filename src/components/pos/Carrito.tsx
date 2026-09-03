'use client';
import { useState } from 'react';
import { Trash2, Plus, Minus, ChevronDown, ChevronUp, User, ShoppingCart } from 'lucide-react';
import { useCarrito } from '@/lib/store';
import { formatPrecio, cx } from '@/lib/utils';
import type { Cliente, Turno, Promocion, Producto } from '@/types';

interface Props {
  turno:        Turno | null;
  clientes:     Cliente[];
  promociones:  Promocion[];
  productos:    Producto[];
  onCobrar:     () => void;
  compacto?:    boolean;
  resumenTurno: { efectivo: number; transferencia: number; cc: number; total: number; pendientes: number; };
}

function CantidadEditable({ productoId, cantidad, porPeso, onCambiar }: {
  productoId: string; cantidad: number; porPeso: boolean; onCambiar: (n: number) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor,    setValor]    = useState('');
  const label = porPeso ? cantidad.toFixed(2) : String(cantidad);

  function abrir() { setValor(label); setEditando(true); }
  function confirmar() {
    const n = parseFloat(valor.replace(',', '.'));
    if (!isNaN(n) && n > 0) onCambiar(+(n.toFixed(porPeso ? 3 : 0)));
    setEditando(false);
  }

  if (editando) {
    return (
      <input type="number" autoFocus value={valor}
        step={porPeso ? '0.1' : '1'} min="0.01"
        onChange={(e) => setValor(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditando(false); }}
        className="w-16 text-center text-pan-200 font-bold text-sm bg-bg-hover border border-pan-500 rounded-lg px-1 py-1 outline-none"
      />
    );
  }
  return (
    <button onClick={abrir}
      className="min-w-[40px] text-center text-pan-200 font-bold text-sm px-2 py-1 rounded-lg hover:bg-pan-500/20 border border-transparent hover:border-pan-500/40 transition-colors"
      title="Tocá para editar">
      {label}{porPeso && <span className="text-pan-700 text-xs">kg</span>}
    </button>
  );
}

export function Carrito({ turno, clientes, promociones, productos, onCobrar, resumenTurno, compacto }: Props) {
  const { items, clienteId, ajuste, quitarItem, cambiarCantidad, setCliente, limpiar, subtotal, total } = useCarrito();
  const [verResumen, setVerResumen] = useState(false);
  const [busCliente, setBusCli]     = useState('');

  const clientesFiltrados = clientes.filter((c) => c.activo)
    .filter((c) => !busCliente || c.nombre.toLowerCase().includes(busCliente.toLowerCase())).slice(0, 6);
  const clienteSel = clientes.find((c) => c.id === clienteId);
  const tot        = total();
  const hayItems   = items.length > 0;

  function handleCambiar(productoId: string, nueva: number) {
    const prod = productos.find((p) => p.id === productoId);
    if (!prod) return;
    cambiarCantidad(productoId, nueva, prod.precio, promociones);
  }

  const paso = (porPeso: boolean) => porPeso ? 0.1 : 1;

  if (compacto) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {!hayItems ? (
            <div className="flex items-center justify-center h-full gap-2 text-pan-800">
              <ShoppingCart size={18}/><p className="text-sm">Carrito vacío — tocá un producto</p>
            </div>
          ) : items.map((item) => (
            <div key={item.producto_id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-bg-card border border-bg-border">
              <div className="flex-1 min-w-0">
                <p className="text-pan-200 text-sm truncate">{item.nombre}</p>
                {item.promo_aplicada && <span className="text-[10px] text-pan-500">🏷 Promo</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleCambiar(item.producto_id, +(item.cantidad - paso(item.por_peso)).toFixed(3))}
                  className="w-7 h-7 rounded-lg bg-bg-hover flex items-center justify-center text-pan-500 active:scale-90"><Minus size={12}/></button>
                <CantidadEditable productoId={item.producto_id} cantidad={item.cantidad} porPeso={item.por_peso}
                  onCambiar={(n) => handleCambiar(item.producto_id, n)}/>
                <button onClick={() => handleCambiar(item.producto_id, +(item.cantidad + paso(item.por_peso)).toFixed(3))}
                  className="w-7 h-7 rounded-lg bg-bg-hover flex items-center justify-center text-pan-500 active:scale-90"><Plus size={12}/></button>
              </div>
              <span className="text-pan-300 font-bold text-sm shrink-0 min-w-[60px] text-right">{formatPrecio(item.subtotal)}</span>
              <button onClick={() => quitarItem(item.producto_id)} className="text-pan-800 hover:text-red-400"><Trash2 size={13}/></button>
            </div>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-bg-border flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            {hayItems && <p className="text-pan-500 text-xs">{items.length} ítem{items.length !== 1 ? 's' : ''}</p>}
            <p className="text-pan-100 font-bold text-lg leading-none">{formatPrecio(tot)}</p>
          </div>
          {hayItems && <button onClick={limpiar} className="btn-ghost btn-sm text-red-500 p-2"><Trash2 size={16}/></button>}
          <button onClick={onCobrar} disabled={!hayItems || !turno} className="btn-primary disabled:opacity-40 px-5">
            {!turno ? 'Sin turno' : 'Cobrar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-surface w-full">
      <div className="p-3 border-b border-bg-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-pan-200">Carrito</h2>
          {hayItems && <button onClick={limpiar} className="btn-ghost btn-sm gap-1 text-red-400 hover:text-red-300"><Trash2 size={13}/> Vaciar</button>}
        </div>
        {turno && (
          <button onClick={() => setVerResumen(!verResumen)}
            className="w-full mt-2 px-3 py-2 rounded-xl bg-bg-card border border-bg-border text-left flex items-center justify-between">
            <div>
              <span className="text-xs text-pan-600">Turno {turno.tipo === 'MANIANA' ? 'Mañana' : 'Tarde'}</span>
              <span className="ml-2 text-sm font-bold text-pan-300">{formatPrecio(resumenTurno.total)}</span>
              {resumenTurno.pendientes > 0 && <span className="ml-2 badge badge-warn">{resumenTurno.pendientes} pend.</span>}
            </div>
            {verResumen ? <ChevronUp size={13} className="text-pan-700"/> : <ChevronDown size={13} className="text-pan-700"/>}
          </button>
        )}
        {verResumen && turno && (
          <div className="mt-2 p-3 rounded-xl bg-bg-card border border-bg-border space-y-1 text-sm">
            {[{label:'Efectivo',val:resumenTurno.efectivo},{label:'Transferencia',val:resumenTurno.transferencia},{label:'Cta. Cte.',val:resumenTurno.cc}].map(({label,val}) => (
              <div key={label} className="flex justify-between"><span className="text-pan-700">{label}</span><span className="text-pan-400">{formatPrecio(val)}</span></div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-b border-bg-border shrink-0">
        {clienteSel ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-card border border-pan-600/40">
            <User size={13} className="text-pan-500 shrink-0"/>
            <div className="flex-1 min-w-0">
              <p className="text-pan-200 text-sm font-medium truncate">{clienteSel.nombre}</p>
              {clienteSel.saldo_cc !== 0 && (
                <p className={cx('text-xs', clienteSel.saldo_cc > 0 ? 'text-red-400' : 'text-green-400')}>
                  CC: {formatPrecio(Math.abs(clienteSel.saldo_cc))} {clienteSel.saldo_cc > 0 ? 'debe' : 'a favor'}
                </p>
              )}
            </div>
            <button onClick={() => { setCliente(null); setBusCli(''); }} className="text-pan-700 hover:text-pan-400"><Trash2 size={13}/></button>
          </div>
        ) : (
          <div className="relative">
            <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-pan-700"/>
            <input className="input pl-9 text-sm" placeholder="Cliente (opcional)"
              value={busCliente} onChange={(e) => setBusCli(e.target.value)}/>
            {busCliente && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-xl shadow-xl overflow-hidden">
                {clientesFiltrados.map((c) => (
                  <button key={c.id} onClick={() => { setCliente(c.id); setBusCli(''); }}
                    className="w-full px-3 py-2.5 text-left text-sm hover:bg-bg-hover flex justify-between gap-2">
                    <span className="text-pan-200 truncate">{c.nombre}</span>
                    {c.saldo_cc !== 0 && <span className={cx('text-xs shrink-0', c.saldo_cc > 0 ? 'text-red-400' : 'text-green-400')}>{formatPrecio(Math.abs(c.saldo_cc))}</span>}
                  </button>
                ))}
                {clientesFiltrados.length === 0 && <p className="px-3 py-2.5 text-pan-700 text-sm">Sin resultados</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!hayItems ? (
          <div className="text-center py-10 text-pan-800"><p className="text-3xl mb-2">🧺</p><p className="text-sm">Carrito vacío</p></div>
        ) : items.map((item) => (
          <div key={item.producto_id} className="card-sm">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-pan-200 text-sm font-medium leading-tight line-clamp-2">{item.nombre}</p>
                {item.promo_aplicada && <span className="badge badge-pan text-[10px]">🏷 Promo</span>}
              </div>
              <button onClick={() => quitarItem(item.producto_id)} className="text-pan-800 hover:text-red-400 shrink-0 p-1"><Trash2 size={13}/></button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1">
                <button onClick={() => handleCambiar(item.producto_id, +(item.cantidad - paso(item.por_peso)).toFixed(3))}
                  className="w-8 h-8 rounded-lg bg-bg-hover flex items-center justify-center text-pan-500 hover:bg-pan-500/20 active:scale-90"><Minus size={13}/></button>
                <CantidadEditable productoId={item.producto_id} cantidad={item.cantidad} porPeso={item.por_peso}
                  onCambiar={(n) => handleCambiar(item.producto_id, n)}/>
                <button onClick={() => handleCambiar(item.producto_id, +(item.cantidad + paso(item.por_peso)).toFixed(3))}
                  className="w-8 h-8 rounded-lg bg-bg-hover flex items-center justify-center text-pan-500 hover:bg-pan-500/20 active:scale-90"><Plus size={13}/></button>
              </div>
              <div className="text-right">
                <p className="text-pan-300 font-bold text-sm">{formatPrecio(item.subtotal)}</p>
                {item.promo_aplicada && <p className="text-pan-700 text-xs">{formatPrecio(item.precio_unitario)}/u</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-bg-border space-y-2 shrink-0">
        {ajuste !== 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-pan-600">Ajuste</span>
            <span className={cx('font-medium', ajuste > 0 ? 'text-green-400' : 'text-red-400')}>
              {ajuste > 0 ? '+' : ''}{formatPrecio(ajuste)}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-pan-400 font-medium">Total</span>
          <span className="text-pan-100 font-bold text-2xl">{formatPrecio(tot)}</span>
        </div>
        <button onClick={onCobrar} disabled={!hayItems || !turno} className="btn-primary w-full btn-lg disabled:opacity-40">
          {!turno ? 'Sin turno activo' : hayItems ? `Cobrar ${formatPrecio(tot)}` : 'Carrito vacío'}
        </button>
      </div>
    </div>
  );
}
