import { checkLabels,outcomeLabels,statusLabels } from '@/modules/invoices/domain/review';
import styles from '../../workspace.module.css';
export type DecisionView={id:string;status:string;invoice_version:number;checks:unknown;input_snapshot:unknown;created_at:string;policy_currency:string|null;policy_version:string|null;automatic_limit:string|null;absolute_limit:string|null};
export type ReservationView={currency:string;amount:string;status:string};
function obj(value:unknown):Record<string,unknown>{return value!==null && typeof value==='object' && !Array.isArray(value)?value as Record<string,unknown>:{};}
function scalar(value:unknown):string{return typeof value==='string'||typeof value==='number'?String(value):'No disponible';}
export default function DecisionPanel({decision,version,reservation}:{decision:DecisionView;version:number;reservation:ReservationView|null}){
 const snapshot=obj(decision.input_snapshot);
 const checks=Array.isArray(decision.checks)?decision.checks.map(obj):[];
 return <section className={styles.section} aria-label="Decisión de las reglas">
  <p className={styles.eyebrow}>REGLAS DE LA EMPRESA · SIMULACIÓN</p><h2>{statusLabels[decision.status]??decision.status}</h2>
  {decision.invoice_version!==version && <p className={styles.error}>Esta decisión corresponde a una versión anterior. Confirma los datos actuales para evaluarlos.</p>}
  <div className={styles.tableWrap}><table><thead><tr><th>Regla</th><th>Resultado</th><th>Criterio comprobado</th></tr></thead><tbody>{checks.map((check,index)=><tr key={index}><th>{checkLabels[scalar(check.code)]??scalar(check.code)}</th><td>{outcomeLabels[scalar(check.outcome)]??scalar(check.outcome)}</td><td>{scalar(check.message)}</td></tr>)}</tbody></table></div>
  <p className={styles.note}>Evaluación guardada para la versión {decision.invoice_version}. Los criterios describen lo que comprueba cada regla; la columna Resultado indica si se cumple.</p>
  {decision.policy_currency && <p className={styles.note}>Política v{scalar(decision.policy_version)} · Umbral automático: {decision.policy_currency} {scalar(decision.automatic_limit)} · Límite absoluto: {decision.policy_currency} {scalar(decision.absolute_limit)}.</p>}
  <p className={styles.note}>Disponibles al evaluar, antes de reservar: fondos {scalar(snapshot.available_funds)} · presupuesto {scalar(snapshot.available_budget)} · periodo {scalar(snapshot.budget_period)}. Importes en la moneda de la factura.</p>
  {reservation?.status==='active' && <p className={styles.description}>Reserva activa: <strong>{reservation.currency} {reservation.amount}</strong>. Reduce el disponible de la wallet y del presupuesto; el saldo contable aún no se ha debitado. <LinkToDashboard/></p>}
  {decision.status==='pending_approval' && <p>Requiere aprobación humana por superar el umbral automático. No se reservaron fondos con esta decisión.</p>}
  {decision.status==='blocked' && <p>La propuesta incumple al menos una regla de bloqueo. Revisa las filas marcadas «Bloquea»; no se reservaron fondos con esta decisión.</p>}
  {decision.status==='needs_review' && <p>Falta información o alguna validación. Revisa las filas marcadas «Requiere revisión».</p>}
 </section>;
}
function LinkToDashboard(){return <a className={styles.back} href="/dashboard">Ver saldos →</a>;}
