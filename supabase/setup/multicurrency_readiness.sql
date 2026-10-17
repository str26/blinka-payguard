-- Read only. Available funds and current budget, not just accounting balances.
select w.currency,w.balance,w.reserved,w.available as wallet_available,b.period,b.total,b.spent,b.reserved as budget_reserved,b.available as budget_available,p.automatic_limit,p.absolute_limit,c.agent_enabled
from public.wallets w join public.companies c on c.id=w.company_id
left join public.budgets b on b.company_id=w.company_id and b.currency=w.currency and b.period=date_trunc('month',now() at time zone 'America/Bogota')::date
left join public.policies p on p.company_id=w.company_id and p.currency=w.currency and p.active
where w.company_id='10000000-0000-4000-8000-000000000001' order by w.currency;
