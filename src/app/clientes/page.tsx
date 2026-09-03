'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, X, ShoppingCart, FileText, Download, CreditCard, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { formatPrecio, genId, formatFecha } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function ClientesPage() {
  const supabase = createClient();
  const { usuario } = useSesion();

  const [clientes,     setClientes]    = useState<any[]>([]);
  const [productos,    setProductos]   = useState<any[]>([]);
  const [busqCliente,  setBusqCli]     = useState('');
  const [clienteAbierto, setClienteAb] = useState<string | null>(null);
  const [facturasPor,  setFactPor]     = useState<Record<string, any[]>>({});
  const [pagosPor,     setPagosPor]    = useState<Record<string, any[]>>({});

  // Modal cliente
  const [modal,       setModal]       = useState(false);
  const [editando,    setEditando]    = useState<any | null>(null);
  const [nombre,      setNombre]      = useState('');
  const [telefono,    setTelefono]    = useState('');
  const [email,       setEmail]       = useState('');
  const [documento,   setDocumento]   = useState('');
  const [cuit,        setCuit]        = useState('');
  const [direccion,   setDireccion]   = useState('');
  const [condIva,     setCondIva]     = useState('Consumidor Final');
  const [esMayorista, setEsMay]       = useState(false);
  const [notas,       setNotas]       = useState('');
  const [cargando,    setCargando]    = useState(false);

  // Modal facturación
  const [modalFact,   setModalFact]   = useState<any | null>(null);
  const [itemsFact,   setItemsFact]   = useState<any[]>([]);
  const [busqProd,    setBusqProd]    = useState('');
  const [prodSel,     setProdSel]     = useState<any | null>(null);
  const [cantFact,    setCantFact]    = useState('');
  const [medioPago,   setMedioPago]   = useState('EFECTIVO');
  const [ventaGuard,  setVentaGuard]  = useState<any | null>(null);
  const [fechaFact,   setFechaFact]   = useState(new Date().toISOString().split('T')[0]);
  const [editandoFact, setEditandoFact] = useState<any | null>(null);

  // Modal pago
  const [modalPago,   setModalPago]   = useState<any | null>(null);
  const [montoPago,   setMontoPago]   = useState('');
  const [medioPagoCta, setMedioPagoCta] = useState('EFECTIVO');
  const [notasPago,   setNotasPago]   = useState('');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [{ data: cl }, { data: pr }] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('productos').select('id, nombre, precio, precio_mayorista, por_peso, stock').eq('activo', true).order('nombre'),
    ]);
    if (cl) setClientes(cl);
    if (pr) setProductos(pr);
  }

  async function cargarDetalleCliente(clienteId: string) {
    const [{ data: facturas }, { data: pagos }] = await Promise.all([
      supabase.from('ventas').select('id, numero, fecha, total, medio_pago, anulada, confirmada, venta_items(nombre_snapshot, cantidad, precio_unitario, subtotal)')
        .eq('cliente_id', clienteId).order('fecha', { ascending: false }),
      supabase.from('pagos_cliente').select('*').eq('cliente_id', clienteId).order('fecha', { ascending: false }),
    ]);
    setFactPor(prev => ({ ...prev, [clienteId]: facturas ?? [] }));
    setPagosPor(prev => ({ ...prev, [clienteId]: pagos ?? [] }));
  }

  function toggleCliente(id: string) {
    if (clienteAbierto === id) { setClienteAb(null); return; }
    setClienteAb(id);
    cargarDetalleCliente(id);
  }

  // ===== FORM CLIENTE =====
  function abrirNuevo() {
    setEditando(null);
    setNombre(''); setTelefono(''); setEmail(''); setDocumento('');
    setCuit(''); setDireccion(''); setCondIva('Consumidor Final');
    setEsMay(false); setNotas('');
    setModal(true);
  }

  function abrirEditar(c: any) {
    setEditando(c);
    setNombre(c.nombre ?? ''); setTelefono(c.telefono ?? ''); setEmail(c.email ?? '');
    setDocumento(c.documento ?? ''); setCuit(c.cuit ?? ''); setDireccion(c.direccion ?? '');
    setCondIva(c.condicion_iva ?? 'Consumidor Final');
    setEsMay(!!c.es_mayorista); setNotas(c.notas ?? '');
    setModal(true);
  }

  async function guardar() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setCargando(true);
    const datos = {
      nombre: nombre.trim(), telefono: telefono || null, email: email || null,
      documento: documento || null, cuit: cuit || null, direccion: direccion || null,
      condicion_iva: condIva, es_mayorista: esMayorista, notas: notas || null,
    };
    if (editando) {
      await supabase.from('clientes').update(datos).eq('id', editando.id);
      toast.success('Cliente actualizado');
    } else {
      await supabase.from('clientes').insert({ ...datos, id: genId('cl'), saldo_cc: 0, creado_en: Date.now() });
      toast.success('Cliente creado');
    }
    setModal(false); cargar(); setCargando(false);
  }

  // ===== FACTURACIÓN =====
  function precioCliente(prod: any, cliente: any) {
    return (cliente?.es_mayorista && prod.precio_mayorista) ? prod.precio_mayorista : prod.precio;
  }

  function abrirFacturacion(cliente: any) {
    setModalFact(cliente); setEditandoFact(null);
    setItemsFact([]); setBusqProd(''); setProdSel(null); setCantFact('');
    setMedioPago('EFECTIVO'); setVentaGuard(null);
    setFechaFact(new Date().toISOString().split('T')[0]);
  }

  function abrirEdicionFactura(factura: any, cliente: any) {
    setModalFact(cliente); setEditandoFact(factura);
    setItemsFact((factura.venta_items ?? []).map((i: any) => ({
      producto_id: i.producto_id ?? '',
      nombre: i.nombre_snapshot,
      precio_unitario: i.precio_unitario,
      cantidad: i.cantidad,
      subtotal: i.subtotal,
      por_peso: false,
    })));
    setBusqProd(''); setProdSel(null); setCantFact('');
    setMedioPago(factura.medio_pago ?? 'EFECTIVO'); setVentaGuard(null);
  }

  function agregarItem() {
    if (!prodSel || !cantFact) return;
    const cant = parseFloat(cantFact.replace(',', '.'));
    if (isNaN(cant) || cant <= 0) return;
    const precio = precioCliente(prodSel, modalFact);
    const existe = itemsFact.find(i => i.nombre === prodSel.nombre);
    if (existe) {
      setItemsFact(itemsFact.map(i => i.nombre === prodSel.nombre
        ? { ...i, cantidad: i.cantidad + cant, subtotal: i.subtotal + precio * cant }
        : i));
    } else {
      setItemsFact([...itemsFact, {
        producto_id: prodSel.id, nombre: prodSel.nombre,
        precio_unitario: precio, cantidad: cant,
        subtotal: precio * cant, por_peso: prodSel.por_peso,
      }]);
    }
    setProdSel(null); setBusqProd(''); setCantFact('');
  }

  const totalFact = itemsFact.reduce((a, i) => a + i.subtotal, 0);

  async function registrarVenta() {
    if (!modalFact || itemsFact.length === 0 || !usuario) return;
    setCargando(true);

    if (editandoFact) {
      // EDITAR: revertir stock anterior y aplicar nuevo
      for (const item of (editandoFact.venta_items ?? [])) {
        const { data: p } = await supabase.from('productos').select('id, stock').eq('id', item.producto_id).maybeSingle();
        if (p) await supabase.from('productos').update({ stock: (p.stock ?? 0) + item.cantidad }).eq('id', p.id);
      }
      await supabase.from('venta_items').delete().eq('venta_id', editandoFact.id);
      await supabase.from('ventas').update({ total: totalFact, medio_pago: medioPago }).eq('id', editandoFact.id);
      await Promise.all(itemsFact.map(item =>
        supabase.from('venta_items').insert({
          id: genId('vi'), venta_id: editandoFact.id,
          producto_id: item.producto_id, nombre_snapshot: item.nombre,
          cantidad: item.cantidad, precio_unitario: item.precio_unitario, subtotal: item.subtotal,
        })
      ));
      for (const item of itemsFact) {
        const { data: p } = await supabase.from('productos').select('stock').eq('id', item.producto_id).maybeSingle();
        if (p) await supabase.from('productos').update({ stock: (p.stock ?? 0) - item.cantidad }).eq('id', item.producto_id);
      }
      toast.success('Factura actualizada');
      setModalFact(null); cargarDetalleCliente(modalFact.id);
    } else {
      // NUEVA
      const { data: ultima } = await supabase.from('ventas').select('numero').order('numero', { ascending: false }).limit(1).maybeSingle();
      const numero = (ultima?.numero ?? 0) + 1;
      const ventaId = genId('v');
      const fechaTs = new Date(fechaFact + 'T12:00:00').getTime();
      const { error: errVenta } = await supabase.from('ventas').insert({
        id: ventaId, numero, fecha: fechaTs, total: totalFact,
        medio_pago: medioPago, anulada: false,
        cliente_id: modalFact.id, usuario_id: usuario.id, turno_id: null, ajuste: 0,
      });
      if (errVenta) { toast.error('Error al guardar: ' + errVenta.message); setCargando(false); return; }
      for (const item of itemsFact) {
        await supabase.from('venta_items').insert({
          id: genId('vi'), venta_id: ventaId, producto_id: item.producto_id,
          nombre_snapshot: item.nombre, cantidad: item.cantidad,
          precio_unitario: item.precio_unitario, subtotal: item.subtotal,
        });
      }
      for (const item of itemsFact) {
        const { data: p } = await supabase.from('productos').select('stock').eq('id', item.producto_id).maybeSingle();
        if (p) await supabase.from('productos').update({ stock: (p.stock ?? 0) - item.cantidad }).eq('id', item.producto_id);
      }
      toast.success(`Factura #${numero} registrada`);
      setVentaGuard({ numero, fecha: fechaTs, items: itemsFact, total: totalFact, cliente: modalFact, medio_pago: medioPago, id: ventaId });
      cargarDetalleCliente(modalFact.id);
    }
    setCargando(false);
  }

  async function confirmarFactura(facturaId: string, clienteId: string) {
    await supabase.from('ventas').update({ confirmada: true }).eq('id', facturaId);
    toast.success('Factura confirmada y cerrada');
    cargarDetalleCliente(clienteId);
  }

  // ===== PAGOS =====
  async function registrarPago() {
    if (!modalPago || !montoPago || !usuario) return;
    const monto = parseFloat(montoPago.replace(',', '.'));
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return; }
    setCargando(true);
    await supabase.from('pagos_cliente').insert({
      id: genId('pc'), cliente_id: modalPago.id, monto,
      medio_pago: medioPagoCta, notas: notasPago || null,
      usuario_id: usuario.id, fecha: Date.now(),
    });
    toast.success(`Pago de ${formatPrecio(monto)} registrado`);
    setModalPago(null); setMontoPago(''); setNotasPago('');
    cargarDetalleCliente(modalPago.id); setCargando(false);
  }

  function calcularSaldoActual(clienteId: string): number {
    const facturas = facturasPor[clienteId] ?? [];
    const pagos = pagosPor[clienteId] ?? [];
    const totalFacturado = facturas.filter(f => !f.anulada).reduce((a, f) => a + f.total, 0);
    const totalPagado = pagos.reduce((a, p) => a + p.monto, 0);
    return totalFacturado - totalPagado;
  }

  function generarHtmlFactura(venta: any) {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Factura #${venta.numero}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 24px; max-width: 480px; margin: 0 auto; }
  .header { text-align: center; border-bottom: 3px solid #2a5c1e; padding-bottom: 14px; margin-bottom: 16px; }
  .logo { font-size: 22px; font-weight: bold; color: #2a5c1e; letter-spacing: 1px; }
  .subtitulo { font-size: 11px; color: #666; margin-top: 2px; }
  .nro-factura { font-size: 15px; font-weight: bold; margin-top: 6px; color: #333; }
  .fecha { font-size: 11px; color: #888; }
  .datos-cliente { background: #f7f7f7; border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; }
  .datos-cliente p { margin: 3px 0; font-size: 12px; }
  .datos-cliente .nombre { font-size: 14px; font-weight: bold; color: #222; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  thead tr { background: #2a5c1e; color: white; }
  th { padding: 7px 8px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.03em; }
  th.r { text-align: right; }
  td { padding: 7px 8px; font-size: 12px; border-bottom: 1px solid #eee; }
  td.r { text-align: right; }
  tr:nth-child(even) td { background: #fafafa; }
  .total-row td { background: #2a5c1e !important; color: white; font-weight: bold; font-size: 14px; padding: 9px 8px; border: none; }
  .medio-pago { font-size: 11px; color: #666; text-align: right; margin-top: 6px; }
  .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
  @media print {
    body { padding: 0; }
    @page { margin: 15mm; size: A5; }
  }
</style></head><body>
<div class="header">
  <div class="logo">🥖 Panadería</div>
  <div class="subtitulo">Comprobante de Venta</div>
  <div class="nro-factura">Factura N° ${String(venta.numero).padStart(5,'0')}</div>
  <div class="fecha">${new Date(venta.fecha).toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div>
</div>
<div class="datos-cliente">
  <p class="nombre">${venta.cliente.nombre}</p>
  ${venta.cliente.cuit?`<p><strong>CUIT:</strong> ${venta.cliente.cuit}</p>`:''}
  ${venta.cliente.documento?`<p><strong>DNI:</strong> ${venta.cliente.documento}</p>`:''}
  ${venta.cliente.direccion?`<p><strong>Dirección:</strong> ${venta.cliente.direccion}</p>`:''}
  ${venta.cliente.condicion_iva?`<p><strong>Cond. IVA:</strong> ${venta.cliente.condicion_iva}</p>`:''}
</div>
<table>
  <thead><tr><th>Descripción</th><th class="r">P. Unit.</th><th class="r">Cant.</th><th class="r">Subtotal</th></tr></thead>
  <tbody>
    ${venta.items.map((i:any,idx:number)=>`<tr><td>${i.nombre}</td><td class="r">$${i.precio_unitario.toLocaleString('es-AR')}</td><td class="r">${i.cantidad}${i.por_peso?' kg':' u.'}</td><td class="r">$${i.subtotal.toLocaleString('es-AR')}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="3" style="text-align:right">TOTAL</td><td class="r">$${venta.total.toLocaleString('es-AR')}</td></tr>
  </tbody>
</table>
<p class="medio-pago">Medio de pago: <strong>${venta.medio_pago}</strong></p>
<div class="footer">Gracias por su compra · ${new Date().toLocaleDateString('es-AR')}</div>
</body></html>`;
  }

  function descargarPDF(venta: any, clienteId?: string) {
    const saldoCC = clienteId ? calcularSaldoActual(clienteId) : undefined;
    const html = generarHtmlFactura({ ...venta, saldoCC });
    const win = window.open('','_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 500);
    }
  }

  function imprimirFactura(venta: any) {
    descargarPDF(venta);
  }

  const prodsFiltrados = productos.filter(p => p.nombre.toLowerCase().includes(busqProd.toLowerCase())).slice(0,8);
  const clientesFiltrados = clientes.filter(c => {
    if (!busqCliente.trim()) return true;
    const q = busqCliente.toLowerCase();
    return c.nombre?.toLowerCase().includes(q) || c.documento?.includes(q) || c.telefono?.includes(q);
  });

  function saldoCliente(clienteId: string) {
    const facturas = facturasPor[clienteId] ?? [];
    const pagos = pagosPor[clienteId] ?? [];
    const totalFacturado = facturas.filter(f => !f.anulada).reduce((a,f) => a + f.total, 0);
    const totalPagado = pagos.reduce((a,p) => a + p.monto, 0);
    return { totalFacturado, totalPagado, saldo: totalFacturado - totalPagado };
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="text-pan-500"/>
          <h1 className="font-display font-bold text-xl text-pan-200">Clientes</h1>
          <span className="badge badge-info">{clientes.length}</span>
        </div>
        <button onClick={abrirNuevo} className="btn-primary btn-sm gap-1"><Plus size={15}/> Nuevo</button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <input className="input pl-8 text-sm" placeholder="Buscar cliente..."
          value={busqCliente} onChange={e => setBusqCli(e.target.value)}/>
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-pan-600" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        {busqCliente && <button onClick={() => setBusqCli('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-pan-600 text-xs">✕</button>}
      </div>

      {/* Lista clientes */}
      <div className="space-y-2">
        {clientesFiltrados.map(c => {
          const abierto = clienteAbierto === c.id;
          const facturas = facturasPor[c.id] ?? [];
          const pagos = pagosPor[c.id] ?? [];
          const { totalFacturado, totalPagado, saldo } = abierto ? saldoCliente(c.id) : { totalFacturado:0, totalPagado:0, saldo:0 };

          return (
            <div key={c.id} className="card-sm">
              {/* Header cliente */}
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => toggleCliente(c.id)}>
                  <div className="w-9 h-9 rounded-full bg-pan-500/20 flex items-center justify-center text-pan-300 font-bold text-sm shrink-0">
                    {c.nombre?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-pan-200 font-medium text-sm">{c.nombre}</p>
                      {c.es_mayorista && <span className="badge badge-warn text-xs">⭐ Mayorista</span>}
                    </div>
                    {c.telefono && <p className="text-pan-600 text-xs">{c.telefono}</p>}
                  </div>
                  {abierto ? <ChevronUp size={16} className="text-pan-600 shrink-0"/> : <ChevronDown size={16} className="text-pan-600 shrink-0"/>}
                </button>
                <div className="flex gap-1 shrink-0">
                  {c.es_mayorista && (
                    <button onClick={() => abrirFacturacion(c)} className="btn btn-sm bg-pan-500/20 border border-pan-500/30 text-pan-300 gap-1 text-xs">
                      <ShoppingCart size={13}/> Facturar
                    </button>
                  )}
                  <button onClick={() => abrirEditar(c)} className="btn-ghost btn-sm p-2"><Edit2 size={14}/></button>
                </div>
              </div>

              {/* Detalle cliente abierto */}
              {abierto && (
                <div className="mt-3 pt-3 border-t border-bg-border space-y-4">

                  {/* Cuenta corriente resumen */}
                  <div className={`px-3 py-2 rounded-xl border text-sm space-y-1 ${saldo > 0 ? 'bg-red-900/10 border-red-800/30' : 'bg-green-900/10 border-green-800/30'}`}>
                    <div className="flex justify-between"><span className="text-pan-600">Total facturado</span><span className="text-pan-300">{formatPrecio(totalFacturado)}</span></div>
                    <div className="flex justify-between"><span className="text-pan-600">Total pagado</span><span className="text-green-400">{formatPrecio(totalPagado)}</span></div>
                    <div className={`flex justify-between font-bold border-t border-bg-border pt-1 ${saldo > 0 ? 'text-red-300' : 'text-green-400'}`}>
                      <span>Saldo deuda</span><span>{formatPrecio(saldo)}</span>
                    </div>
                  </div>

                  {saldo > 0 && (
                    <button onClick={() => { setModalPago(c); setMontoPago(''); setNotasPago(''); setMedioPagoCta('EFECTIVO'); }}
                      className="btn-primary w-full btn-sm gap-2">
                      <CreditCard size={14}/> Registrar pago
                    </button>
                  )}

                  {/* Historial pagos */}
                  {pagos.length > 0 && (
                    <div>
                      <p className="text-pan-600 text-xs font-medium uppercase tracking-wide mb-2">Pagos recibidos</p>
                      <div className="space-y-1">
                        {pagos.map((p: any) => (
                          <div key={p.id} className="flex justify-between text-sm px-2 py-1 rounded-lg bg-green-900/10 border border-green-800/20">
                            <div>
                              <span className="text-green-300 font-medium">{formatPrecio(p.monto)}</span>
                              <span className="text-pan-600 text-xs ml-2">{p.medio_pago}</span>
                              {p.notas && <span className="text-pan-700 text-xs ml-2">{p.notas}</span>}
                            </div>
                            <span className="text-pan-600 text-xs">{formatFecha(p.fecha)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Historial facturas */}
                  <div>
                    <p className="text-pan-600 text-xs font-medium uppercase tracking-wide mb-2">Facturas</p>
                    {facturas.length === 0 ? (
                      <p className="text-pan-700 text-xs">Sin facturas</p>
                    ) : (
                      <div className="space-y-2">
                        {facturas.map((f: any) => (
                          <div key={f.id} className={`border rounded-xl px-3 py-2 ${f.anulada ? 'opacity-50 border-bg-border' : f.confirmada ? 'border-green-800/30 bg-green-900/5' : 'border-amber-800/30 bg-amber-900/5'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-pan-500 text-xs font-mono">#{f.numero}</span>
                                  <span className="text-pan-200 font-bold">{formatPrecio(f.total)}</span>
                                  <span className={`badge text-xs ${f.anulada ? 'badge-bad' : f.confirmada ? 'badge-ok' : 'badge-warn'}`}>
                                    {f.anulada ? 'Anulada' : f.confirmada ? '✓ Confirmada' : 'Borrador'}
                                  </span>
                                </div>
                                <p className="text-pan-600 text-xs">{formatFecha(f.fecha)} · {f.medio_pago}</p>
                                {(f.venta_items ?? []).length > 0 && (
                                  <p className="text-pan-700 text-xs truncate">
                                    {f.venta_items.slice(0,3).map((i:any) => `${i.nombre_snapshot} ×${i.cantidad}`).join(' · ')}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                {!f.confirmada && !f.anulada && (
                                  <button onClick={() => abrirEdicionFactura(f, c)} className="btn-ghost btn-sm p-1.5 text-pan-600" title="Editar">
                                    <Edit2 size={13}/>
                                  </button>
                                )}
                                {!f.confirmada && !f.anulada && (
                                  <button onClick={() => confirmarFactura(f.id, c.id)} className="btn-ghost btn-sm p-1.5 text-green-500" title="Confirmar">
                                    <Check size={13}/>
                                  </button>
                                )}
                                <button onClick={() => descargarPDF({ ...f, items: f.venta_items?.map((i:any) => ({ nombre: i.nombre_snapshot, precio_unitario: i.precio_unitario, cantidad: i.cantidad, subtotal: i.subtotal, por_peso: false })) ?? [], numero: f.numero, fecha: f.fecha, medio_pago: f.medio_pago, cliente: c }, c.id)}
                                  className="btn-ghost btn-sm p-1.5 text-pan-600" title="Imprimir">
                                  <Download size={13}/>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {clientes.length === 0 && <p className="text-pan-700 text-sm text-center py-6">Sin clientes</p>}
      </div>

      {/* Modal nuevo/editar cliente */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">{editando ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button onClick={() => setModal(false)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div><label className="label">Nombre *</label><input className="input" value={nombre} onChange={e => setNombre(e.target.value)}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">DNI</label><input className="input" value={documento} onChange={e => setDocumento(e.target.value)} placeholder="12.345.678"/></div>
                <div><label className="label">CUIT</label><input className="input" value={cuit} onChange={e => setCuit(e.target.value)} placeholder="20-12345678-9"/></div>
              </div>
              <div><label className="label">Dirección</label><input className="input" value={direccion} onChange={e => setDireccion(e.target.value)}/></div>
              <div><label className="label">Teléfono</label><input className="input" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}/></div>
              <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}/></div>
              <div>
                <label className="label">Condición IVA</label>
                <select className="input" value={condIva} onChange={e => setCondIva(e.target.value)}>
                  {['Consumidor Final','Responsable Inscripto','Monotributista','Exento'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><label className="label">Notas</label><textarea className="input min-h-[60px] resize-none" value={notas} onChange={e => setNotas(e.target.value)}/></div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={esMayorista} onChange={e => setEsMay(e.target.checked)}/>
                <div>
                  <span className="text-pan-400 text-sm">⭐ Cliente mayorista</span>
                  <p className="text-pan-700 text-xs">Se le aplica el precio mayorista de cada producto</p>
                </div>
              </label>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardar} disabled={cargando} className="btn-primary w-full btn-lg">
                {cargando ? 'Guardando...' : editando ? 'Guardar' : 'Crear cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal facturación / edición */}
      {modalFact && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalFact(null)}>
          <div className="modal-box" style={{maxWidth:520}}>
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-pan-200">
                  {editandoFact ? `Editar Factura #${editandoFact.numero}` : `Facturar — ${modalFact.nombre}`}
                </h2>
                {modalFact.es_mayorista && !editandoFact && <p className="text-pan-600 text-xs">⭐ Precios mayoristas aplicados</p>}
              </div>
              <button onClick={() => setModalFact(null)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {!ventaGuard ? (
                <>
                  {/* Fecha de la factura */}
                  <div>
                    <label className="label">Fecha de la factura</label>
                    <input className="input" type="date" value={fechaFact}
                      onChange={e => setFechaFact(e.target.value)}/>
                  </div>

                  {/* Buscador producto */}
                  <div className="space-y-2">
                    <label className="label">Agregar producto</label>
                    <input className="input text-sm" placeholder="Buscar producto..."
                      value={busqProd} onChange={e => { setBusqProd(e.target.value); setProdSel(null); }}/>
                    {busqProd && !prodSel && prodsFiltrados.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {prodsFiltrados.map(p => {
                          const precio = precioCliente(p, modalFact);
                          const esMay = modalFact.es_mayorista && p.precio_mayorista;
                          return (
                            <button key={p.id} onClick={() => { setProdSel(p); setBusqProd(p.nombre); setCantFact(''); }}
                              className="w-full text-left px-3 py-2 rounded-xl bg-bg-card border border-bg-border hover:bg-bg-hover text-sm">
                              <div className="flex justify-between">
                                <span className="text-pan-200">{p.nombre}</span>
                                <div>
                                  <span className={`font-bold ${esMay ? 'text-amber-400' : 'text-pan-300'}`}>{formatPrecio(precio)}</span>
                                  {esMay && <span className="text-pan-700 text-xs ml-1 line-through">{formatPrecio(p.precio)}</span>}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {prodSel && (
                      <div className="flex gap-2">
                        <input className="input text-sm flex-1" type="number" inputMode="decimal"
                          placeholder={prodSel.por_peso ? 'kg' : 'cantidad'}
                          value={cantFact} onChange={e => setCantFact(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && agregarItem()} autoFocus/>
                        <button onClick={agregarItem} className="btn-primary btn-sm px-4">+ Agregar</button>
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  {itemsFact.length > 0 && (
                    <div>
                      <label className="label">Items</label>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-pan-700 text-xs">
                            <td className="pb-1">Producto</td><td className="pb-1 text-right">P.Unit.</td>
                            <td className="pb-1 text-right">Cant.</td><td className="pb-1 text-right">Subtotal</td><td className="pb-1 w-6"/>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsFact.map((item, i) => (
                            <tr key={i} className="border-t border-bg-border">
                              <td className="py-1.5 text-pan-300">{item.nombre}</td>
                              <td className="py-1.5 text-right text-pan-500">{formatPrecio(item.precio_unitario)}</td>
                              <td className="py-1.5 text-right text-pan-400">{item.cantidad}{item.por_peso?'kg':'u'}</td>
                              <td className="py-1.5 text-right font-medium text-pan-200">{formatPrecio(item.subtotal)}</td>
                              <td className="py-1.5 text-right">
                                <button onClick={() => setItemsFact(itemsFact.filter((_,j) => j !== i))} className="text-red-600"><X size={12}/></button>
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-bg-border font-bold">
                            <td colSpan={3} className="py-2 text-pan-300">TOTAL</td>
                            <td className="py-2 text-right text-pan-100 text-base">{formatPrecio(totalFact)}</td>
                            <td/>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {itemsFact.length > 0 && (
                    <div>
                      <label className="label">Medio de pago</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['EFECTIVO','TRANSFERENCIA','CUENTA_CORRIENTE','CHEQUE'].map(m => (
                          <button key={m} onClick={() => setMedioPago(m)}
                            className={`btn btn-sm ${medioPago === m ? 'btn-primary' : 'btn-secondary'}`}>
                            {m==='EFECTIVO'?'💵 Efectivo':m==='TRANSFERENCIA'?'📱 Transf.':m==='CUENTA_CORRIENTE'?'📋 Cta.Cte.':'📄 Cheque'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={registrarVenta} disabled={cargando || itemsFact.length === 0}
                    className="btn-primary w-full btn-lg gap-2 disabled:opacity-40">
                    <FileText size={16}/>{cargando ? 'Guardando...' : editandoFact ? 'Guardar cambios' : 'Registrar factura'}
                  </button>
                </>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="px-4 py-6 rounded-xl bg-green-900/20 border border-green-800/30">
                    <p className="text-green-400 font-bold text-lg">✓ Factura #{ventaGuard.numero} registrada</p>
                    <p className="text-pan-300 font-bold text-2xl mt-1">{formatPrecio(ventaGuard.total)}</p>
                  </div>
                  <button onClick={() => descargarPDF(ventaGuard, modalFact.id)} className="btn-primary w-full btn-lg gap-2">
                    <Download size={16}/> Descargar PDF
                  </button>
                  <p className="text-pan-700 text-xs text-center">Descargá el PDF y adjuntalo en WhatsApp</p>
                  <button onClick={() => {
                    const fecha = new Date(ventaGuard.fecha).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
                    const lineas = ventaGuard.items.map((i:any) =>
                      `▪ ${i.nombre}\n  ${i.cantidad}${i.por_peso?' kg':' u.'} x ${formatPrecio(i.precio_unitario)} = *${formatPrecio(i.subtotal)}*`
                    ).join('\n');
                    const msg =
                      `🥖 *Panadería — Factura #${ventaGuard.numero}*\n` +
                      `📅 ${fecha}\n` +
                      `👤 ${modalFact.nombre}\n` +
                      (modalFact.cuit ? `CUIT: ${modalFact.cuit}\n` : '') +
                      `━━━━━━━━━━━━━━\n` +
                      lineas + '\n' +
                      `━━━━━━━━━━━━━━\n` +
                      `💰 *TOTAL: ${formatPrecio(ventaGuard.total)}*\n` +
                      `💳 ${ventaGuard.medio_pago}\n\n` +
                      `_Gracias por su compra_ 🙏`;
                    const tel = modalFact.telefono?.replace(/\D/g,'');
                    const url = tel ? `https://wa.me/54${tel}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                    window.open(url,'_blank');
                  }} className="btn-secondary w-full btn-lg gap-2">📱 Enviar por WhatsApp</button>
                  <button onClick={() => { setVentaGuard(null); setItemsFact([]); }} className="btn-ghost w-full text-pan-600">+ Nueva factura</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal pago */}
      {modalPago && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalPago(null)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">Pago — {modalPago.nombre}</h2>
              <button onClick={() => setModalPago(null)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="px-3 py-2 rounded-xl bg-red-900/10 border border-red-800/30 text-sm">
                <span className="text-red-400 font-medium">Saldo deuda: {formatPrecio(saldoCliente(modalPago.id).saldo)}</span>
              </div>
              <div><label className="label">Monto *</label>
                <input className="input text-2xl font-bold text-center" type="tel" placeholder="$ 0"
                  value={montoPago} onChange={e => setMontoPago(e.target.value)}/></div>
              <div>
                <label className="label">Medio de pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {['EFECTIVO','TRANSFERENCIA','CHEQUE'].map(m => (
                    <button key={m} onClick={() => setMedioPagoCta(m)}
                      className={`btn btn-sm ${medioPagoCta === m ? 'btn-primary' : 'btn-secondary'}`}>
                      {m==='EFECTIVO'?'💵 Efec.':m==='TRANSFERENCIA'?'📱 Transf.':'📄 Cheque'}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="label">Notas</label>
                <input className="input" placeholder="Ej: pago parcial, nro. cheque..."
                  value={notasPago} onChange={e => setNotasPago(e.target.value)}/></div>
              {montoPago && parseFloat(montoPago) > 0 && (
                <div className="px-3 py-2 rounded-xl bg-bg-card border border-bg-border text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-pan-600">Saldo actual</span><span className="text-red-400">{formatPrecio(saldoCliente(modalPago.id).saldo)}</span></div>
                  <div className="flex justify-between font-bold border-t border-bg-border pt-1">
                    <span className="text-pan-400">Saldo restante</span>
                    <span className={saldoCliente(modalPago.id).saldo - parseFloat(montoPago) > 0 ? 'text-red-300' : 'text-green-400'}>
                      {formatPrecio(Math.max(0, saldoCliente(modalPago.id).saldo - parseFloat(montoPago)))}
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
