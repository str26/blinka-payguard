/** Pure decision policy. Inputs must be assembled from trusted server-side records.
 * A result is a proposal: persistence must recheck and reserve funds atomically.
 */
export type Currency = 'USD' | 'COP' | 'MXN';
export type DecisionStatus = 'authorized' | 'blocked' | 'needs_review' | 'pending_approval';
export type Check = { code: string; outcome: 'pass' | 'block' | 'review' | 'approval'; message: string };
export type InvoiceInput = {
  supplierId: string | null;
  invoiceNumber: string | null;
  currency: string | null;
  amount: string | null;
  dueDate: string | null;
};
export type EvaluationContext = {
  policyVersion: string;
  currency: Currency;
  automaticLimit: string;
  absoluteLimit: string;
  availableFunds: string;
  availableBudget: string;
  supplierAllowed: boolean;
  duplicate: 'none' | 'suspected' | 'confirmed';
  agreement: 'matches' | 'mismatch' | 'missing';
};
export type Decision = {
  status: DecisionStatus;
  policyVersion: string;
  checks: Check[];
  amountMinor: string | null;
  currency: string | null;
};

/** Explicit decimal input only. No floating point, exponent notation or locale guessing. */
export function parseMoney(value: string): bigint {
  if (!/^(0|[1-9]\d{0,14})(\.\d{1,2})?$/.test(value)) throw new Error('Invalid decimal amount');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
function validDate(value: string | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function evaluateInvoice(invoice: InvoiceInput, context: EvaluationContext): Decision {
  if (!context.policyVersion.trim()) throw new Error('Policy version is required');
  if (!['USD', 'COP', 'MXN'].includes(context.currency)) throw new Error('Unsupported policy currency');
  if (typeof context.supplierAllowed !== 'boolean' || !['none','suspected','confirmed'].includes(context.duplicate)
    || !['matches','mismatch','missing'].includes(context.agreement)) throw new Error('Invalid trusted context');
  const automatic = parseMoney(context.automaticLimit);
  const absolute = parseMoney(context.absoluteLimit);
  const funds = parseMoney(context.availableFunds);
  const budget = parseMoney(context.availableBudget);
  if (absolute <= 0n || automatic > absolute) throw new Error('Invalid policy limits');
  const checks: Check[] = [];
  const add = (code: string, outcome: Check['outcome'], message: string) => checks.push({ code, outcome, message });
  let amount: bigint | null = null;
  try { amount = invoice.amount === null ? null : parseMoney(invoice.amount); } catch { /* Review malformed extraction. */ }
  if (!invoice.supplierId?.trim() || !invoice.invoiceNumber?.trim() || !invoice.currency?.trim() || amount === null || amount <= 0n || !validDate(invoice.dueDate)) {
    add('INVALID_FIELDS', 'review', 'Hay campos obligatorios ausentes, ambiguos o inválidos.');
  } else add('VALID_FIELDS', 'pass', 'Los campos obligatorios tienen formato válido.');

  if (context.duplicate === 'confirmed') add('DUPLICATE', 'block', 'La factura ya está registrada como duplicada.');
  else if (context.duplicate === 'suspected') add('POSSIBLE_DUPLICATE', 'review', 'Existe una posible coincidencia que necesita revisión.');
  else add('NO_DUPLICATE', 'pass', 'No se identificó un duplicado en la comprobación del servidor.');

  if (!context.supplierAllowed) add('SUPPLIER_NOT_ALLOWED', 'block', 'El beneficiario no está autorizado; requiere su alta antes de reevaluar.');
  else add('SUPPLIER_ALLOWED', 'pass', 'El beneficiario está autorizado.');
  if (context.agreement === 'mismatch') add('AGREEMENT_MISMATCH', 'block', 'La factura difiere de lo acordado; debe corregirse o actualizarse el acuerdo autorizado.');
  else if (context.agreement === 'missing') add('AGREEMENT_MISSING', 'review', 'No existe información suficiente para verificar el acuerdo.');
  else add('AGREEMENT_MATCHES', 'pass', 'La factura coincide con el acuerdo comprobado por el servidor.');

  if (invoice.currency !== context.currency) {
    add('CURRENCY_MISMATCH', 'review', 'No existe un contexto de fondos y política para esta moneda; no se realiza conversión implícita.');
  } else if (amount !== null && amount > 0n) {
    add('ABSOLUTE_LIMIT', amount > absolute ? 'block' : 'pass', amount > absolute ? 'Supera el límite absoluto por operación.' : 'Cumple el límite absoluto por operación.');
    add('FUNDS', amount > funds ? 'block' : 'pass', amount > funds ? 'Fondos disponibles insuficientes.' : 'Fondos disponibles suficientes en la instantánea evaluada.');
    add('BUDGET', amount > budget ? 'block' : 'pass', amount > budget ? 'Presupuesto disponible insuficiente.' : 'Presupuesto disponible suficiente en la instantánea evaluada.');
    add('APPROVAL_THRESHOLD', amount > automatic ? 'approval' : 'pass', amount > automatic ? 'Requiere aprobación humana por superar el umbral automático.' : 'Cumple el umbral de autorización automática.');
  }
  const status: DecisionStatus = checks.some(c => c.outcome === 'block') ? 'blocked'
    : checks.some(c => c.outcome === 'review') ? 'needs_review'
    : checks.some(c => c.outcome === 'approval') ? 'pending_approval' : 'authorized';
  return { status, policyVersion: context.policyVersion, checks, amountMinor: amount?.toString() ?? null, currency: invoice.currency };
}
