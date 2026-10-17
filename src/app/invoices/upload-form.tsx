'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../workspace.module.css';
export default function UploadForm({company}:{company:string}) {
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const router=useRouter();
  return <form className={styles.form} onSubmit={async event=>{
    event.preventDefault(); if(busy) return;
    const form=new FormData(event.currentTarget); const file=form.get('file');
    if(!(file instanceof File) || file.size>3*1024*1024 || !file.size) {setMessage('Selecciona un archivo de hasta 3 MiB.');return;}
    setBusy(true);setMessage('Guardando archivo en Storage privado…');
    let id:string|undefined;
    try {
      const upload=await fetch(`/api/invoices?company=${encodeURIComponent(company)}`,{method:'POST',body:form});
      const saved=await upload.json();if(!upload.ok) throw new Error(saved.error || 'No se pudo subir el archivo.');
      id=saved.id;
      setMessage(saved.duplicate?'Archivo existente. Verificando la extracción…':'Gemini está leyendo la factura…');
      // A separate request keeps upload failures independent of model latency.
      await fetch(`/api/invoices/${id}/extract`,{method:'POST'});
    } catch(error) {setMessage(error instanceof Error?error.message:'Falló la conexión. Puedes reintentar.');}
    finally {setBusy(false);if(id) {router.push(`/invoices/${id}`);router.refresh();}}
  }}>
    <label htmlFor="file">Factura de prueba · PDF, PNG o JPEG · hasta 3 MiB</label>
    <input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" required disabled={busy}/>
    <button className={styles.button} disabled={busy}>{busy?'Procesando…':'Subir y extraer con Gemini'}</button>
    <p role="status" aria-live="polite" className={styles.note}>{message}</p>
  </form>;
}
