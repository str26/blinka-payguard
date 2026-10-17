import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateInvoice, parseMoney } from '../.test-build/evaluate-invoice.js';
const invoice = { supplierId: 'vendor-1', invoiceNumber: 'INV-001', currency: 'USD', amount: '800.00', dueDate: '2026-10-31' };
const context = { policyVersion: 'v1', currency: 'USD', automaticLimit: '1000.00', absoluteLimit: '3000.00', availableFunds: '5000.00', availableBudget: '4000.00', supplierAllowed: true, duplicate: 'none', agreement: 'matches' };
const cases = [
 ['valid invoice', {}, {}, 'authorized'],
 ['automatic threshold inclusive', {amount:'1000.00'}, {}, 'authorized'],
 ['above automatic threshold', {amount:'1000.01'}, {}, 'pending_approval'],
 ['absolute threshold inclusive', {amount:'3000.00'}, {}, 'pending_approval'],
 ['above absolute limit', {amount:'3000.01'}, {}, 'blocked'],
 ['insufficient funds', {}, {availableFunds:'799.99'}, 'blocked'],
 ['insufficient budget', {}, {availableBudget:'799.99'}, 'blocked'],
 ['exact available balance', {}, {availableFunds:'800',availableBudget:'800'}, 'authorized'],
 ['new beneficiary', {}, {supplierAllowed:false}, 'blocked'],
 ['duplicate', {}, {duplicate:'confirmed'}, 'blocked'],
 ['suspected duplicate', {}, {duplicate:'suspected'}, 'needs_review'],
 ['agreement missing', {}, {agreement:'missing'}, 'needs_review'],
 ['agreement mismatch', {}, {agreement:'mismatch'}, 'blocked'],
 ['missing currency', {currency:null}, {}, 'needs_review'],
 ['different currency', {currency:'COP'}, {}, 'needs_review'],
 ['ambiguous decimal', {amount:'1,250'}, {}, 'needs_review'],
 ['zero amount', {amount:'0'}, {}, 'needs_review'],
 ['negative amount', {amount:'-10'}, {}, 'needs_review'],
 ['missing amount', {amount:null}, {}, 'needs_review'],
 ['impossible date', {dueDate:'2026-02-30'}, {}, 'needs_review'],
 ['missing due date', {dueDate:null}, {}, 'needs_review'],
 ['review takes priority over approval', {amount:'2000'}, {agreement:'missing'}, 'needs_review'],
 ['block takes priority over approval', {amount:'2000'}, {supplierAllowed:false}, 'blocked'],
 ['block takes priority over incomplete fields', {amount:null}, {duplicate:'confirmed'}, 'blocked'],
 ['COP independent budget', {currency:'COP'}, {currency:'COP'}, 'authorized'],
 ['MXN independent budget', {currency:'MXN'}, {currency:'MXN'}, 'authorized'],
];
for (const [name, fields, overrides, expected] of cases) test(name, () => {
 const decision = evaluateInvoice({...invoice,...fields},{...context,...overrides});
 assert.equal(decision.status, expected);
 assert.equal(decision.policyVersion,'v1');
 assert.ok(decision.checks.every(c => c.code && c.message));
});
test('exact decimal arithmetic',()=>assert.equal(parseMoney('0.10')+parseMoney('0.20'),parseMoney('0.30')));
test('reject invalid money representations',()=>{
 for(const value of ['NaN','Infinity','1e3','1.001',' 1','01','1,00','-1']) assert.throws(()=>parseMoney(value));
});
test('invalid policy fails closed',()=>assert.throws(()=>evaluateInvoice(invoice,{...context,automaticLimit:'4000'})));
test('invalid context fails closed',()=>assert.throws(()=>evaluateInvoice(invoice,{...context,agreement:'unknown'})));
test('evaluation is deterministic and does not mutate inputs',()=>{
 const first = evaluateInvoice(Object.freeze({...invoice}),Object.freeze({...context}));
 assert.deepEqual(evaluateInvoice(invoice,context),first);
 assert.equal(first.amountMinor,'80000');
});
test('authorization implies all checks pass across boundaries',()=>{
 for(const amount of ['0.01','799.99','800','1000','1000.01','3000','3000.01'])
 for(const funds of ['0','800','5000'])
 for(const budget of ['0','800','4000']){
  const d=evaluateInvoice({...invoice,amount},{...context,availableFunds:funds,availableBudget:budget});
  if(d.status==='authorized'){
   assert.ok(d.checks.every(c=>c.outcome==='pass'));
   assert.ok(parseMoney(amount)<=parseMoney(funds));
   assert.ok(parseMoney(amount)<=parseMoney(budget));
   assert.ok(parseMoney(amount)<=parseMoney(context.automaticLimit));
  }
 }
});
