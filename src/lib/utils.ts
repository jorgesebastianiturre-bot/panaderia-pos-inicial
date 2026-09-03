// src/lib/utils.ts — Funciones de utilidad compartidas
import type { Rol, MedioPago } from '@/types';

/** Formatea un número como precio en pesos argentinos */
export function formatPrecio(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Formatea un timestamp epoch ms a fecha y hora legible */
export function formatFecha(ts: number, incluirHora = true): string {
  const d = new Date(ts);
  const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (!incluirHora) return fecha;
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} ${hora}`;
}

/** Formatea una fecha ISO (YYYY-MM-DD) para mostrar */
export function formatFechaISO(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Calcula el precio de venta sugerido dado costo y margen % */
export function calcularPrecioSugerido(costo: number, margen: number): number {
  // Margen sobre precio venta: precio = costo / (1 - margen/100)
  // Ej: costo $120, margen 40% -> $120 / 0.60 = $200
  if (margen >= 100) return costo * 10;
  return costo / (1 - margen / 100);
}

/** Redondea al múltiplo de 50 más cercano */
export function redondear50(n: number): number {
  return Math.round(n / 50) * 50;
}

/** Color del saldo de cuenta corriente */
export function colorSaldoCC(saldo: number): string {
  if (saldo > 0) return 'text-red-400';   // debe
  if (saldo < 0) return 'text-green-400'; // a favor
  return 'text-gray-400';
}

/** Label de rol para mostrar */
export function labelRol(rol: Rol): string {
  const m: Record<Rol, string> = {
    ADMIN:    'Administrador',
    GESTOR:   'Gestor',
    VENDEDOR: 'Vendedor',
  };
  return m[rol] ?? rol;
}

/** Label de medio de pago para mostrar */
export function labelMedio(medio: MedioPago): string {
  const m: Record<MedioPago, string> = {
    EFECTIVO:         'Efectivo',
    TRANSFERENCIA:    'Transferencia',
    CUENTA_CORRIENTE: 'Cta. Cte.',
    MIXTO:            'Mixto',
  };
  return m[medio] ?? medio;
}

/** Genera un ID único estilo backup (no UUID) */
export function genId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = prefix + '_';
  for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/** Combina clases condicionales (sin librerías) */
export function cx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Días hasta una fecha de vencimiento */
export function diasParaVencer(fechaISO: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(fechaISO + 'T00:00:00');
  return Math.ceil((vence.getTime() - hoy.getTime()) / 86400000);
}
