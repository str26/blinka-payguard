import test from 'node:test';
import assert from 'node:assert/strict';
import {liquidityAlerts} from '../.test-build-invoices/liquidity.js';
const checks=[{code:'FUNDS',outcome:'block'}];
const snapshot={invoice:{amount:'1500.00',currency:'USD'},available_funds:'1300.00',available_budget:'4000.00'};
test('wallet 1300 and invoice 1500 report exact USD 200 shortfall',()=>{
 assert.deepEqual(liquidityAlerts(checks,snapshot),['Fondos insuficientes. Requerido: USD 1500.00. Disponible: USD 1300.00. Faltante: USD 200.00. No se ejecutó el pago.']);
});
test('existing whole-number JSON snapshots are supported',()=>assert.match(liquidityAlerts(checks,{...snapshot,invoice:{amount:1500,currency:'USD'}})[0],/Faltante: USD 200.00/));
test('budget shortage is separate from sufficient wallet funds',()=>{
 const s={...snapshot,available_funds:'5000.00',available_budget:'1300.00'};
 assert.match(liquidityAlerts([{code:'FUNDS',outcome:'pass'},{code:'BUDGET',outcome:'block'}],s)[0],/^Presupuesto insuficiente.*USD 200.00/);
});
test('decimal subtraction is exact and preserves currency',()=>{
 assert.match(liquidityAlerts(checks,{invoice:{amount:'100000000000000001.01',currency:'MXN'},available_funds:'100000000000000000.99'})[0],/Faltante: MXN 0.02/);
});
test('passing checks never raise alerts',()=>assert.deepEqual(liquidityAlerts([{code:'FUNDS',outcome:'pass'}],snapshot),[]));
test('invalid or contradictory snapshot never invents monetary values',()=>{
 for(const s of [null,{}, {...snapshot,available_funds:'2000.00'}, {...snapshot,invoice:{amount:Infinity,currency:'USD'}}])assert.match(liquidityAlerts(checks,s)[0],/Reevalúa las reglas/);
});
