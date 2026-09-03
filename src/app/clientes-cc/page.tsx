'use client';
export const dynamic = 'force-dynamic';
// Cuenta corriente de clientes: saldo, historial de ventas CC y pagos
import { useState, useEffect } from 'react';
import { Users, X, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatPrecio, formatFecha, genId } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function ClientesCCPage() {
  const supabase = createClient();
  const { usuario } = useSesion();
  const [clientes,   setClientes]   = useState<any[]>([]);
  const [ventasPorCl, setVentas]    = useState<Record<string, any[]>>({});
  const [expandido,  setExpandido]  = useState<string | null>(null);
  const [modalPago,  setModalPago]  = useState<any | null>(null);
  const [montoPago,  setMontoPago]  = useState('');
  const [notaPago,   setNotaPago]   = useState('');
  const [cargando,   setCargando]   = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [{ data: cls }, { data: ventas }] = await Promise.all([
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('ventas').select('id, numero, total, fecha, medio_pago, anulada, cliente_id')
        .eq('medio_pago', 'CUENTA_CORRIENTE').eq('anulada', false).order('fecha', { ascending: false }),
    ]);

    if (cls)    setClientes(cls);
    if (ventas) {
      const porCl: Record<string, any[]> = {};
      for (const v of ventas) {
        if (!v.cliente_id) continue;
        if (!porCl[v.cliente_id]) porCl[v.cliente_id] = [];
        porCl[v.cliente_id].push(v);
      }
      setVentas(porCl);
    }
  }

  async function registrarPago() {
    if (!modalPago || !usuario || !montoPago) return;
    const monto = parseFloat(montoPago.replace(',', '.'));
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return; }
    setCargando(true);

    // Reducir saldo_cc del cliente
    const nuevoSaldo = Math.max(0, (modalPago.saldo_cc ?? 0) - monto);
    const { error } = await supabase.from('clientes').update({ saldo_cc: nuevoSaldo }).eq('id', modalPago.id);
    if (error) { toast.error('Error al registrar pago'); setCargando(false); return; }

    // Registrar en auditoría
    await supabase.from('auditoria').insert({
      usuario_id:    usuario.id,
      accion:        'PAGO_CC_CLIENTE',
      tabla:         'clientes',
      registro_id:   modalPago.id,
      datos_despues: { monto, nota: notaPago, cliente: modalPago.nombre, saldo_anterior: modalPago.saldo_cc, saldo_nuevo: nuevoSaldo, fecha: Date.now() },
    });

    toast.success(`Pago de ${formatPrecio(monto)} registrado. Saldo: ${formatPrecio(nuevoSaldo)}`);
    setModalPago(null); setMontoPago(''); setNotaPago('');
    cargar();
    setCargando(false);
  }

  const conDeuda = clientes.filter((c) => (c.saldo_cc ?? 0) > 0);
  const sinDeuda = clientes.filter((c) => (c.saldo_cc ?? 0) <= 0);
  const totalDeuda = clientes.reduce((a, c) => a + (c.saldo_cc ?? 0), 0);

  function FilaCliente({ c }: { c: any }) {
    const ventas = ventasPorCl[c.id] ?? [];
    const abierto = expandido === c.id;
    return (
      <div className="card-sm space-y-2">
        <button className="w-full text-left" onClick={() => setExpandido(abierto ? null : c.id)}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-pan-200 font-medium">{c.nombre}</p>
              <div className="flex gap-3 text-xs mt-0.5">
                <span className="text-pan-600">{ventas.length} compra{ventas.length !== 1 ? 's' : ''} CC</span>
                {(c.saldo_cc ?? 0) > 0
                  ? <span className="text-red-400 font-medium">Debe: {formatPrecio(c.saldo_cc)}</span>
                  : <span className="text-green-400">Al día ✓</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(c.saldo_cc ?? 0) > 0 && (
                <button onClick={(e) => { e.stopPropagation(); setModalPago(c); }}
                  className="btn btn-sm bg-amber-900/40 border border-amber-700 text-amber-300">
                  Registrar pago
                </button>
              )}
              {abierto ? <ChevronUp size={16} className="text-pan-600"/> : <ChevronDown size={16} className="text-pan-600"/>}
            </div>
          </div>
        </button>

        {abierto && (
          <div className="pt-2 border-t border-bg-border space-y-2">
            <p className="text-pan-600 text-xs font-medium uppercase tracking-wide">Compras en cuenta corriente</p>
            {ventas.length === 0 ? (
              <p className="text-pan-700 text-sm">Sin compras en CC</p>
            ) : ventas.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg bg-bg-card">
                <div>
                  <span className="text-pan-300">#{v.numero}</span>
                  <span className="text-pan-600 text-xs ml-2">{formatFecha(v.fecha)}</span>
                </div>
                <span className="text-red-400 font-medium">{formatPrecio(v.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="text-pan-500"/>
        <h1 className="font-display font-bold text-xl text-pan-200">Cta. Cte. Clientes</h1>
      </div>

      {totalDeuda > 0 && (
        <div className="card border-red-800/30 bg-red-900/10">
          <p className="text-red-300 text-sm font-medium">
            Deuda total de clientes: {formatPrecio(totalDeuda)}
          </p>
          <p className="text-red-600 text-xs mt-1">{conDeuda.length} cliente{conDeuda.length !== 1 ? 's' : ''} con saldo pendiente</p>
        </div>
      )}

      {conDeuda.length > 0 && (
        <div className="space-y-3">
          <p className="text-red-400 text-sm font-medium">Con deuda</p>
          {conDeuda.map((c) => <FilaCliente key={c.id} c={c}/>)}
        </div>
      )}

      {sinDeuda.length > 0 && (
        <details>
          <summary className="text-pan-600 text-sm cursor-pointer hover:text-pan-400 py-1">
            {sinDeuda.length} cliente{sinDeuda.length !== 1 ? 's' : ''} al día
          </summary>
          <div className="space-y-2 mt-2">{sinDeuda.map((c) => <FilaCliente key={c.id} c={c}/>)}</div>
        </details>
      )}

      {clientes.length === 0 && (
        <div className="card text-center py-8 text-pan-700">
          <p className="text-sm">Sin clientes registrados</p>
        </div>
      )}

      {modalPago && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalPago(null)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">Registrar pago</h2>
              <button onClick={() => setModalPago(null)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="px-3 py-2 rounded-xl bg-amber-900/20 border border-amber-800/30">
                <p className="text-amber-300 font-medium">{modalPago.nombre}</p>
                <p className="text-amber-600 text-xs">Deuda: {formatPrecio(modalPago.saldo_cc ?? 0)}</p>
              </div>
              <div>
                <label className="label">Monto del pago</label>
                <input className="input" type="number" placeholder="0"
                  value={montoPago} onChange={(e) => setMontoPago(e.target.value)}/>
              </div>
              <div>
                <label className="label">Notas (opcional)</label>
                <input className="input" placeholder="Ej: pago parcial..."
                  value={notaPago} onChange={(e) => setNotaPago(e.target.value)}/>
              </div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={registrarPago} disabled={cargando} className="btn-primary w-full btn-lg">
                {cargando ? 'Registrando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
