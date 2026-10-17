export type ReviewInput = {
 request_id:string; version:number; supplier_id:string; agreement_id:string|null;
 invoice_number:string; currency:string; amount:string; issue_date:string; due_date:string; acknowledged:true;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function date(value:unknown):value is string {
 return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value>='1900-01-01' &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
}
export function validateReview(raw:unknown):ReviewInput {
 if(typeof raw!=='object' || raw===null || Array.isArray(raw)) throw new Error('Datos de revisión inválidos.');
 const r=raw as Record<string,unknown>;
 if(typeof r.request_id!=='string' || !uuid.test(r.request_id) || !Number.isSafeInteger(r.version) || Number(r.version)<1) throw new Error('Solicitud o versión inválida. Recarga la factura.');
 if(typeof r.supplier_id!=='string' || !uuid.test(r.supplier_id) || (r.agreement_id!==null && (typeof r.agreement_id!=='string' || !uuid.test(r.agreement_id)))) throw new Error('Selecciona un proveedor válido y revisa el acuerdo.');
 if(typeof r.invoice_number!=='string' || !r.invoice_number.trim() || r.invoice_number.length>100 || /[\x00-\x1f\x7f]/.test(r.invoice_number)) throw new Error('Revisa el número de factura (máximo 100 caracteres).');
 if(typeof r.currency!=='string' || !['USD','COP','MXN'].includes(r.currency)) throw new Error('Selecciona USD, COP o MXN.');
 if(typeof r.amount!=='string' || !/^(0|[1-9]\d{0,17})(\.\d{1,2})?$/.test(r.amount) || !/[1-9]/.test(r.amount)) throw new Error('Usa un importe positivo, sin separadores de miles y con máximo dos decimales: 800.00.');
 if(!date(r.issue_date) || !date(r.due_date) || r.due_date<r.issue_date) throw new Error('Revisa las fechas: el vencimiento no puede ser anterior a la emisión.');
 if(r.acknowledged!==true) throw new Error('Debes confirmar que revisaste los datos y las advertencias contra el original.');
 return {request_id:r.request_id,version:r.version as number,supplier_id:r.supplier_id,agreement_id:r.agreement_id as string|null,
  invoice_number:r.invoice_number.trim(),currency:r.currency,amount:r.amount,issue_date:r.issue_date,due_date:r.due_date,acknowledged:true};
}
export const statusLabels:Record<string,string>={received:'Recibida',processing:'Procesando',needs_review:'Requiere revisión',pending_approval:'Pendiente de aprobación',authorized:'Autorizada · fondos reservados',blocked:'Bloqueada',paid_simulated:'Pagada en simulación',cancelled:'Cancelada'};
export const checkLabels:Record<string,string>={REVIEW_REASONS:'Revisión humana',FIELDS:'Campos obligatorios',SUPPLIER:'Proveedor permitido',AGREEMENT:'Coincidencia con el acuerdo',POLICY:'Política de la moneda',WALLET:'Wallet de la moneda',PERIOD_BUDGET:'Presupuesto del periodo',ABSOLUTE_LIMIT:'Límite absoluto',FUNDS:'Fondos disponibles',BUDGET:'Presupuesto disponible',APPROVAL_THRESHOLD:'Umbral de autorización automática'};
export const outcomeLabels:Record<string,string>={pass:'Cumple',block:'Bloquea',review:'Requiere revisión',approval:'Requiere aprobación'};
