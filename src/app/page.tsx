export const dynamic = 'force-dynamic';
// src/app/page.tsx — Página raíz: verifica config y redirige
import { redirect } from 'next/navigation';

export default function Home() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Si faltan las variables, mostrar pantalla de ayuda en lugar de crashear
  if (!url || !anon || url.includes('XXXXXXXX')) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#14100a', color: '#f0e6d3', fontFamily: 'system-ui, sans-serif', padding: '2rem'
      }}>
        <div style={{ maxWidth: 520, width: '100%' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', textAlign: 'center' }}>🥖</div>
          <h1 style={{ color: '#e05252', fontSize: '1.3rem', marginBottom: '1rem' }}>
            ⚠ Faltan las variables de entorno de Supabase
          </h1>
          <p style={{ color: '#a0896d', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            La aplicación necesita conectarse a tu base de datos Supabase.
            Seguí estos pasos:
          </p>
          <ol style={{ color: '#c4a882', lineHeight: 2, paddingLeft: '1.5rem' }}>
            <li>Entrá a <strong style={{color:'#d96b1e'}}>supabase.com</strong> → tu proyecto → <strong>Settings → API</strong></li>
            <li>Copiá la <strong>Project URL</strong> y la clave <strong>anon public</strong></li>
            <li>En la carpeta del proyecto, copiá <code style={{background:'#261e14',padding:'2px 6px',borderRadius:4}}>.env.example</code> → <code style={{background:'#261e14',padding:'2px 6px',borderRadius:4}}>.env.local</code></li>
            <li>Pegá los valores en <code style={{background:'#261e14',padding:'2px 6px',borderRadius:4}}>.env.local</code></li>
            <li>Reiniciá el servidor: <code style={{background:'#261e14',padding:'2px 6px',borderRadius:4}}>Ctrl+C</code> → <code style={{background:'#261e14',padding:'2px 6px',borderRadius:4}}>npm run dev</code></li>
          </ol>
          <div style={{
            marginTop: '1.5rem', background: '#261e14', border: '1px solid #3a2e1e',
            borderRadius: '12px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.85rem', color: '#d96b1e'
          }}>
            <div style={{color:'#6a5a4a',marginBottom:'0.5rem'}}># .env.local</div>
            <div>NEXT_PUBLIC_SUPABASE_URL=https://XXXXXXXX.supabase.co</div>
            <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...</div>
          </div>
          <p style={{ color: '#6a5a4a', fontSize: '0.8rem', marginTop: '1rem' }}>
            Ver instrucciones completas en README.md del proyecto.
          </p>
        </div>
      </div>
    );
  }

  redirect('/pos');
}
