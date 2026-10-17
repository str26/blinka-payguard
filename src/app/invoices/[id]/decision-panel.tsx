import {getI18n} from '@/lib/i18n/server';
import { checkLabels,outcomeLabels,statusLabels } from '@/modules/invoices/domain/review';
import styles from '../../workspace.module.css';
export type DecisionView={id:string;status:string;invoice_version:number;checks:unknown;input_snapshot:unknown;created_at:string;policy_currency:string|null;policy_version:string|null;automatic_limit:string|null;absolute_limit:string|null};
export type ReservationView={currency:string;amount:string;status:string};
function obj(value:unknown):Record<string,unknown>{return value!==null && typeof value==='object' && !Array.isArray(value)?value as Record<string,unknown>:{};}
function scalar(value:unknown):string{return typeof value==='string'||typeof value==='number'?String(value):'No disponible';}
export default async function DecisionPanel({decision,version,reservation,invoiceStatus,company}:{decision:DecisionView;version:number;reservation:ReservationView|null;invoiceStatus:string;company:string}){
 const {t,locale}=await getI18n();

 const snapshot=obj(decision.input_snapshot);
 const checks=Array.isArray(decision.checks)?decision.checks.map(obj):[];
 return <section className={styles.section} aria-label={t("Decisión de las reglas")}>
  <p className={styles.eyebrow}>{t("REGLAS DE LA EMPRESA · SIMULACIÓN")}</p><h2>{t(invoiceStatus==='paid_simulated'||invoiceStatus==='cancelled'?'Última evaluación de reglas':statusLabels[decision.status]??decision.status)}</h2>
  {decision.invoice_version!==version && <p className={styles.error}>{t("Esta decisión corresponde a una versión anterior. Confirma los datos actuales para evaluarlos.")}</p>}
  <div className={styles.tableWrap}><table><thead><tr><th>{t("Regla")}</th><th>{t("Resultado")}</th><th>{t("Criterio comprobado")}</th></tr></thead><tbody>{checks.map((check,index)=><tr key={index}><th>{t(checkLabels[scalar(check.code)]??scalar(check.code))}</th><td>{t(outcomeLabels[scalar(check.outcome)]??scalar(check.outcome))}</td><td>{t(scalar(check.message))}</td></tr>)}</tbody></table></div>
  <p className={styles.note}>{t("Evaluación guardada para la versión ")}{t(decision.invoice_version)}{t(". Los criterios describen lo que comprueba cada regla; la columna Resultado indica si se cumple.")}</p>
  {decision.policy_currency && <p className={styles.note}>{t("Política v")}{t(scalar(decision.policy_version))}{t(" · Umbral automático: ")}{t(decision.policy_currency)} {t(scalar(decision.automatic_limit))}{t(" · Límite absoluto: ")}{t(decision.policy_currency)} {t(scalar(decision.absolute_limit))}{t(".")}</p>}
  <p className={styles.note}>{t("Disponibles al evaluar, antes de reservar: fondos ")}{t(scalar(snapshot.available_funds))}{t(" · presupuesto ")}{t(scalar(snapshot.available_budget))}{t(" · periodo ")}{t(scalar(snapshot.budget_period))}{t(". Importes en la moneda de la factura.")}</p>
  {reservation?.status==='active' && <p className={styles.description}>{t("Reserva activa: ")}<strong>{reservation.currency} {reservation.amount}</strong>{t(". Reduce el disponible de la wallet y del presupuesto; el saldo contable aún no se ha debitado. ")}<a className={styles.back} href={`/dashboard?company=${company}`}>{t("Ver saldos →")}</a></p>}
  {invoiceStatus==='pending_approval' && <p>{t("Requiere aprobación humana por superar el umbral automático. No se reservaron fondos con esta decisión.")}</p>}
  {invoiceStatus==='blocked' && <p>{t("La propuesta incumple al menos una regla de bloqueo. Revisa las filas marcadas «Bloquea»; no se reservaron fondos con esta decisión.")}</p>}
  {invoiceStatus==='needs_review' && <p>{t("Falta información o alguna validación. Revisa las filas marcadas «Requiere revisión».")}</p>}
 </section>;
}
