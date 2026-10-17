import {getI18n} from '@/lib/i18n/server';
import styles from '../../workspace.module.css';
export type AgentRunView={id:string;state:string;source:string;actor_id:string;steps:unknown;reasons:unknown;created_at:string};
const states:Record<string,string>={paid:'El agente ejecutó el pago simulado',review:'El agente solicita revisión humana',pending_approval:'El agente espera aprobación humana',disabled:'Agente sin habilitar',closed:'Factura cerrada'};
const tools:Record<string,string>={gemini_extraction:'Extracción con Gemini',identify_and_validate:'Identificación y validación',evaluate_rules:'Reglas de pago',pay_simulated:'Ejecución del pago',human_approval:'Aprobación humana',confirmed_data:'Datos de la factura',resume:'Reanudación'};
const outcomes:Record<string,string>={pass:'Completado',review:'Revisión humana',approval:'Aprobación humana',skipped:'No ejecutado'};
function object(v:unknown):Record<string,unknown>{return v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};}
function text(v:unknown){return typeof v==='string'?v:'Sin información';}
export default async function AgentPanel({run}:{run:AgentRunView}){
 const {t,locale}=await getI18n();

 const steps=Array.isArray(run.steps)?run.steps.map(object):[];const reasons=Array.isArray(run.reasons)?run.reasons.filter((v):v is string=>typeof v==='string'):[];
 return <section className={styles.section} aria-label={t("Ejecución del agente")}><p className={styles.eyebrow}>{t("AGENTE PAYGUARD · SIMULACIÓN")}</p><h2>{t(states[run.state]??run.state)}</h2>
  <div className={styles.tableWrap}><table><thead><tr><th>{t("Paso / herramienta")}</th><th>{t("Resultado")}</th><th>{t("Detalle")}</th></tr></thead><tbody>{steps.map((step,i)=><tr key={i}><th>{t(tools[text(step.tool)]??text(step.tool))}</th><td>{t(outcomes[text(step.outcome)]??text(step.outcome))}</td><td>{t(text(step.message))}</td></tr>)}</tbody></table></div>
  {reasons.length>0&&<ul>{reasons.map((reason,i)=><li key={i}>{t(reason)}</li>)}</ul>}
  <p className={styles.note}>{t("Ejecución: ")}{run.id}{t(" · Solicitada por: ")}{t(run.actor_id)}{t(" · ")}{t(new Date(run.created_at).toLocaleString(locale==='en'?'en-US':'es-CO',{timeZone:'America/Bogota'}))}{t(" (Colombia). El agente aplica las reglas; Gemini no puede elegir cuentas ni modificar saldos.")}</p>
 </section>;
}
