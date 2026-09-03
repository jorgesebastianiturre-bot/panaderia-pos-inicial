'use client';
import { create } from 'zustand';
import type { Usuario, Turno, ItemCarrito, Producto, Promocion } from '@/types';

// ── Sesión ──────────────────────────────────────────────────
interface SesionStore {
  usuario:     Usuario | null;
  turnoActivo: Turno   | null;
  cargando:    boolean;
  setUsuario:  (u: Usuario | null) => void;
  setTurno:    (t: Turno   | null) => void;
  setCargando: (v: boolean) => void;
}

export const useSesion = create<SesionStore>((set) => ({
  usuario:     null,
  turnoActivo: null,
  cargando:    true,
  setUsuario:  (u) => set({ usuario: u }),
  setTurno:    (t) => set({ turnoActivo: t }),
  setCargando: (v) => set({ cargando: v }),
}));

// ── Lógica de múltiples promociones ─────────────────────────
// Ejemplo: 10x$3000 y 5x$1600, precio unitario $350
// Si piden 20: 2 promos de 10 = $6000
// Si piden 15: 1 promo de 10 + 1 promo de 5 = $3000 + $1600 = $4600
// Si piden 16: 1x10 + 1x5 + 1 unitario = $3000 + $1600 + $350 = $4950
export function calcPromo(
  precio: number,
  cantidad: number,
  promos: Promocion[],
  productoId: string
): { precio_unitario: number; subtotal: number; promo_id: string | null; promo_aplicada: boolean; promos_aplicadas: string[] } {
  // Filtrar promos activas del producto, ordenadas de mayor a menor cantidad
  const promosProducto = promos
    .filter((p) => p.producto_id === productoId && p.activa && p.tipo === 'CANTIDAD_FIJA')
    .sort((a, b) => b.cantidad - a.cantidad);

  if (promosProducto.length === 0 || cantidad <= 0) {
    return {
      precio_unitario: precio,
      subtotal: +(precio * cantidad).toFixed(2),
      promo_id: null,
      promo_aplicada: false,
      promos_aplicadas: [],
    };
  }

  // Aplicar promos de mayor a menor, usando el resto para la siguiente
  let restante = cantidad;
  let subtotal  = 0;
  const promosUsadas: string[] = [];

  for (const promo of promosProducto) {
    if (restante >= promo.cantidad) {
      const veces  = Math.floor(restante / promo.cantidad);
      subtotal    += veces * promo.precio_total;
      restante    -= veces * promo.cantidad;
      promosUsadas.push(promo.id);
    }
  }

  // El resto al precio unitario
  subtotal += restante * precio;
  subtotal  = +subtotal.toFixed(2);

  const aplicada = promosUsadas.length > 0;

  return {
    precio_unitario: aplicada ? +(subtotal / cantidad).toFixed(4) : precio,
    subtotal,
    promo_id:        promosUsadas[0] ?? null,
    promo_aplicada:  aplicada,
    promos_aplicadas: promosUsadas,
  };
}

// ── Carrito ──────────────────────────────────────────────────
interface ItemCarritoExtendido extends ItemCarrito {
  promos_aplicadas?: string[];
}

interface CarritoStore {
  items:                  ItemCarritoExtendido[];
  clienteId:              string | null;
  ajuste:                 number;
  agregarItemConMonto:    (producto: Producto, kg: number, montoExacto: number) => void;
  agregarItemConCantidad: (producto: Producto, cantidad: number, promos: Promocion[]) => void;
  quitarItem:             (productoId: string) => void;
  cambiarCantidad:        (productoId: string, cantidad: number, precio: number, promos: Promocion[]) => void;
  setCliente:             (clienteId: string | null) => void;
  setAjuste:              (ajuste: number) => void;
  limpiar:                () => void;
  subtotal:               () => number;
  total:                  () => number;
}

export const useCarrito = create<CarritoStore>((set, get) => ({
  items:     [],
  clienteId: null,
  ajuste:    0,

  agregarItemConMonto: (producto, kg, montoExacto) =>
    set((s) => {
      const existe = s.items.find((i) => i.producto_id === producto.id);
      if (existe) {
        const nuevaCantidad = +(existe.cantidad + kg).toFixed(3);
        const nuevoSubtotal = existe.subtotal + montoExacto;
        return {
          items: s.items.map((i) =>
            i.producto_id === producto.id
              ? { ...i, cantidad: nuevaCantidad, subtotal: nuevoSubtotal, precio_unitario: producto.precio, promo_aplicada: false }
              : i
          ),
        };
      }
      return {
        items: [...s.items, {
          producto_id:    producto.id,
          nombre:         producto.nombre,
          cantidad:       kg,
          por_peso:       producto.por_peso,
          precio_unitario: producto.precio,
          subtotal:       montoExacto,
          promo_aplicada: false,
        }],
      };
    }),
  agregarItemConCantidad: (producto, cantidad, promos) =>
    set((s) => {
      const existe = s.items.find((i) => i.producto_id === producto.id);
      const calc   = calcPromo(producto.precio, cantidad, promos, producto.id);

      if (existe) {
        const nuevaCantidad = +(existe.cantidad + cantidad).toFixed(3);
        const calcNuevo = calcPromo(producto.precio, nuevaCantidad, promos, producto.id);
        return {
          items: s.items.map((i) =>
            i.producto_id === producto.id ? { ...i, cantidad: nuevaCantidad, ...calcNuevo } : i
          ),
        };
      }
      return {
        items: [...s.items, {
          producto_id:  producto.id,
          nombre:       producto.nombre,
          cantidad,
          por_peso:     producto.por_peso,
          ...calc,
        }],
      };
    }),

  quitarItem: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.producto_id !== id) })),

  cambiarCantidad: (id, cantidad, precio, promos) => {
    if (cantidad <= 0) { get().quitarItem(id); return; }
    set((s) => ({
      items: s.items.map((i) => {
        if (i.producto_id !== id) return i;
        const calc = calcPromo(precio, cantidad, promos, id);
        return { ...i, cantidad, ...calc };
      }),
    }));
  },

  setCliente: (id) => set({ clienteId: id }),
  setAjuste:  (a)  => set({ ajuste: a }),
  limpiar:    ()   => set({ items: [], clienteId: null, ajuste: 0 }),
  subtotal:   ()   => get().items.reduce((s, i) => s + i.subtotal, 0),
  total:      ()   => get().subtotal() + get().ajuste,
}));
