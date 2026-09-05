'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Users, Plus, X, Edit2, Trash2, Clock, Download, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPrecio, genId } from '@/lib/utils';
import toast from 'react-hot-toast';

const PIN = '1214';
const CATS = ['Ventas','Limpieza','Ayudante de panadero','Oficial panadero','Maestro panadero','Ayudante de pastelería','Pastelero'];
const hoy = new Date().toISOString().split('T')[0];

function calcHoras(e: string, s: string) {
  const [he,me]=e.split(':').map(Number); const [hs,ms]=s.split(':').map(Number);
  return Math.max(0,(hs*60+ms-he*60-me)/60);
}
function fmtH(h: number) { const hh=Math.floor(h),mm=Math.round((h-hh)*60); return `${hh}h ${mm.toString().padStart(2,'0')}m`; }
function fmtF(iso: string) { const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }
function diaSem(iso: string) { return new Date(iso+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long'}); }

export default function PersonalPage() {
  const supabase = createClient();
  const [pinOk, setPinOk] = useState(false);
  const [pinIn, setPinIn] = useState('');
  const [pinErr, setPinErr] = useState(false);
  const [personal, setPersonal] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [fichajes, setFichajes] = useState<any[]>([]);
  const [movs, setMovs] = useState<any[]>([]);
  const [tab, setTab] = useState<'personal'|'fichajes'|'movimientos'|'liquidacion'>('personal');
  const [cargando, setCargando] = useState(false);

  // Form personal
  const [modalP, setModalP] = useState(false);
  const [editP, setEditP] = useState<any|null>(null);
  const [fNom, setFNom] = useState(''); const [fDni, setFDni] = useState('');
  const [fTel, setFTel] = useState(''); const [fTelA, setFTelA] = useState('');
  const [fDom, setFDom] = useState(''); const [fIng, setFIng] = useState('');
  const [fNac, setFNac] = useState(''); const [fCat, setFCat] = useState(CATS[0]);
  const [fHora, setFHora] = useState('');

  // Form fichaje
  const [modalF, setModalF] = useState(false);
  const [editF, setEditF] = useState<any|null>(null);
  const [fFecha, setFFecha] = useState(hoy); const [fEnt, setFEnt] = useState('');
  const [fSal, setFSal] = useState(''); const [fPerId, setFPerId] = useState('');
  const [fNotas, setFNotas] = useState('');

  // Form movimiento
  const [modalM, setModalM] = useState(false);
  const [mPerId, setMPerId] = useState(''); const [mTipo, setMTipo] = useState<'ADELANTO'|'CONSUMO'>('ADELANTO');
  const [mFecha, setMFecha] = useState(hoy); const [mMonto, setMMonto] = useState('');
  const [mDesc, setMDesc] = useState(''); const [mProdId, setMProdId] = useState('');
  const [mCant, setMCant] = useState(''); const [busqProd, setBusqProd] = useState('');

  // Filtros
  const [filtroP, setFiltroP] = useState('');
  const [filtroD, setFiltroD] = useState(''); const [filtroH, setFiltroH] = useState('');

  // Liquidación
  const [liqP, setLiqP] = useState(''); const [liqD, setLiqD] = useState(''); const [liqH, setLiqH] = useState('');

  useEffect(() => { if (pinOk) cargar(); }, [pinOk]);

  async function cargar() {
    const [{ data: p }, { data: pr }, { data: f }, { data: m }] = await Promise.all([
      supabase.from('personal').select('*').eq('activo', true).order('nombre'),
      supabase.from('productos').select('id, nombre, precio').eq('activo', true).order('nombre'),
      supabase.from('personal_fichajes').select('*, personal(nombre, valor_hora)').order('fecha', { ascending: false }).limit(300),
      supabase.from('personal_movimientos').select('*, personal(nombre), productos(nombre)').order('fecha', { ascending: false }).limit(300),
    ]);
    if (p) setPersonal(p); if (pr) setProductos(pr);
    if (f) setFichajes(f); if (m) setMovs(m);
  }

  // Personal
  function abrirNuevoP() { setEditP(null); setFNom(''); setFDni(''); setFTel(''); setFTelA(''); setFDom(''); setFIng(hoy); setFNac(''); setFCat(CATS[0]); setFHora(''); setModalP(true); }
  function abrirEditarP(p: any) { setEditP(p); setFNom(p.nombre); setFDni(p.dni??''); setFTel(p.telefono??''); setFTelA(p.telefono_alt??''); setFDom(p.domicilio??''); setFIng(p.fecha_ingreso??''); setFNac(p.fecha_nacimiento??''); setFCat(p.categoria); setFHora(String(p.valor_hora)); setModalP(true); }
  async function guardarP() {
    if (!fNom||!fHora) { toast.error('Nombre y valor hora son obligatorios'); return; }
    setCargando(true);
    const datos = { nombre: fNom, dni: fDni||null, telefono: fTel||null, telefono_alt: fTelA||null, domicilio: fDom||null, fecha_ingreso: fIng||null, fecha_nacimiento: fNac||null, categoria: fCat, valor_hora: parseFloat(fHora) };
    if (editP) await supabase.from('personal').update(datos).eq('id', editP.id);
    else await supabase.from('personal').insert({ ...datos, id: genId('per'), activo: true, creado_en: Date.now() });
    toast.success(editP ? 'Actualizado' : 'Empleado creado');
    setModalP(false); cargar(); setCargando(false);
  }
  async function eliminarP(id: string) {
    if (!confirm('¿Eliminás este empleado?')) return;
    await supabase.from('personal').update({ activo: false }).eq('id', id); cargar();
  }

  // Fichajes
  function abrirFichaje(pId?: string) { setEditF(null); setFFecha(hoy); setFEnt(''); setFSal(''); setFPerId(pId??''); setFNotas(''); setModalF(true); }
  function abrirEditF(f: any) { setEditF(f); setFFecha(f.fecha); setFEnt(f.hora_entrada); setFSal(f.hora_salida??''); setFPerId(f.personal_id); setFNotas(f.notas??''); setModalF(true); }
  async function guardarF() {
    if (!fPerId||!fFecha||!fEnt) { toast.error('Completá los datos'); return; }
    const emp = personal.find(p => p.id === fPerId);
    const horas = fSal ? calcHoras(fEnt, fSal) : null;
    const valor = horas !== null ? horas * (emp?.valor_hora ?? 0) : null;
    setCargando(true);
    const datos = { personal_id: fPerId, fecha: fFecha, hora_entrada: fEnt, hora_salida: fSal||null, horas_total: horas, valor_total: valor, notas: fNotas||null };
    if (editF) await supabase.from('personal_fichajes').update(datos).eq('id', editF.id);
    else await supabase.from('personal_fichajes').insert({ ...datos, id: genId('fich'), creado_en: Date.now() });
    toast.success('Fichaje guardado'); setModalF(false); cargar(); setCargando(false);
  }
  async function eliminarF(id: string) {
    if (!confirm('¿Eliminás este fichaje?')) return;
    await supabase.from('personal_fichajes').delete().eq('id', id); cargar();
  }

  // Movimientos
  const prodFilt = productos.filter(p => p.nombre.toLowerCase().includes(busqProd.toLowerCase())).slice(0,6);
  const prodSel = productos.find(p => p.id === mProdId);
  function abrirMov(pId?: string) { setMPerId(pId??''); setMTipo('ADELANTO'); setMFecha(hoy); setMMonto(''); setMDesc(''); setMProdId(''); setMCant(''); setBusqProd(''); setModalM(true); }
  async function guardarM() {
    const montoFinal = mTipo==='CONSUMO'&&mProdId&&mCant ? parseFloat(mCant)*(prodSel?.precio??0) : parseFloat(mMonto);
    if (!mPerId||!montoFinal) { toast.error('Completá los datos'); return; }
    setCargando(true);
    await supabase.from('personal_movimientos').insert({
      id: genId('mov'), personal_id: mPerId, tipo: mTipo, fecha: mFecha,
      monto: montoFinal, descripcion: mDesc||null,
      producto_id: mTipo==='CONSUMO'?mProdId||null:null,
      cantidad: mTipo==='CONSUMO'?parseFloat(mCant)||null:null,
      precio_unit: mTipo==='CONSUMO'&&prodSel?prodSel.precio:null, creado_en: Date.now(),
    });
    toast.success('Registrado'); setModalM(false); cargar(); setCargando(false);
  }
  async function eliminarM(id: string) { if (!confirm('¿Eliminás?')) return; await supabase.from('personal_movimientos').delete().eq('id', id); cargar(); }

  // Liquidación
  function calcLiq() {
    const emp = personal.find(p => p.id === liqP);
    if (!emp||!liqD||!liqH) return null;
    const fichs = fichajes.filter(f => f.personal_id===liqP&&f.fecha>=liqD&&f.fecha<=liqH&&f.horas_total);
    const movsPer = movs.filter(m => m.personal_id===liqP&&m.fecha>=liqD&&m.fecha<=liqH);
    const totalHoras = fichs.reduce((a,f)=>a+(f.horas_total??0),0);
    const totalBruto = fichs.reduce((a,f)=>a+(f.valor_total??0),0);
    const totalAd = movsPer.filter(m=>m.tipo==='ADELANTO').reduce((a,m)=>a+m.monto,0);
    const totalCons = movsPer.filter(m=>m.tipo==='CONSUMO').reduce((a,m)=>a+m.monto,0);
    return { emp, fichs, movsPer, totalHoras, totalBruto, totalAd, totalCons, neto: totalBruto-totalAd-totalCons };
  }

  function imprimirRecibo(liq: any) {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Recibo de Sueldo</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:20px;max-width:500px;margin:0 auto}
.header{text-align:center;border-bottom:3px solid #2a5c1e;padding-bottom:10px;margin-bottom:14px}
.logo{font-size:18px;font-weight:bold;color:#2a5c1e}.titulo{font-size:13px;font-weight:bold;margin-top:4px}
.periodo{font-size:11px;color:#666}.datos{background:#f7f7f7;border:1px solid #ddd;border-radius:4px;padding:10px;margin-bottom:12px}
.datos p{margin:2px 0}.seccion{margin-bottom:10px}.sec-title{font-weight:bold;font-size:11px;background:#eee;padding:4px 8px;margin-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:11px}td{padding:4px 6px;border-bottom:1px solid #eee}.r{text-align:right}
.total-box{background:#2a5c1e;color:white;padding:10px;border-radius:4px;margin-top:12px;text-align:center}
.total-label{font-size:11px;opacity:0.8}.total-val{font-size:22px;font-weight:bold}
.firma{margin-top:30px;display:flex;justify-content:space-between;font-size:10px;color:#888}
.firma div{text-align:center;border-top:1px solid #ccc;padding-top:4px;width:45%}
@media print{@page{margin:10mm;size:A5}}</style></head><body>
<div class="header"><div class="logo">🥖 Panadería</div><div class="titulo">Recibo de Sueldo</div>
<div class="periodo">Período: ${fmtF(liqD)} al ${fmtF(liqH)}</div></div>
<div class="datos"><p><strong>Empleado:</strong> ${liq.emp.nombre}</p>
${liq.emp.dni?`<p><strong>DNI:</strong> ${liq.emp.dni}</p>`:''}
<p><strong>Categoría:</strong> ${liq.emp.categoria}</p>
<p><strong>Valor hora:</strong> ${formatPrecio(liq.emp.valor_hora)}</p></div>
<div class="seccion"><div class="sec-title">Horas trabajadas</div>
<table><tr><td style="color:#666">Fecha</td><td style="color:#666">Día</td><td style="color:#666">Horario</td><td class="r" style="color:#666">Horas</td><td class="r" style="color:#666">Valor</td></tr>
${liq.fichs.map((f:any)=>`<tr><td>${fmtF(f.fecha)}</td><td>${diaSem(f.fecha)}</td><td>${f.hora_entrada} - ${f.hora_salida??'-'}</td><td class="r">${fmtH(f.horas_total??0)}</td><td class="r">${formatPrecio(f.valor_total??0)}</td></tr>`).join('')}
<tr style="font-weight:bold;background:#f0f0f0"><td colspan="3">SUBTOTAL</td><td class="r">${fmtH(liq.totalHoras)}</td><td class="r">${formatPrecio(liq.totalBruto)}</td></tr></table></div>
${liq.movsPer.length>0?`<div class="seccion"><div class="sec-title">Descuentos</div>
<table>${liq.movsPer.map((m:any)=>`<tr><td>${fmtF(m.fecha)}</td><td>${m.tipo==='ADELANTO'?'Adelanto':'Consumo'}: ${m.descripcion||m.productos?.nombre||''}</td><td class="r" style="color:#c0392b">- ${formatPrecio(m.monto)}</td></tr>`).join('')}
<tr style="font-weight:bold;background:#f0f0f0"><td colspan="2">TOTAL DESCUENTOS</td><td class="r" style="color:#c0392b">- ${formatPrecio(liq.totalAd+liq.totalCons)}</td></tr></table></div>`:''}
<div class="total-box"><div class="total-label">NETO A PAGAR</div><div class="total-val">${formatPrecio(liq.neto)}</div></div>
<div class="firma"><div>Firma empleador</div><div>Firma empleado: ${liq.emp.nombre}</div></div>
<p style="text-align:center;font-size:9px;color:#aaa;margin-top:14px">Emitido el ${new Date().toLocaleDateString('es-AR')}</p>
</body></html>`;
    const win=window.open('','_blank'); if(win){win.document.write(html);win.document.close();setTimeout(()=>win.print(),400);}
  }

  const fichsFilt = fichajes.filter(f => (!filtroP||f.personal_id===filtroP)&&(!filtroD||f.fecha>=filtroD)&&(!filtroH||f.fecha<=filtroH));
  const movsFilt  = movs.filter(m => (!filtroP||m.personal_id===filtroP)&&(!filtroD||m.fecha>=filtroD)&&(!filtroH||m.fecha<=filtroH));
  const liq = calcLiq();

  function calcEdad(iso: string) {
    const hoyD = new Date(); const nac = new Date(iso+'T00:00:00');
    let edad = hoyD.getFullYear()-nac.getFullYear();
    if (hoyD.getMonth()<nac.getMonth()||(hoyD.getMonth()===nac.getMonth()&&hoyD.getDate()<nac.getDate())) edad--;
    return edad;
  }

  if (!pinOk) return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="card max-w-xs w-full space-y-4 text-center">
        <Lock size={40} className="mx-auto text-pan-500"/>
        <h1 className="font-display font-bold text-xl text-pan-200">Módulo de Personal</h1>
        <p className="text-pan-600 text-sm">Ingresá el PIN para acceder</p>
        <input className="input text-center text-2xl tracking-widest font-bold" type="password" placeholder="••••" maxLength={4}
          value={pinIn} onChange={e => setPinIn(e.target.value)} onKeyDown={e => e.key==='Enter'&&(pinIn===PIN?setPinOk(true):setPinErr(true))}/>
        {pinErr && <p className="text-red-400 text-sm">PIN incorrecto</p>}
        <button onClick={() => pinIn===PIN?setPinOk(true):setPinErr(true)} className="btn-primary w-full btn-lg">Ingresar</button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-4">
      <div className="flex items-center gap-2"><Users className="text-pan-500"/><h1 className="font-display font-bold text-xl text-pan-200">Personal</h1></div>

      <div className="grid grid-cols-2 gap-2">
        {(['personal','fichajes','movimientos','liquidacion'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn btn-sm ${tab===t?'btn-primary':'btn-secondary'}`}>
            {t==='personal'?'👥 Personal':t==='fichajes'?'🕐 Fichajes':t==='movimientos'?'💸 Adelantos':'📋 Liquidación'}
          </button>
        ))}
      </div>

      {tab==='personal' && (
        <div className="space-y-3">
          <button onClick={abrirNuevoP} className="btn-primary w-full gap-2"><Plus size={15}/> Nuevo empleado</button>
          {personal.map(p => (
            <div key={p.id} className="card-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-pan-200 font-medium">{p.nombre}</p>
                    <span className="badge badge-info text-xs">{p.categoria}</span>
                  </div>
                  {p.telefono && <p className="text-pan-600 text-xs">{p.telefono}{p.dni&&` · DNI ${p.dni}`}</p>}
                  {p.fecha_nacimiento && <p className="text-pan-700 text-xs">🎂 {fmtF(p.fecha_nacimiento)} · {calcEdad(p.fecha_nacimiento)} años</p>}
                  <p className="text-pan-500 text-xs font-medium">{formatPrecio(p.valor_hora)}/hora</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setTab('fichajes'); abrirFichaje(p.id); }} className="btn btn-sm btn-secondary text-xs gap-1"><Clock size={12}/> Fichar</button>
                  <button onClick={() => abrirMov(p.id)} className="btn btn-sm btn-secondary text-xs">💸</button>
                  <button onClick={() => abrirEditarP(p)} className="btn-ghost btn-sm p-1.5"><Edit2 size={13}/></button>
                  <button onClick={() => eliminarP(p.id)} className="btn-ghost btn-sm p-1.5 text-red-600"><Trash2 size={13}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='fichajes' && (
        <div className="space-y-3">
          <button onClick={() => abrirFichaje()} className="btn-primary w-full gap-2"><Plus size={15}/> Registrar fichaje</button>
          <div className="flex gap-2 flex-wrap">
            <select className="input text-sm flex-1" value={filtroP} onChange={e => setFiltroP(e.target.value)}>
              <option value="">Todo el personal</option>
              {personal.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <input className="input text-xs" style={{maxWidth:130}} type="date" value={filtroD} onChange={e => setFiltroD(e.target.value)}/>
            <input className="input text-xs" style={{maxWidth:130}} type="date" value={filtroH} onChange={e => setFiltroH(e.target.value)}/>
          </div>
          {fichsFilt.length===0 ? <p className="text-pan-700 text-sm text-center py-6">Sin fichajes</p> : fichsFilt.map(f => (
            <div key={f.id} className="card-sm flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-pan-200 font-medium text-sm">{f.personal?.nombre}</p>
                <p className="text-pan-600 text-xs">{fmtF(f.fecha)} · {diaSem(f.fecha)}</p>
                <p className="text-pan-400 text-xs">{f.hora_entrada} → {f.hora_salida??'(sin salida)'}{f.horas_total&&` · ${fmtH(f.horas_total)}`}{f.valor_total&&` · ${formatPrecio(f.valor_total)}`}</p>
                {f.notas && <p className="text-pan-700 text-xs">{f.notas}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => abrirEditF(f)} className="btn-ghost btn-sm p-1.5"><Edit2 size={13}/></button>
                <button onClick={() => eliminarF(f.id)} className="btn-ghost btn-sm p-1.5 text-red-600"><Trash2 size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='movimientos' && (
        <div className="space-y-3">
          <button onClick={() => abrirMov()} className="btn-primary w-full gap-2"><Plus size={15}/> Registrar adelanto / consumo</button>
          <div className="flex gap-2 flex-wrap">
            <select className="input text-sm flex-1" value={filtroP} onChange={e => setFiltroP(e.target.value)}>
              <option value="">Todo el personal</option>
              {personal.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <input className="input text-xs" style={{maxWidth:130}} type="date" value={filtroD} onChange={e => setFiltroD(e.target.value)}/>
            <input className="input text-xs" style={{maxWidth:130}} type="date" value={filtroH} onChange={e => setFiltroH(e.target.value)}/>
          </div>
          {movsFilt.length===0 ? <p className="text-pan-700 text-sm text-center py-6">Sin movimientos</p> : movsFilt.map(m => (
            <div key={m.id} className="card-sm flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-pan-200 font-medium text-sm">{m.personal?.nombre}</p>
                  <span className={`badge text-xs ${m.tipo==='ADELANTO'?'badge-warn':'badge-info'}`}>{m.tipo==='ADELANTO'?'💵 Adelanto':'🛒 Consumo'}</span>
                </div>
                <p className="text-pan-600 text-xs">{fmtF(m.fecha)}{m.descripcion&&` · ${m.descripcion}`}{m.productos?.nombre&&` · ${m.productos.nombre}`}</p>
                <p className="text-red-400 font-bold text-sm">- {formatPrecio(m.monto)}</p>
              </div>
              <button onClick={() => eliminarM(m.id)} className="btn-ghost btn-sm p-1.5 text-red-600 shrink-0"><Trash2 size={13}/></button>
            </div>
          ))}
        </div>
      )}

      {tab==='liquidacion' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="font-medium text-pan-300">Parámetros</h3>
            <div><label className="label">Empleado</label>
              <select className="input" value={liqP} onChange={e => setLiqP(e.target.value)}>
                <option value="">Seleccionar...</option>
                {personal.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Desde</label><input className="input" type="date" value={liqD} onChange={e => setLiqD(e.target.value)}/></div>
              <div><label className="label">Hasta</label><input className="input" type="date" value={liqH} onChange={e => setLiqH(e.target.value)}/></div>
            </div>
          </div>
          {liq && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="card"><p className="text-pan-600 text-xs">Total horas</p><p className="text-pan-200 font-bold text-lg">{fmtH(liq.totalHoras)}</p></div>
                <div className="card"><p className="text-pan-600 text-xs">Bruto</p><p className="text-pan-200 font-bold text-lg">{formatPrecio(liq.totalBruto)}</p></div>
                <div className="card"><p className="text-pan-600 text-xs">Adelantos</p><p className="text-red-400 font-bold text-lg">- {formatPrecio(liq.totalAd)}</p></div>
                <div className="card"><p className="text-pan-600 text-xs">Consumos</p><p className="text-red-400 font-bold text-lg">- {formatPrecio(liq.totalCons)}</p></div>
              </div>
              <div className="card border-pan-500/30 bg-pan-500/10">
                <p className="text-pan-600 text-xs">NETO A PAGAR</p>
                <p className="text-pan-100 font-bold text-3xl">{formatPrecio(liq.neto)}</p>
                <p className="text-pan-600 text-xs mt-1">{liq.emp.nombre} · {fmtF(liqD)} al {fmtF(liqH)}</p>
              </div>
              <button onClick={() => imprimirRecibo(liq)} className="btn-primary w-full btn-lg gap-2">
                <Download size={18}/> Imprimir recibo de sueldo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal personal */}
      {modalP && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&setModalP(false)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">{editP?'Editar':'Nuevo empleado'}</h2>
              <button onClick={() => setModalP(false)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div><label className="label">Nombre y apellido *</label><input className="input" value={fNom} onChange={e => setFNom(e.target.value)}/></div>
              <div><label className="label">DNI</label><input className="input" value={fDni} onChange={e => setFDni(e.target.value)}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Teléfono</label><input className="input" type="tel" value={fTel} onChange={e => setFTel(e.target.value)}/></div>
                <div><label className="label">Tel. alternativo</label><input className="input" type="tel" value={fTelA} onChange={e => setFTelA(e.target.value)}/></div>
              </div>
              <div><label className="label">Domicilio</label><input className="input" value={fDom} onChange={e => setFDom(e.target.value)}/></div>
              <div><label className="label">Fecha de ingreso</label><input className="input" type="date" value={fIng} onChange={e => setFIng(e.target.value)}/></div>
              <div>
                <label className="label">Fecha de nacimiento</label>
                <input className="input" type="date" value={fNac} onChange={e => setFNac(e.target.value)}/>
                {fNac && <p className="text-pan-600 text-xs mt-1">{calcEdad(fNac)} años</p>}
              </div>
              <div><label className="label">Categoría *</label>
                <select className="input" value={fCat} onChange={e => setFCat(e.target.value)}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label className="label">Valor hora *</label>
                <input className="input text-xl font-bold" type="number" placeholder="$ 0" value={fHora} onChange={e => setFHora(e.target.value)}/></div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardarP} disabled={cargando} className="btn-primary w-full btn-lg">{cargando?'Guardando...':editP?'Guardar':'Crear empleado'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal fichaje */}
      {modalF && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&setModalF(false)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">{editF?'Editar fichaje':'Registrar fichaje'}</h2>
              <button onClick={() => setModalF(false)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className="label">Empleado *</label>
                <select className="input" value={fPerId} onChange={e => setFPerId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {personal.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select></div>
              <div><label className="label">Fecha *</label><input className="input" type="date" value={fFecha} onChange={e => setFFecha(e.target.value)}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Entrada *</label><input className="input" type="time" value={fEnt} onChange={e => setFEnt(e.target.value)}/></div>
                <div><label className="label">Salida</label><input className="input" type="time" value={fSal} onChange={e => setFSal(e.target.value)}/></div>
              </div>
              {fEnt&&fSal&&fPerId && (
                <div className="px-3 py-2 rounded-xl bg-pan-500/10 border border-pan-500/20 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-pan-600">Horas</span><span className="text-pan-300 font-bold">{fmtH(calcHoras(fEnt,fSal))}</span></div>
                  <div className="flex justify-between"><span className="text-pan-600">Valor</span>
                    <span className="text-green-400 font-bold">{formatPrecio(calcHoras(fEnt,fSal)*(personal.find(p=>p.id===fPerId)?.valor_hora??0))}</span>
                  </div>
                </div>
              )}
              <div><label className="label">Notas</label><input className="input text-sm" value={fNotas} onChange={e => setFNotas(e.target.value)}/></div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardarF} disabled={cargando} className="btn-primary w-full btn-lg">{cargando?'Guardando...':editF?'Guardar':'Registrar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal movimiento */}
      {modalM && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&setModalM(false)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">Adelanto / Consumo</h2>
              <button onClick={() => setModalM(false)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div><label className="label">Empleado *</label>
                <select className="input" value={mPerId} onChange={e => setMPerId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {personal.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select></div>
              <div className="flex gap-2">
                <button onClick={() => setMTipo('ADELANTO')} className={`btn flex-1 btn-sm ${mTipo==='ADELANTO'?'btn-primary':'btn-secondary'}`}>💵 Adelanto</button>
                <button onClick={() => setMTipo('CONSUMO')} className={`btn flex-1 btn-sm ${mTipo==='CONSUMO'?'btn-primary':'btn-secondary'}`}>🛒 Consumo</button>
              </div>
              <div><label className="label">Fecha *</label><input className="input" type="date" value={mFecha} onChange={e => setMFecha(e.target.value)}/></div>
              {mTipo==='CONSUMO' && (
                <div className="space-y-2">
                  <label className="label">Producto</label>
                  <input className="input text-sm" placeholder="Buscar producto..." value={busqProd}
                    onChange={e => { setBusqProd(e.target.value); setMProdId(''); setMMonto(''); }}/>
                  {busqProd && !mProdId && prodFilt.map(p => (
                    <button key={p.id} onClick={() => { setMProdId(p.id); setBusqProd(p.nombre); }}
                      className="w-full text-left px-3 py-2 rounded-xl bg-bg-card border border-bg-border text-sm">
                      <div className="flex justify-between"><span>{p.nombre}</span><span className="text-pan-500">{formatPrecio(p.precio)}</span></div>
                    </button>
                  ))}
                  {mProdId && (
                    <div className="flex gap-2">
                      <input className="input flex-1" type="number" placeholder="Cantidad" value={mCant}
                        onChange={e => { setMCant(e.target.value); if(prodSel) setMMonto(String(parseFloat(e.target.value)*prodSel.precio)); }}/>
                      {mCant&&prodSel && <div className="px-3 py-2 rounded-xl bg-bg-card border text-sm text-center"><p className="text-pan-600 text-xs">Total</p><p className="text-pan-200 font-bold">{formatPrecio(parseFloat(mCant)*prodSel.precio)}</p></div>}
                    </div>
                  )}
                </div>
              )}
              {mTipo==='ADELANTO' && (
                <div><label className="label">Monto *</label><input className="input text-xl font-bold text-center" type="number" placeholder="$ 0" value={mMonto} onChange={e => setMMonto(e.target.value)} onKeyDown={e => e.key==='Enter'&&guardarM()}/></div>
              )}
              <div><label className="label">Descripción</label><input className="input text-sm" value={mDesc} onChange={e => setMDesc(e.target.value)}/></div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardarM} disabled={cargando} className="btn-primary w-full btn-lg">{cargando?'Registrando...':'Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
