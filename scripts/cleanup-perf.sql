begin;
delete from payments where note = 'perf seed';
delete from invoices where number is null and subscription_id in (select id from subscriptions where number like 'SUB-PERF-%');
delete from invoices where subscription_id in (select id from subscriptions where number like 'SUB-PERF-%');
delete from subscription_lines where subscription_id in (select id from subscriptions where number like 'SUB-PERF-%');
delete from subscriptions where number like 'SUB-PERF-%';
delete from customers where email like 'perf+%@example.test';
commit;
