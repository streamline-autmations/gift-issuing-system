-- Add DELETE policies for operators so they can delete their own company's data.
-- Previously only superadmin had DELETE access (via "for all" policies).

create policy issuings_operator_delete
on public.issuings
for delete
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy gift_slots_operator_delete
on public.gift_slots
for delete
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy gift_options_operator_delete
on public.gift_options
for delete
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy employees_operator_delete
on public.employees
for delete
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy employee_slots_operator_delete
on public.employee_slots
for delete
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy issued_records_operator_delete
on public.issued_records
for delete
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy issued_selections_operator_delete
on public.issued_selections
for delete
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);
