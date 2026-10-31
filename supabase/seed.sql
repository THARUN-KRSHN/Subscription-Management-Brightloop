begin;
insert into taxes (name, rate_pct)
select name, rate from (values ('GST 18%', 18), ('GST 5%', 5), ('No tax', 0)) as seed(name, rate)
where not exists (select 1 from taxes t where t.name = seed.name);
insert into payment_terms (name, due_days)
select name, days from (values ('Immediate', 0), ('Net 15', 15), ('Net 30', 30)) as seed(name, days)
where not exists (select 1 from payment_terms t where t.name = seed.name);
commit;
