export const financialActions=['evaluate','approve','reject','cancel','pay'] as const;
export type FinancialAction=typeof financialActions[number];
export type ActionInput={request_id:string;action:FinancialAction;decision_id:string|null;reason:string|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateAction(raw:unknown):ActionInput {
 if(typeof raw!=='object'||raw===null||Array.isArray(raw))throw new Error('Solicitud inválida.');
 const r=raw as Record<string,unknown>;
 if(typeof r.request_id!=='string'||!uuid.test(r.request_id))throw new Error('Falta un identificador de solicitud válido.');
 if(typeof r.action!=='string'||!financialActions.includes(r.action as FinancialAction))throw new Error('Acción no permitida.');
 if(r.action==='approve'||r.action==='reject'){
  if(typeof r.decision_id!=='string'||!uuid.test(r.decision_id))throw new Error('Falta la decisión pendiente. Recarga la factura.');
  if(typeof r.reason!=='string'||!r.reason.trim()||r.reason.length>1000)throw new Error('Escribe un motivo de 1 a 1000 caracteres.');
  return {request_id:r.request_id,action:r.action,decision_id:r.decision_id,reason:r.reason.trim()};
 }
 if(r.decision_id!==undefined&&r.decision_id!==null || r.reason!==undefined&&r.reason!==null)throw new Error('Esta acción no admite una decisión ni un motivo de aprobación.');
 return {request_id:r.request_id,action:r.action as FinancialAction,decision_id:null,reason:null};
}
export function availableActions(status:string,role:string,hasDecision:boolean):FinancialAction[]{
 if(!['needs_review','pending_approval','authorized','blocked'].includes(status)||!['admin','operator','approver'].includes(role))return [];
 const result:FinancialAction[]=['evaluate'];
 if(!['admin','approver'].includes(role))return result;
 if(status==='authorized')result.push('pay');
 if(status==='pending_approval'&&hasDecision)result.push('approve','reject');
 result.push('cancel');return result;
}
export const actionLabels:Record<FinancialAction,string>={evaluate:'Reevaluar reglas',approve:'Aprobar y reservar fondos',reject:'Rechazar factura',cancel:'Cancelar factura y liberar reserva',pay:'Ejecutar pago simulado'};
