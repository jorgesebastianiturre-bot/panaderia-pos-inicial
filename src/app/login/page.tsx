'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// Íconos simples SVG para el toggle de contraseña
function IconoOjo({ visible }: { visible: boolean }) {
  return visible ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export default function LoginPage() {
  const router   = useRouter();
  const supabase = createClient();
  const [usuario,       setUsuario]       = useState('');
  const [password,      setPassword]      = useState('');
  const [cargando,      setCargando]      = useState(false);
  const [verPassword,   setVerPassword]   = useState(false);

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
            <div className="relative">
              <input
                className="input pr-12"
                type={verPassword ? 'text' : 'password'}
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setVerPassword(!verPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-pan-500 hover:text-pan-200 transition-colors"
                tabIndex={-1}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <IconoOjo visible={verPassword} />
              </button>
            </div>
          </div>
          <button type="submit" disabled={cargando} className="btn-primary w-full btn-lg">
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
