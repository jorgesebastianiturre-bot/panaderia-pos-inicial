'use client';
import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { formatPrecio, cx } from '@/lib/utils';
import { calcPromo } from '@/lib/store';
import type { Producto, Promocion } from '@/types';

interface Props {
  producto:    Producto;
  promociones: Promocion[];
  onConfirmar: (cantidad: number, montoExacto?: number) => void;
  onCerrar:    () => void;
}

export function ModalCantidad({ producto, promociones, onConfirmar, onCerrar }: Props) {
  const [valor, setValor] = useState('');
  const refInput = useRef<HTMLInputElement>(null);

  // Si el producto está configurado para ingresar por monto, arranca directo en ese modo
  const esPorMonto = !!(producto as any).ingreso_por_monto;

  useEffect(() => {
    setTimeout(() => refInput.current?.focus(), 80);
  }, []);

  const numValor = parseFloat(valor.replace(',', '.')) || 0;

  // Cálculo según modo del producto
  const kgCalculado = esPorMonto && producto.precio > 0 && numValor > 0
    ? numValor / producto.precio
    : null;

  const cantidadFinal = esPorMonto ? (kgCalculado ?? 0) : numValor;
  const calc          = calcPromo(producto.precio, cantidadFinal, promociones, producto.id);
  const subtotal      = esPorMonto ? numValor : calc.subtotal;
  const promoAplica   = calc.promo_aplicada && !esPorMonto;

  const RAPIDOS = producto.por_peso
    ? ['0.25', '0.5', '0.75', '1', '1.5', '2']
    : ['1', '5', '10', '12', '15', '20'];

  function confirmar() {
    if (esPorMonto) {
      if (!kgCalculado || kgCalculado <= 0) return;
      // Pasa los kg Y el monto exacto para que el carrito use el monto sin redondeo
      onConfirmar(parseFloat(kgCalculado.toFixed(3)), numValor);
    } else {
      const n = parseFloat(valor.replace(',', '.'));
      if (isNaN(n) || n <= 0) return;
      onConfirmar(n);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') confirmar();
    if (e.key === 'Escape') onCerrar();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-box max-w-xs">
        <div className="p-4 border-b border-bg-border flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-pan-200 truncate text-base">{producto.nombre}</h2>
            <p className="text-pan-600 text-xs">
              {formatPrecio(producto.precio)}{producto.por_peso ? '/kg' : ' c/u'}
              {esPorMonto && <span className="ml-2 text-pan-500">· Ingreso por monto</span>}
            </p>
          </div>
          <button onClick={onCerrar} className="btn-ghost btn-sm p-2 shrink-0"><X size={18}/></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Input principal */}
          <div>
            <label className="label">
              {esPorMonto ? 'Monto a cobrar ($)' : producto.por_peso ? 'Kilogramos' : 'Cantidad'}
            </label>
            <input
              ref={refInput}
              className="input text-center text-3xl font-bold py-4"
              type="number"
              inputMode="decimal"
              placeholder={esPorMonto ? '$ 0' : producto.por_peso ? '0.000' : '0'}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="off"
            />
          </div>

          {/* Resultado automático en modo monto */}
          {esPorMonto && numValor > 0 && kgCalculado && (
            <div className="px-3 py-3 rounded-xl bg-bg-card border border-bg-border text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-pan-600">Precio/kg</span>
                <span className="text-pan-400">{formatPrecio(producto.precio)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-pan-400">Equivale a</span>
                <span className="text-pan-200">{kgCalculado.toFixed(3)} kg · {Math.round(kgCalculado * 1000)} gr</span>
              </div>
            </div>
          )}

          {/* Accesos rápidos (solo modo kg/unidades) */}
          {!esPorMonto && (
            <div>
              <p className="text-pan-700 text-xs mb-2">Acceso rápido</p>
              <div className="flex gap-2 flex-wrap">
                {RAPIDOS.map((r) => (
                  <button key={r} onClick={() => { setValor(r); setTimeout(() => refInput.current?.focus(), 0); }}
                    className={cx('btn btn-sm flex-1 text-sm', valor === r ? 'btn-primary' : 'btn-secondary')}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Promos */}
          {!esPorMonto && promociones.filter((p) => p.producto_id === producto.id && p.activa).length > 0 && (
            <div>
              <p className="text-pan-700 text-xs mb-2">Promos</p>
              <div className="flex gap-2 flex-wrap">
                {promociones.filter((p) => p.producto_id === producto.id && p.activa).map((p) => (
                  <button key={p.id} onClick={() => { setValor(String(p.cantidad)); setTimeout(() => refInput.current?.focus(), 0); }}
                    className="btn-secondary btn-sm text-xs">
                    {p.cantidad}u → {formatPrecio(p.precio_total)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subtotal */}
          {cantidadFinal > 0 && (
            <div className="px-3 py-3 rounded-xl bg-pan-500/10 border border-pan-500/20 text-center">
              {promoAplica ? (
                <>
                  <p className="text-pan-500 text-xs">🏷 Promo aplicada</p>
                  <p className="text-pan-100 font-bold text-2xl">{formatPrecio(subtotal)}</p>
                  <p className="text-pan-600 text-xs">{formatPrecio(producto.precio * cantidadFinal)} sin promo</p>
                </>
              ) : (
                <>
                  <p className="text-pan-600 text-xs">Subtotal</p>
                  <p className="text-pan-100 font-bold text-2xl">{formatPrecio(subtotal)}</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-bg-border">
          <button onClick={confirmar}
            disabled={esPorMonto ? !kgCalculado : (!valor || numValor <= 0)}
            className="btn-primary w-full btn-lg disabled:opacity-40">
            Agregar al carrito
          </button>
        </div>
      </div>
    </div>
  );
}
