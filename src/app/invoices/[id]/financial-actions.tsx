'use client';
import { useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { actionLabels,availableActions,validateAction,type FinancialAction } from '@/modules/invoices/domain/actions';
import { statusLabels } from '@/modules/invoices/domain/review';
import styles from '../../workspace.module.css';
export default function FinancialActions({id,status,role,decisionId}:{id:string;status:string;role:string;decisionId:string|null}){
 const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const pending=useRef<{fingerprint:string;request:string}|null>(null);const router=useRouter();
 const actions=availableActions(status,role,!!decisionId);
 if(!actions.length)return null;
 async function execute(action:FinancialAction){
  if(busy)return;setMessage('');
  const approval=action==='approve'||action==='reject';
  const values={action,decision_id:approval?decisionId:null,reason:approval?reason:null};
  const fingerprint=JSON.stringify(values);
  if(!pending.current||pending.current.fingerprint!==fingerprint)pending.current={fingerprint,request:crypto.randomUUID()};
  let input;
  try{input=validateAction({...values,request_id:pending.current.request});}
  catch(error){setMessage(error instanceof Error?error.message:'Revisa la solicitud.');return;}
  setBusy(true);
  try{
   const response=await fetch(`/api/invoices/${id}/actions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   const result=await response.json();
   if(!response.ok){setMessage(result.error||'No se pudo completar la acción.');router.refresh();return;}
   pending.current=null;
   setMessage(`Resultado: ${statusLabels[result.status]??result.status}.`);
   router.refresh();
  }catch{setMessage('La conexión se interrumpió. Comprueba el estado al recargar. Si reintentas sin cambiar la acción ni el motivo, se enviará la misma solicitud.');}
  finally{setBusy(false);}
 }
 return <section className={styles.section} aria-label="Acciones de la factura"><h2>Acciones</h2>
  <p className={styles.note}>Operaciones de simulación. Cada acción vuelve a comprobar permisos y estado en la base de datos.</p>
  {actions.includes('approve') && <div className={styles.form}><label htmlFor="approval-reason">Motivo para aprobar o rechazar</label><textarea id="approval-reason" value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000} rows={3} disabled={busy}/><p className={styles.note}>Aprobar revalida las reglas y reserva fondos solo si la decisión resulta autorizada. Rechazar cancela definitivamente esta factura.</p></div>}
  <div className={styles.actions}>{actions.map(action=><button key={action} className={action==='pay'||action==='approve'?styles.button:styles.secondary} disabled={busy} onClick={()=>execute(action)}>{busy?'Procesando…':actionLabels[action]}</button>)}</div>
  {actions.includes('pay') && <p className={styles.note}>El pago consume la reserva, debita la wallet y registra el gasto en el presupuesto. No mueve dinero real.</p>}
  {actions.includes('cancel') && <p className={styles.note}>Cancelar libera cualquier reserva activa y deja la factura cancelada definitivamente. No ejecuta un reembolso.</p>}
  {message && <p role="status" aria-live="polite" className={styles.note}>{message}</p>}
 </section>;
}
