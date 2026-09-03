'use client';
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingCart, Package, Users, TrendingDown, LogOut, ClipboardList, Receipt, Clock, Settings, Truck, Menu, X, AlertTriangle, BookOpen, CreditCard, Flame, Trash2, Tag, BarChart2, History } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSesion } from '@/lib/store';
import { useAppData } from '@/hooks/useAppData';
import { cx } from '@/lib/utils';
import { useState } from 'react';
import type { Rol } from '@/types';

const NAV = [
  { href:'/pos',            label:'Venta',         icon:<ShoppingCart size={20}/>,  roles:['ADMIN','GESTOR','VENDEDOR'] as Rol[] },
  { href:'/ventas',         label:'Facturas',      icon:<Receipt size={20}/>,       roles:['ADMIN','GESTOR','VENDEDOR'] as Rol[] },
  { href:'/cierres',        label:'Turno y Cierre',       icon:<ClipboardList size={20}/>, roles:['ADMIN','GESTOR'] as Rol[] },
  { href:'/productos',      label:'Productos',     icon:<Package size={20}/>,       roles:['ADMIN','GESTOR'] as Rol[] },
  { href:'/vencimientos',   label:'Vencimientos',  icon:<AlertTriangle size={20}/>, roles:['ADMIN','GESTOR'] as Rol[] },
  { href:'/clientes',       label:'Clientes',      icon:<Users size={20}/>,         roles:['ADMIN','GESTOR','VENDEDOR'] as Rol[] },
  { href:'/clientes-cc',    label:'CC Clientes',   icon:<CreditCard size={20}/>,    roles:['ADMIN','GESTOR'] as Rol[] },
  { href:'/compras',        label:'Compras',       icon:<TrendingDown size={20}/>,  roles:['ADMIN','GESTOR'] as Rol[] },
  { href:'/proveedores',    label:'Proveedores',   icon:<Truck size={20}/>,         roles:['ADMIN','GESTOR'] as Rol[] },
  { href:'/proveedores-cc', label:'CC Proveed.',   icon:<BookOpen size={20}/>,      roles:['ADMIN','GESTOR'] as Rol[] },
  { href:'/perdidas',       label:'Pérdidas',      icon:<Trash2 size={20}/>,        roles:['ADMIN','GESTOR'] as Rol[] },
  { href:'/produccion',     label:'Producción',    icon:<Flame size={20}/>,         roles:['ADMIN','GESTOR'] as Rol[] },
  { href:'/historial',       label:'Historial',     icon:<History size={20}/>,       roles:['ADMIN','GESTOR'] as Rol[] },
  { href:'/reportes',         label:'Reportes',      icon:<BarChart2 size={20}/>,     roles:['ADMIN','GESTOR'] as Rol[] },
  { href:'/admin/categorias', label:'Categorías',   icon:<Tag size={20}/>,           roles:['ADMIN'] as Rol[] },
  { href:'/personal',       label:'Personal',      icon:<Users size={20}/>,          roles:['ADMIN','GESTOR'] as Rol[] },
  { href:'/admin',          label:'Admin',         icon:<Settings size={20}/>,      roles:['ADMIN'] as Rol[] },
];

export default function PosLayout({ children }: { children: React.ReactNode }) {
  useAppData();
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();
  const { usuario, turnoActivo } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const nav    = NAV.filter((n) => !usuario || n.roles.includes(usuario.rol));
  const activo = (href: string) => pathname === href || (href !== '/pos' && pathname.startsWith(href + '/'));

  async function salir() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-bg-surface border-r border-bg-border">
        <div className="p-4 border-b border-bg-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥖</span>
            <div>
              <p className="font-display font-bold text-pan-200 text-sm leading-none">Panadería</p>
              <p className="text-pan-700 text-xs">POS v2</p>
            </div>
          </div>
          {turnoActivo && (
            <div className="mt-3 px-2 py-1.5 rounded-lg bg-green-900/20 border border-green-800/30">
              <p className="text-green-400 text-xs font-medium">
                🟢 Turno {turnoActivo.tipo === 'MANIANA' ? 'Mañana' : 'Tarde'}
              </p>
            </div>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={cx('nav-item text-sm', activo(n.href) ? 'active' : '')}>
              {n.icon}{n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-bg-border">
          {usuario && (
            <div className="flex items-center gap-2 mb-2 px-2">
              <div className="w-7 h-7 rounded-full bg-pan-500/30 flex items-center justify-center text-pan-300 text-xs font-bold shrink-0">
                {usuario.nombre[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-pan-200 text-xs font-medium truncate">{usuario.nombre}</p>
                <p className="text-pan-700 text-xs">{usuario.rol}</p>
              </div>
            </div>
          )}
          <button onClick={salir} className="nav-item w-full text-sm"><LogOut size={16}/>Salir</button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-surface border-t border-bg-border flex items-center justify-around px-1 py-1.5">
        {nav.slice(0, 4).map((n) => (
          <Link key={n.href} href={n.href}
            className={cx('flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors',
              activo(n.href) ? 'text-pan-400 bg-pan-500/10' : 'text-pan-700')}>
            {n.icon}
            <span className="text-[10px] font-medium">{n.label}</span>
          </Link>
        ))}
        <button onClick={() => setMenuAbierto(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-pan-700">
          <Menu size={20}/>
          <span className="text-[10px] font-medium">Más</span>
        </button>
      </nav>

      {menuAbierto && (
        <div className="md:hidden fixed inset-0 z-50" onClick={() => setMenuAbierto(false)}>
          <div className="absolute inset-0 bg-black/60"/>
          <div className="absolute bottom-0 left-0 right-0 bg-bg-surface rounded-t-2xl p-4 space-y-2 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                {usuario && <p className="text-pan-200 font-medium">{usuario.nombre}</p>}
                <p className="text-pan-600 text-sm">{usuario?.rol}</p>
              </div>
              <button onClick={() => setMenuAbierto(false)} className="btn-ghost p-2"><X size={20}/></button>
            </div>
            {nav.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setMenuAbierto(false)}
                className={cx('flex items-center gap-3 px-4 py-3 rounded-xl text-sm',
                  activo(n.href) ? 'bg-pan-500/20 text-pan-300 border border-pan-500/30' : 'text-pan-400 hover:bg-bg-hover')}>
                {n.icon}{n.label}
              </Link>
            ))}
            <button onClick={salir}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-900/20 border border-red-900/30 mt-2">
              <LogOut size={20}/>Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
