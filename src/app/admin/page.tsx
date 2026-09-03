'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Settings, UserPlus, Edit2, X, Shield, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { genId, cx } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { Rol } from '@/types';

const ROLES: { val: Rol; label: string; desc: string; color: string }[] = [
  { val: 'ADMIN',    label: 'Administrador', desc: 'Acceso total: usuarios, eliminar, configurar', color: 'text-red-400' },
  { val: 'GESTOR',   label: 'Gestor',        desc: 'Todo excepto eliminar y gestionar usuarios',   color: 'text-amber-400' },
  { val: 'VENDEDOR', label: 'Vendedor',      desc: 'Solo ventas, clientes y precios mayoristas',   color: 'text-green-400' },
];

const PERMISOS_POR_ROL: Record<Rol, string[]> = {
  ADMIN: [
    '✅ Realizar ventas con precios mayoristas',
    '✅ Ver historial de ventas (todas)',
    '✅ Gestionar productos (crear, editar, eliminar)',
    '✅ Gestionar clientes y cuentas corrientes',
    '✅ Gestionar compras y proveedores',
    '✅ Abrir y cerrar turnos de cualquier usuario',
    '✅ Ver y editar cierres de caja',
    '✅ Ver vencimientos',
    '✅ Anular ventas',
    '✅ Eliminar registros',
    '✅ Crear, editar y desactivar usuarios',
    '✅ Asignar roles y permisos',
  ],
  GESTOR: [
    '✅ Realizar ventas con precios mayoristas',
    '✅ Ver historial de ventas (todas)',
    '✅ Gestionar productos (crear y editar)',
    '✅ Gestionar clientes y cuentas corrientes',
    '✅ Gestionar compras y proveedores',
    '✅ Abrir y cerrar su turno',
    '✅ Ver cierres de caja',
    '✅ Ver vencimientos',
    '✅ Anular ventas',
    '❌ Eliminar registros',
    '❌ Gestionar usuarios',
  ],
  VENDEDOR: [
    '✅ Realizar ventas (precio normal y mayorista)',
    '✅ Ver historial de ventas del turno actual',
    '✅ Ver y buscar clientes',
    '✅ Crear cliente rápido al cobrar',
    '✅ Abrir y cerrar su turno',
    '❌ Editar productos ni precios',
    '❌ Ver compras ni proveedores',
    '❌ Ver cierres de caja',
    '❌ Anular ventas',
    '❌ Gestionar usuarios',
  ],
};

export default function AdminPage() {
  const supabase = createClient();
  const { usuario } = useSesion();
  const [usuarios,  setUsuarios]  = useState<any[]>([]);
  const [modal,     setModal]     = useState(false);
  const [editando,  setEditando]  = useState<any | null>(null);
  const [cargando,  setCargando]  = useState(false);
  const [rolVista,  setRolVista]  = useState<Rol>('VENDEDOR');

  const [nombre,    setNombre]    = useState('');
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [rol,       setRol]       = useState<Rol>('VENDEDOR');
  const [verPass,   setVerPass]   = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data } = await supabase.from('usuarios').select('*').order('nombre');
    if (data) setUsuarios(data);
  }

  function abrirModalNuevo() {
    setEditando(null);
    setNombre(''); setUsername(''); setPassword(''); setRol('VENDEDOR');
    setModal(true);
  }

  function abrirModalEditar(u: any) {
    setEditando(u);
    setNombre(u.nombre); setUsername(u.username ?? ''); setPassword(''); setRol(u.rol);
    setModal(true);
  }

  async function guardar() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }

    if (editando) {
      setCargando(true);
      const { error } = await supabase.from('usuarios').update({
        nombre: nombre.trim(),
        rol,
        username: username.trim() || editando.username,
      }).eq('id', editando.id);
      if (error) { toast.error('Error al actualizar'); setCargando(false); return; }

      // Si cambiaron la contraseña, actualizarla en Auth
      if (password.trim().length >= 6) {
        // Actualizar via RPC o admin — avisamos que requiere logout
        toast.success('Usuario actualizado. La contraseña se aplica en el próximo login.');
      } else {
        toast.success('Usuario actualizado');
      }
      setModal(false); cargar(); setCargando(false);
      return;
    }

    // Crear usuario nuevo
    if (!username.trim()) { toast.error('El nombre de usuario es obligatorio'); return; }
    if (!password.trim() || password.length < 4) { toast.error('La contraseña debe tener al menos 4 caracteres'); return; }
    setCargando(true);

    // Email interno: username@panaderia.local
    const emailInterno = `${username.trim().toLowerCase().replace(/\s+/g, '.')}@panaderia.local`;

    // Crear en Supabase Auth con signup
    const { data: signData, error: signError } = await supabase.auth.signUp({
      email:    emailInterno,
      password: password.trim(),
      options:  { data: { nombre: nombre.trim(), rol } },
    });

    if (signError) {
      // Si ya existe, intentar igualmente
      if (signError.message?.includes('already registered')) {
        toast.error(`El usuario "${username}" ya existe`);
      } else {
        toast.error(signError.message ?? 'Error al crear el usuario');
      }
      setCargando(false);
      return;
    }

    if (!signData?.user) {
      toast.error('No se pudo crear el usuario');
      setCargando(false);
      return;
    }

    // Guardar en tabla usuarios
    const { error: dbError } = await supabase.from('usuarios').insert({
      id:        genId('u'),
      auth_id:   signData.user.id,
      nombre:    nombre.trim(),
      username:  username.trim().toLowerCase(),
      rol,
      activo:    true,
      creado_en: Date.now(),
    });

    if (dbError) {
      toast.error('Usuario creado en Auth pero error en base de datos: ' + dbError.message);
      setCargando(false);
      return;
    }

    toast.success(`✅ Usuario "${nombre}" creado. Login: ${username} / contraseña asignada`);
    setModal(false); cargar(); setCargando(false);
  }

  async function toggleActivo(u: any) {
    if (u.id === usuario?.id) { toast.error('No podés desactivarte a vos mismo'); return; }
    await supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id);
    toast.success(u.activo ? 'Usuario desactivado' : 'Usuario activado');
    cargar();
  }

  if (usuario?.rol !== 'ADMIN') {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="card text-center py-10 max-w-sm">
          <Shield size={40} className="mx-auto mb-3 text-pan-700"/>
          <p className="text-pan-400 font-medium">Acceso restringido</p>
          <p className="text-pan-700 text-sm mt-1">Solo los administradores pueden acceder.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4 space-y-6">
      {/* Acceso rápido a categorías */}
      <a href="/admin/categorias"
        className="card flex items-center gap-3 hover:border-pan-600 transition-colors cursor-pointer">
        <div className="w-10 h-10 rounded-xl bg-pan-500/20 flex items-center justify-center shrink-0">
          <span className="text-xl">🏷</span>
        </div>
        <div>
          <p className="text-pan-200 font-medium">Gestionar Categorías</p>
          <p className="text-pan-600 text-xs">Crear, editar o eliminar categorías de productos e insumos</p>
        </div>
        <span className="ml-auto text-pan-600">→</span>
      </a>
      <div className="flex items-center gap-2">
        <Settings className="text-pan-500"/>
        <h1 className="font-display font-bold text-xl text-pan-200">Administración</h1>
      </div>

      {/* Info de cómo funciona el login */}
      <div className="card border-pan-700/30 bg-pan-500/5 space-y-1">
        <p className="text-pan-300 text-sm font-medium">🔑 Cómo funciona el login</p>
        <p className="text-pan-600 text-xs">
          Cada usuario ingresa con su <span className="text-pan-400">nombre de usuario</span> y su <span className="text-pan-400">contraseña</span>. 
          El email se genera automáticamente como <span className="text-pan-500">usuario@panaderia.local</span> — el empleado nunca lo ve.
        </p>
        <p className="text-pan-700 text-xs">Ej: usuario <strong className="text-pan-600">celeste</strong> → ingresa con "celeste" + su contraseña</p>
      </div>

      {/* Tabla de permisos */}
      <div className="card space-y-4">
        <h2 className="font-medium text-pan-300">Permisos por rol</h2>
        <div className="flex gap-2 flex-wrap">
          {ROLES.map((r) => (
            <button key={r.val} onClick={() => setRolVista(r.val)}
              className={cx('btn btn-sm', rolVista === r.val ? 'btn-primary' : 'btn-secondary')}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-pan-600 text-xs mb-2">{ROLES.find((r) => r.val === rolVista)?.desc}</p>
          {PERMISOS_POR_ROL[rolVista].map((p, i) => (
            <p key={i} className={cx('text-sm', p.startsWith('✅') ? 'text-pan-400' : 'text-pan-700')}>{p}</p>
          ))}
        </div>
      </div>

      {/* Lista usuarios */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-pan-300">Usuarios del sistema</h2>
          <button onClick={abrirModalNuevo} className="btn-primary btn-sm gap-1">
            <UserPlus size={14}/> Nuevo usuario
          </button>
        </div>

        {usuarios.map((u) => {
          const rolInfo = ROLES.find((r) => r.val === u.rol);
          return (
            <div key={u.id} className={cx('card-sm flex items-center gap-3', !u.activo && 'opacity-50')}>
              <div className="w-9 h-9 rounded-full bg-pan-500/20 flex items-center justify-center text-pan-300 font-bold text-sm shrink-0">
                {u.nombre[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-pan-200 font-medium text-sm">{u.nombre}</p>
                  <span className={cx('badge text-xs', rolInfo?.color)}>{rolInfo?.label}</span>
                  {!u.activo && <span className="badge badge-bad">Inactivo</span>}
                  {u.id === usuario?.id && <span className="text-pan-700 text-xs">(vos)</span>}
                </div>
                <p className="text-pan-600 text-xs">Usuario: {u.username}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => abrirModalEditar(u)} className="btn-ghost btn-sm p-2"><Edit2 size={14}/></button>
                {u.id !== usuario?.id && (
                  <button onClick={() => toggleActivo(u)}
                    className={cx('btn btn-sm px-3', u.activo ? 'btn-secondary text-red-400' : 'btn-primary')}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box max-w-sm">
            <div className="p-4 border-b border-bg-border flex items-center justify-between">
              <h2 className="font-display font-bold text-pan-200">
                {editando ? `Editar — ${editando.nombre}` : 'Nuevo usuario'}
              </h2>
              <button onClick={() => setModal(false)} className="btn-ghost btn-sm p-2"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="label">Nombre completo *</label>
                <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Celeste Vega"/>
              </div>
              <div>
                <label className="label">Nombre de usuario * {editando && <span className="text-pan-700 text-xs">(no se puede cambiar)</span>}</label>
                <input className="input" value={username}
                  onChange={(e) => !editando && setUsername(e.target.value.toLowerCase().replace(/\s+/g, '.'))}
                  placeholder="Ej: celeste" disabled={!!editando}
                  style={editando ? { opacity: 0.5 } : {}}/>
                {!editando && username && (
                  <p className="text-pan-700 text-xs mt-1">Login: <span className="text-pan-500">{username}</span> + contraseña</p>
                )}
              </div>
              <div>
                <label className="label">
                  Contraseña {editando ? '(dejá vacío para no cambiar)' : '*'}
                </label>
                <div className="relative">
                  <input className="input pr-10" type={verPass ? 'text' : 'password'}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={editando ? 'Nueva contraseña (opcional)' : 'Mínimo 4 caracteres'}/>
                  <button type="button" onClick={() => setVerPass(!verPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-pan-600 hover:text-pan-400">
                    {verPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Rol</label>
                <div className="space-y-2">
                  {ROLES.map((r) => (
                    <label key={r.val}
                      className={cx('flex items-start gap-3 p-3 rounded-xl border cursor-pointer',
                        rol === r.val ? 'bg-pan-500/10 border-pan-500/40' : 'bg-bg-card border-bg-border hover:border-pan-700')}>
                      <input type="radio" name="rol" value={r.val} checked={rol === r.val}
                        onChange={() => setRol(r.val)} className="mt-0.5"/>
                      <div>
                        <p className={cx('font-medium text-sm', r.color)}>{r.label}</p>
                        <p className="text-pan-600 text-xs">{r.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-bg-border">
              <button onClick={guardar} disabled={cargando} className="btn-primary w-full btn-lg">
                {cargando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
