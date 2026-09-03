'use client';
// Modal que aparece después de confirmar una venta — muestra la factura completa
import { X, Share2, Printer } from 'lucide-react';
import { formatPrecio, formatFecha, labelMedio } from '@/lib/utils';

interface Props {
  venta: {
    numero: number;
    fecha: number;
    total: number;
    subtotal: number;
    ajuste: number;
    medio_pago: string;
    pagos?: any[];
    items: any[];
    cliente?: { nombre: string } | null;
  };
  onCerrar: () => void;
}

export function ModalFactura({ venta, onCerrar }: Props) {
  function compartir() {
    const items = venta.items
      .map((i: any) => `  • ${i.nombre} x${i.por_peso ? i.cantidad.toFixed(2) + 'kg' : i.cantidad} = ${formatPrecio(i.subtotal)}`)
      .join('\n');
    const texto = [
      `🥖 *Factura #${venta.numero}*`,
      `📅 ${formatFecha(venta.fecha)}`,
      venta.cliente ? `👤 ${venta.cliente.nombre}` : '',
      '', '*Productos:*', items, '',
      `*Total: ${formatPrecio(venta.total)}*`,
      `Pago: ${labelMedio(venta.medio_pago)}`,
    ].filter(Boolean).join('\n');
    if (navigator.share) navigator.share({ text: texto }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-box max-w-sm">
        <div className="p-4 border-b border-bg-border flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-pan-200">Factura #{venta.numero}</h2>
            <p className="text-pan-600 text-xs">{formatFecha(venta.fecha)}</p>
          </div>
          <button onClick={onCerrar} className="btn-ghost btn-sm p-2"><X size={18}/></button>
        </div>

        <div className="p-4 space-y-4">
          {venta.cliente && (
            <div className="px-3 py-2 rounded-xl bg-bg-card border border-bg-border">
              <p className="text-pan-600 text-xs">Cliente</p>
              <p className="text-pan-200 font-medium">{venta.cliente.nombre}</p>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-pan-600 text-xs font-medium uppercase tracking-wide">Productos</p>
            {venta.items.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm gap-2">
                <span className="text-pan-300 flex-1 truncate">
                  {item.nombre}
                  <span className="text-pan-600 ml-1">
                    × {item.por_peso ? item.cantidad.toFixed(2) + 'kg' : item.cantidad}
                  </span>
                  {item.promo_aplicada && <span className="ml-1 text-pan-500 text-xs">🏷</span>}
                </span>
                <span className="text-pan-300 shrink-0 font-medium">{formatPrecio(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-bg-border pt-3 space-y-1 text-sm">
            {venta.ajuste !== 0 && (
              <div className="flex justify-between">
                <span className="text-pan-600">Ajuste</span>
                <span className={venta.ajuste > 0 ? 'text-green-400' : 'text-red-400'}>
                  {venta.ajuste > 0 ? '+' : ''}{formatPrecio(venta.ajuste)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base">
              <span className="text-pan-400">Total</span>
              <span className="text-pan-100">{formatPrecio(venta.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-pan-600">Pago</span>
              <span className="text-pan-300">{labelMedio(venta.medio_pago)}</span>
            </div>
            {venta.medio_pago === 'MIXTO' && (venta.pagos ?? []).map((p: any, i: number) => (
              <div key={i} className="flex justify-between pl-4 text-xs">
                <span className="text-pan-600">{labelMedio(p.medio)}</span>
                <span className="text-pan-500">{formatPrecio(p.monto)}</span>
              </div>
            ))}
          </div>

          <div className="text-center py-2">
            <p className="text-pan-700 text-xs">¡Gracias por su compra!</p>
          </div>
        </div>

        <div className="p-4 border-t border-bg-border flex gap-2">
          <button onClick={compartir} className="btn-secondary flex-1 gap-2">
            <Share2 size={16}/> Compartir
          </button>
          <button onClick={onCerrar} className="btn-primary flex-1">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
