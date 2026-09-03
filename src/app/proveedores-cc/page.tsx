'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { BookOpen, Plus, X, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatPrecio, formatFecha, genId, cx } from '@/lib/utils';
import toast from 'react-hot-toast';

type MedioPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE';

export default function ProveedoresCCPage() {
  const supabase = createClient();
  const { usuario } = useSesion();
  const [proveedores,  setProveedores]  = useState<any[]>([]);
  const [comprasPorProv, setComprasPP]  = useState<Record<string, any[]>>({});
  const [pagosPorProv,   setPagosPP]    = useState<Record<string, any[]>>({});
  const [abierto,       setAbierto]     = useState<string | null>(null);
  const [modalPago,     setModalPago]   = useState<any | null>(null);
  const [montoPago,     setMontoPago]   = useState('');
  const [medioPago,     setMedioPago]   = useState<MedioPago>('EFECTIVO');
  const [notasPago,     setNotasPago]   = useState('');
  const [cargando,      setCargando]    = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data: provs } = await supabase.from('proveedores').select('*').order('nombre');
    if (!provs) return;
    setProveedores(provs);

    const [{ data: compras }, { data: pagos }] = await Promise.all([
      supabase.from('compras').select('id, fecha, total, proveedor_id, forma_pago').eq('forma_pago', 'cuenta_corriente').order('fecha', { ascending: false }),
      supabase.from('pagos_proveedor').select('*').order('fecha', { ascending: false }),
    ]);

    const cPP: Record<string, any[]> = {};
    (compras ?? []).forEach((c) => { if (!cPP[c.proveedor_id]) cPP[c.proveedor_id] = []; cPP[c.proveedor_id].push(c); });
    setComprasPP(cPP);

    const pPP: Record<string, any[]> = {};
    (pagos ?? []).forEach((p) => { if (!pPP[p.proveedor_id]) pPP[p.proveedor_id] = []; pPP[p.proveedor_id].push(p); });
    setPagosPP(pPP);
  }

  function saldoDeuda(provId: string): number {
    const totalCompras = (comprasPorProv[provId] ?? []).reduce((a, c) => a + c.total, 0);
    const totalPagos   = (pagosPorProv[provId] ?? []).reduce((a, p) => a + p.monto, 0);
    return totalCompras - totalPagos;
  }

  async function registrarPago() {
    if (!modalPago || !montoPago) { toast.error('Ingresá el monto'); return; }
    if (!usuario) return;
    const monto = parseFloat(montoPago.replace(',', '.'));
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return; }
    setCargando(true);

    const { error } = await supabase.from('pagos_proveedor').insert({
      id:           genId('pp'),
      proveedor_id: modalPago.id,
      monto,
      medio_pago:   medioPago,
      notas:        notasPago || null,
      usuario_id:   usuario.id,
      fecha:        Date.now(),
    });

    if (error) { toast.error('Error: ' + error.message); setCargando(false); return; }
    toast.success(`Pago de ${formatPrecio(monto)} registrado`);
    setModalPago(null); setMontoPago(''); setNotasPago('');
    cargar(); setCargando(false);
  }

  const labelMedio = (m: string) => ({ EFECTIVO: '💵 Efectivo', TRANSFERENCIA: '📱 Transferencia', CHEQUE: '📄 Cheque' }[m] ?? m);

  const provConDeuda = proveedores.filter((p) => (comprasPorProv[p.id] ?? []).length > 0 || (pagosPorProv[p.id] ?? []).length > 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="text-pan-500"/>
        <h1 className="font-display font-bold text-xl text-pan-200">CC Proveedores</h1>
      </div>

      {provConDeuda.length === 0 ? (
        <div className="card text-center py-10 text-pan-700">
          <p className="text-sm">Sin cuentas corrientes registradas.</p>
          <p className="text-xs mt-1">Las compras en "Cuenta Corriente" aparecen acá.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {provConDeuda.map((prov) => {
            const deuda   = saldoDeuda(prov.id);
            const abt     = abierto === prov.id;
            const compras = comprasPorProv[prov.id] ?? [];
            const pagos   = pagosPorProv[prov.id] ?? [];
            const totalCompras = compras.reduce((a, c) => a + c.total, 0);
            const totalPagos   = pagos.reduce((a, p) => a + p.monto, 0);

            return (
              <div key={prov.id} className="card-sm">
                <button className="w-full text-left" onClick={() => setAbierto(abt ? null : prov.id)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-pan-200 font-medium text-sm">{prov.nombre}</p>
                        {deuda > 0 && <span className="badge badge-bad">Debe: {formatPrecio(deuda)}</span>}
                        {deuda <= 0 && totalCompras > 0 && <span className="badge badge-ok">Saldado</span>}
                      </div>
                      <p className="text-pan-600 text-xs">
                        Compras: {formatPrecio(totalCompras)} · Pagado: {formatPrecio(totalPagos)}
                      </p>
                    </div>
                    {abt ? <ChevronUp size={16} className="text-pan-600 shrink-0"/> : <ChevronDown size={16} className="text-pan-600 shrink-0"/>}
                  </div>
                </button>

                {abt && (
                  <div className="mt-3 pt-3 border-t border-bg-border space-y-4">
                    {/* Compras CC */}
                    <div>
                      <p className="text-pan-600 text-xs font-medium uppercase tracking-wide mb-2">Compras en cuenta corriente</p>
                      {compras.length === 0 ? <p className="text-pan-700 text-xs">Sin compras</p> : (
                        <div className="space-y-1">
                          {compras.map((c) => (
                            <div key={c.id} className="flex justify-between text-sm px-2 py-1 rounded-lg bg-bg-card">
                              <span className="text-pan-500">{formatFecha(c.fecha)}</span>
                              <span className="text-pan-300 font-medium">{formatPrecio(c.total)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pagos realizados */}
                    <div>
                      <p className="text-pan-600 text-xs font-medium uppercase tracking-wide mb-2">Pagos realizados</p>
                      {pagos.length === 0 ? <p className="text-pan-700 text-xs">Sin pagos registrados</p> : (
                        <div className="space-y-1">
                          {pagos.map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-sm px-2 py-1 rounded-lg bg-green-900/10 border border-green-800/20">
                              <div>
                                <span className="text-green-300 font-medium">+{formatPrecio(p.monto)}</span>
                                <span className="text-pan-600 text-xs ml-2">{labelMedio(p.medio_pago)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-pan-600 text-xs">{formatFecha(p.fecha)}</span>
                                {p.notas && <p className="text-pan-700 text-xs">{p.notas}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Resumen saldo */}
                    <div className={cx('px-3 py-2 rounded-xl border text-sm space-y-1', deuda > 0 ? 'bg-red-900/10 border-red-800/30' : 'bg-green-900/10 border-green-800/30')}>
                      <div className="flex justify-between"><span className="text-pan-600">Total compras CC</span><span className="text-pan-300">{formatPrecio(totalCompras)}</span></div>
                      <div className="flex justify-between"><span className="text-pan-600">Total pagado</span><span className="text-green-400">{formatPrecio(totalPagos)}</span></div>
                      <div className={cx('flex justify-between font-bold border-t border-bg-border pt-1', deuda > 0 ? 'text-red-300' : 'text-green-400')}>
                        <span>Saldo deuda</span><span>{formatPrecio(deuda)}</span>
                      </div>
                    </div>

                    {deuda > 0 && (
                      <button onClick={() => { setModalPago(prov); setMontoPago(''); setNotasPago(''); setMedioPago('EFECTIVO'); }}
                        className="btn-primary w-full gap-2">
                        <CreditCard size={14}/> Registrar pago
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal pago */}
      {modalPago && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalPago(null)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">Registrar pago — {modalPago.nombre}</h2>
              <button onClick={() => setModalPago(null)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="px-3 py-2 rounded-xl bg-red-900/10 border border-red-800/30 text-sm">
                <span className="text-red-400">Deuda actual: {formatPrecio(saldoDeuda(modalPago.id))}</span>
              </div>
              <div>
                <label className="label">Monto del pago *</label>
                <input className="input text-xl font-bold" type="tel" placeholder="$ 0"
                  value={montoPago} onChange={(e) => setMontoPago(e.target.value)}/>
              </div>
              <div>
                <label className="label">Medio de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE'] as MedioPago[]).map((m) => (
                    <button key={m} onClick={() => setMedioPago(m)}
                      className={cx('btn btn-sm', medioPago === m ? 'btn-primary' : 'btn-secondary')}>
                      {m === 'EFECTIVO' ? '💵' : m === 'TRANSFERENCIA' ? '📱' : '📄'} {m === 'EFECTIVO' ? 'Efectivo' : m === 'TRANSFERENCIA' ? 'Transf.' : 'Cheque'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Notas (opcional)</label>
                <input className="input" placeholder="Ej: pago parcial, nro. cheque 12345..."
                  value={notasPago} onChange={(e) => setNotasPago(e.target.value)}/>
              </div>
              {montoPago && parseFloat(montoPago) > 0 && (
                <div className="px-3 py-2 rounded-xl bg-bg-card border border-bg-border text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-pan-600">Deuda actual</span><span className="text-red-400">{formatPrecio(saldoDeuda(modalPago.id))}</span></div>
                  <div className="flex justify-between"><span className="text-pan-600">Este pago</span><span className="text-green-400">−{formatPrecio(parseFloat(montoPago))}</span></div>
                  <div className="flex justify-between font-bold border-t border-bg-border pt-1">
                    <span className="text-pan-400">Saldo restante</span>
                    <span className={saldoDeuda(modalPago.id) - parseFloat(montoPago) > 0 ? 'text-red-300' : 'text-green-400'}>
                      {formatPrecio(Math.max(0, saldoDeuda(modalPago.id) - parseFloat(montoPago)))}
                    </span>
                  </div>
                </div>
              )}
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
