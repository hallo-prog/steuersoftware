import React, { ReactNode, useState } from 'react';

interface Props { children?: ReactNode }

// Lightweight functional error boundary using a try/catch render proxy.
// NOTE: This does not catch async errors or errors in event handlers – only render time.
export default function ErrorBoundary(props: Props) {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <div style={{fontFamily:'sans-serif', padding:'2rem'}}>
        <h1 style={{fontSize:'1.25rem', fontWeight:600, color:'#b91c1c'}}>Es ist ein Fehler aufgetreten</h1>
        <p style={{marginTop:'0.5rem'}}>Die Anwendung konnte nicht korrekt geladen werden. Bitte laden Sie die Seite neu oder prüfen Sie die Konsole.</p>
        <pre style={{background:'#f1f5f9', padding:'1rem', marginTop:'1rem', overflow:'auto', fontSize:'0.75rem'}}>{error.name}: {error.message}</pre>
        <button onClick={()=>window.location.reload()} style={{marginTop:'1rem', background:'#2563eb', color:'#fff', padding:'0.5rem 1rem', borderRadius:8}}>Neu laden</button>
      </div>
    );
  }

  try {
    return <>{props.children}</>;
  } catch (e) {
    console.error('Render error caught', e);
    if (e instanceof Error) setError(e);
    return null;
  }
}
