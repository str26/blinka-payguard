export const fieldLabels = {
  invoice_number: 'Número de factura', supplier_name: 'Proveedor', supplier_code: 'Código del proveedor',
  agreement_reference: 'Referencia del acuerdo', amount: 'Total por pagar', currency: 'Moneda',
  issue_date: 'Fecha de emisión', due_date: 'Fecha de vencimiento',
} as const;
export type FieldName = keyof typeof fieldLabels;
export const fieldNames = Object.keys(fieldLabels) as FieldName[];
export type ExtractedField = { value: string | null; evidence: string | null };
export type Extraction = { fields: Record<FieldName, ExtractedField>; warnings: string[] };
export const MAX_FILE_SIZE = 3 * 1024 * 1024;
export function detectMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-') return 'application/pdf';
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  return null;
}
function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function text(value: unknown, max: number): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > max) throw new Error('INVALID_EXTRACTION');
  return value.trim() || null;
}
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0,4)) >= 1900 &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
// Model output is untrusted. Money stays a decimal string; missing evidence discards a value.
export function validateExtraction(raw: unknown): Extraction {
  if (!object(raw) || !object(raw.fields) || !Array.isArray(raw.warnings) || raw.warnings.length > 20) throw new Error('INVALID_EXTRACTION');
  const warnings = raw.warnings.map(v => text(v, 300)).filter((v): v is string => !!v);
  const fields = {} as Extraction['fields'];
  for (const key of fieldNames) {
    const field = raw.fields[key];
    if (!object(field)) throw new Error('INVALID_EXTRACTION');
    let value = text(field.value, 200);
    const evidence = text(field.evidence, 500);
    if (value && !evidence) { warnings.push(`${fieldLabels[key]}: valor sin evidencia; requiere revisión.`); value = null; }
    if (value && key === 'amount') {
      if (!/^(0|[1-9]\d{0,17})(\.\d{1,2})?$/.test(value) || !/[1-9]/.test(value)) {
        warnings.push('Importe inválido o ambiguo; requiere revisión.'); value = null;
      } else { const [whole, decimals = ''] = value.split('.'); value = `${whole}.${decimals.padEnd(2,'0')}`; }
    }
    if (value && key === 'currency' && !['USD','COP','MXN'].includes(value)) { warnings.push('Moneda no admitida o ambigua.'); value = null; }
    if (value && (key === 'issue_date' || key === 'due_date') && !validDate(value)) { warnings.push(`${fieldLabels[key]} inválida.`); value = null; }
    if (!value) warnings.push(`${fieldLabels[key]}: no confirmado.`);
    fields[key] = { value, evidence };
  }
  return { fields, warnings: [...new Set(warnings)] };
}
export function extractionSchema() {
  const field = { type: 'object', properties: { value: { type: ['string','null'] }, evidence: { type: ['string','null'] } }, required: ['value','evidence'], additionalProperties: false };
  return { type: 'object', properties: {
    fields: { type:'object', properties: Object.fromEntries(fieldNames.map(key => [key,field])), required: fieldNames, additionalProperties: false },
    warnings: { type:'array', items:{type:'string'}, maxItems:20 },
  }, required:['fields','warnings'], additionalProperties:false };
}
