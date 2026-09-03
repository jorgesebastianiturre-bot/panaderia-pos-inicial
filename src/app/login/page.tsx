'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router   = useRouter();
  const supabase = createClient();
  const [usuario,  setUsuario]  = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario.trim() || !password.trim()) {
      toast.error('Completá usuario y contraseña');
      return;
    }
    setCargando(true);

    const input = usuario.trim();

    // Si ya tiene @ es un email completo, sino construir email interno
    const email = input.includes('@')
      ? input
      : `${input.toLowerCase().replace(/\s+/g, '.')}@panaderia.local`;

    const { error } = await supabase.auth.signInWithPassword({ email, password: password.trim() });

    if (error) {
      toast.error('Usuario o contraseña incorrectos');
      setCargando(false);
      return;
    }

    router.push('/pos');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-5xl">🥖</span>
          <h1 className="font-display font-bold text-2xl text-pan-200 mt-3">Panadería POS</h1>
          <p className="text-pan-600 text-sm mt-1">Ingresá con tu usuario y contraseña</p>
        </div>

        <form onSubmit={ingresar} className="card space-y-4">
          <div>
            <label className="label">Usuario o email</label>
            <input
              className="input"
              placeholder="Ej: celeste o tu@email.com"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input
              className="input"
              type="password"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={cargando} className="btn-primary w-full btn-lg">
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
