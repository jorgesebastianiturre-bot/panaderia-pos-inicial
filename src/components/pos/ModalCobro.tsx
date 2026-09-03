'use client';
import { useState } from 'react';
import { X, Banknote, Smartphone, CreditCard, Blend, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCarrito, useSesion } from '@/lib/store';
import { formatPrecio, redondear50, genId, cx } from '@/lib/utils';
import { ModalFactura } from './ModalFactura';
import toast from 'react-hot-toast';
import type { MedioPago, Cliente } from '@/types';

interface Props { onCerrar: () => void; onExito: () => void; clientes: Cliente[]; }

const MEDIOS = [
  { id: 'EFECTIVO'         as MedioPago, label: 'Efectivo',       icon: <Banknote size={22}/> },
  { id: 'TRANSFERENCIA'    as MedioPago, label: 'Transferencia',  icon: <Smartphone size={22}/> },
  { id: 'CUENTA_CORRIENTE' as MedioPago, label: 'Cta. Corriente', icon: <CreditCard size={22}/> },
  { id: 'MIXTO'            as MedioPago, label: 'Mixto',          icon: <Blend size={22}/> },
];

export function ModalCobro({ onCerrar, onExito, clientes }: Props) {
  const supabase = createClient();
  const { usuario, turnoActivo } = useSesion();
  const { items, clienteId, ajuste, total, subtotal, setAjuste, setCliente, limpiar } = useCarrito();

  const [medio,       setMedio]      = useState<MedioPago>('EFECTIVO');
  const [efectivoM,   setEfM]        = useState('');
  const [transM,      setTransM]     = useState('');
  const [busCliente,  setBusCli]     = useState('');
  const [proc,        setProc]       = useState(false);
  const [creandoCli,  setCreandoCli] = useState(false);
  const [ventaFinal,  setVentaFinal] = useState<any | null>(null); // para mostrar factura

  const sub = subtotal();
  const tot = total();
  const r50 = redondear50(tot);
  const difR = r50 - tot;

  const montoEf   = parseFloat(efectivoM.replace(',', '.')) || 0;
  const montoTr   = parseFloat(transM.replace(',', '.'))    || 0;
  const sumaMixto = montoEf + montoTr;
  const mixtoOk   = Math.abs(sumaMixto - tot) < 1;

  const clienteSel = clientes.find((c) => c.id === clienteId);
  const clientesFiltrados = clientes.filter((c) => c.activo)
    .filter((c) => !busCliente || c.nombre.toLowerCase().includes(busCliente.toLowerCase()))
    .slice(0, 8);
  const sinResultados = busCliente.trim().length > 1 && clientesFiltrados.length === 0;

  async function crearClienteRapido() {
    if (!busCliente.trim()) return;
    setCreandoCli(true);
    const nuevo = {
      id: genId('cl'), nombre: busCliente.trim(),
      telefono: null, saldo_cc: 0, activo: true, creado_en: Date.now(),
    };
    const { error } = await supabase.from('clientes').insert(nuevo);
    if (error) { toast.error('Error al crear el cliente'); setCreandoCli(false); return; }
    toast.success(`Cliente "${nuevo.nombre}" creado`);
    setCliente(nuevo.id);
    setBusCli('');
    setCreandoCli(false);
  }

  async function confirmar() {
    if (!turnoActivo || !usuario) { toast.error('No hay turno activo'); return; }
    if (medio === 'CUENTA_CORRIENTE' && !clienteId) { toast.error('Seleccioná un cliente para Cta. Cte.'); return; }
    if (medio === 'MIXTO' && !mixtoOk) { toast.error(`La suma debe ser ${formatPrecio(tot)}`); return; }

    setProc(true);

    const pagos = medio === 'MIXTO'
      ? [
          ...(montoEf > 0 ? [{ medio: 'EFECTIVO'      as MedioPago, monto: montoEf }] : []),
          ...(montoTr > 0 ? [{ medio: 'TRANSFERENCIA' as MedioPago, monto: montoTr }] : []),
        ]
      : [{ medio, monto: tot }];

    const payload = {
      turno_id:   turnoActivo.id,
      usuario_id: usuario.id,
      cliente_id: clienteId ?? null,
      fecha:      Date.now(),
      subtotal:   sub,
      ajuste,
      total:      tot,
      medio_pago: medio,
      pagos,
      items: items.map((i) => ({
        producto_id:     i.producto_id,
        nombre:          i.nombre,
        cantidad:        i.cantidad,
        por_peso:        i.por_peso,
        precio_unitario: i.precio_unitario,
        subtotal:        i.subtotal,
        promo_id:        i.promo_id ?? null,
        promo_aplicada:  i.promo_aplicada ?? false,
      })),
    };

    const { data, error } = await supabase.rpc('realizar_venta', { p_venta: payload });

    if (error || !data?.ok) {
      toast.error(data?.error ?? error?.message ?? 'Error al registrar la venta');
      setProc(false);
      return;
    }

    // Mostrar factura antes de limpiar
    setVentaFinal({
      numero:     data.numero,
      fecha:      Date.now(),
      total:      tot,
      subtotal:   sub,
      ajuste,
      medio_pago: medio,
      pagos,
      items:      items.map((i) => ({
        nombre:         i.nombre,
        cantidad:       i.cantidad,
        por_peso:       i.por_peso,
        subtotal:       i.subtotal,
        promo_aplicada: i.promo_aplicada,
      })),
      cliente: clienteSel ? { nombre: clienteSel.nombre } : null,
    });

    limpiar();
    toast.success(`Venta #${data.numero} registrada ✓`);
    onExito();
    setProc(false);
  }

  // Si hay venta final, mostrar la factura
  if (ventaFinal) {
    return <ModalFactura venta={ventaFinal} onCerrar={onCerrar}/>;
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-box">
        <div className="p-4 border-b border-bg-border flex items-center justify-between">
          <h2 className="font-display font-bold text-pan-200 text-lg">Cobrar venta</h2>
          <button onClick={onCerrar} className="btn-ghost btn-sm p-2"><X size={18}/></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-center py-1">
            <p className="text-pan-600 text-sm">Total a cobrar</p>
            <p className="text-4xl font-bold text-pan-100">{formatPrecio(tot)}</p>
            {clienteSel && <p className="text-pan-500 text-sm mt-1">Cliente: {clienteSel.nombre}</p>}
          </div>

          {/* Redondeo/ajuste del total */}
          <div className="space-y-2">
            <p className="text-pan-600 text-xs">¿Cobrás un monto diferente? (redondeo)</p>
            <div className="flex gap-2 items-center">
              <input
                className="input text-sm flex-1"
                type="tel"
                placeholder={`Ej: ${formatPrecio(Math.ceil(tot / 50) * 50)}`}
                value={ajuste !== 0 ? String(tot) : ''}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0) setAjuste(v - subtotal);
                  else setAjuste(0);
                }}
              />
              {ajuste !== 0 && (
                <button onClick={() => setAjuste(0)} className="btn-secondary btn-sm px-3">
                  Quitar
                </button>
              )}
            </div>
            {ajuste !== 0 && (
              <p className={`text-xs ${ajuste > 0 ? 'text-green-400' : 'text-red-400'}`}>
                Ajuste: {ajuste > 0 ? '+' : ''}{formatPrecio(ajuste)} · Total final: {formatPrecio(tot)}
              </p>
            )}
          </div>

          {medio === 'EFECTIVO' && Math.abs(difR) > 0 && Math.abs(difR) <= 50 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-900/20 border border-amber-800/30">
              <span className="text-amber-300 text-sm">
                Redondear a {formatPrecio(r50)}
                <span className="text-amber-600 ml-1">({difR > 0 ? '+' : ''}{formatPrecio(difR)})</span>
              </span>
              <button onClick={() => setAjuste(ajuste + difR)}
                className="btn btn-sm bg-amber-900/40 border border-amber-700 text-amber-300">
                Aplicar
              </button>
            </div>
          )}

          <div>
            <p className="label mb-2">Medio de pago</p>
            <div className="grid grid-cols-2 gap-2">
              {MEDIOS.map((m) => (
                <button key={m.id} onClick={() => setMedio(m.id)}
                  className={cx('btn flex-col gap-1 py-3 h-auto border',
                    medio === m.id
                      ? 'bg-pan-500/20 border-pan-500 text-pan-300'
                      : 'bg-bg-card border-bg-border text-pan-500 hover:border-pan-600')}>
                  {m.icon}<span className="text-sm">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {(medio === 'TRANSFERENCIA' || medio === 'CUENTA_CORRIENTE') && (
            <div>
              <label className="label">Cliente {medio === 'CUENTA_CORRIENTE' ? '*' : '(opcional)'}</label>
              {clienteSel ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-card border border-pan-600/40">
                  <p className="text-pan-200 text-sm flex-1 font-medium">{clienteSel.nombre}</p>
                  {clienteSel.saldo_cc > 0 && <span className="text-red-400 text-xs">{formatPrecio(clienteSel.saldo_cc)} debe</span>}
                  <button onClick={() => { setCliente(null); setBusCli(''); }} className="text-pan-600 hover:text-red-400 text-sm ml-1">✕</button>
                </div>
              ) : (
                <div className="relative">
                  <input className="input text-sm" placeholder="Buscar o escribir nombre del cliente..."
                    value={busCliente} onChange={(e) => setBusCli(e.target.value)} autoComplete="off"/>
                  {busCliente && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-xl shadow-xl overflow-hidden">
                      {clientesFiltrados.map((c) => (
                        <button key={c.id} onClick={() => { setCliente(c.id); setBusCli(''); }}
                          className="w-full px-3 py-2.5 text-left text-sm hover:bg-bg-hover flex justify-between items-center gap-2">
                          <span className="text-pan-200">{c.nombre}</span>
                          {c.saldo_cc > 0 && <span className="text-red-400 text-xs shrink-0">{formatPrecio(c.saldo_cc)} debe</span>}
                        </button>
                      ))}
                      {sinResultados && (
                        <button onClick={crearClienteRapido} disabled={creandoCli}
                          className="w-full px-3 py-3 text-left text-sm hover:bg-bg-hover flex items-center gap-2 border-t border-bg-border text-pan-400">
                          <UserPlus size={16} className="text-pan-500 shrink-0"/>
                          {creandoCli ? 'Creando...' : <span>Crear cliente <strong className="text-pan-200">"{busCliente.trim()}"</strong></span>}
                        </button>
                      )}
                      {!sinResultados && clientesFiltrados.length > 0 && (
                        <button onClick={crearClienteRapido} disabled={creandoCli}
                          className="w-full px-3 py-2.5 text-left text-sm hover:bg-bg-hover flex items-center gap-2 border-t border-bg-border text-pan-600">
                          <UserPlus size={14} className="shrink-0"/>
                          <span className="text-xs">{creandoCli ? 'Creando...' : `+ Crear nuevo "${busCliente.trim()}"`}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {medio === 'MIXTO' && (
            <div className="space-y-3">
              <div>
                <label className="label">Efectivo</label>
                <input className="input" type="number" placeholder="0" value={efectivoM} onChange={(e) => setEfM(e.target.value)}/>
              </div>
              <div>
                <label className="label">Transferencia</label>
                <input className="input" type="number" placeholder="0" value={transM} onChange={(e) => setTransM(e.target.value)}/>
              </div>
              <div className={cx('flex justify-between text-sm px-1', mixtoOk ? 'text-green-400' : 'text-red-400')}>
                <span>Suma: {formatPrecio(sumaMixto)}</span>
                <span>{mixtoOk ? '✓ OK' : `Faltan ${formatPrecio(tot - sumaMixto)}`}</span>
              </div>
            </div>
          )}

          {medio === 'CUENTA_CORRIENTE' && !clienteId && (
            <p className="badge badge-warn w-full justify-center py-2">Seleccioná un cliente para Cta. Cte.</p>
          )}
        </div>

        <div className="p-4 border-t border-bg-border">
          <button onClick={confirmar}
            disabled={proc || (medio === 'CUENTA_CORRIENTE' && !clienteId) || (medio === 'MIXTO' && !mixtoOk)}
            className="btn-primary w-full btn-lg disabled:opacity-40">
            {proc ? 'Registrando...' : `Confirmar ${formatPrecio(tot)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
