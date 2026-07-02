-- Drop the 50-row cap from insert_qris_history. Now only prunes rows older
-- than 14 days. The row-count cap was removed per user requirement — history
-- can grow arbitrarily within the 14-day window.
create or replace function public.insert_qris_history(
  p_type          text,
  p_qr_value      text,
  p_qr_data_url   text,
  p_merchant_name text,
  p_mpan          text,
  p_merchant_id   text,
  p_amount        text
) returns public.qris_history
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.qris_history;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.qris_history
    (user_id, type, qr_value, qr_data_url, merchant_name, mpan, merchant_id, amount)
  values
    (v_user, p_type, p_qr_value, p_qr_data_url, p_merchant_name, p_mpan, p_merchant_id, p_amount)
  returning * into v_row;

  -- Only prune by age — no row-count cap.
  delete from public.qris_history
   where user_id = v_user
     and created_at < now() - interval '14 days';

  return v_row;
end;
$$;

revoke all on function public.insert_qris_history(text, text, text, text, text, text, text) from public, anon;
grant  execute on function public.insert_qris_history(text, text, text, text, text, text, text) to authenticated;
