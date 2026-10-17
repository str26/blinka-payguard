'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../workspace.module.css';
export default function RetryButton({id}:{id:string}) {
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const router=useRouter();
  return <div><button className={styles.button} disabled={busy} onClick={async()=>{
    setBusy(true);setError('');
    try {const res=await fetch(`/api/invoices/${id}/extract`,{method:'POST'});const body=await res.json();if(!res.ok)setError(body.error || 'No se pudo extraer.');}
    catch{setError('Falló la conexión. Vuelve a cargar para comprobar el estado.');}
    finally{setBusy(false);router.refresh();}
  }}>{busy?'Extrayendo…':'Extraer / reintentar'}</button><p role="status" className={styles.error}>{error}</p></div>;
}
