-- Signed-out visitors can read public content but must not call member or staff RPCs.
revoke execute on function
  public.create_post(text,text,text,text,uuid,text,text,text,text,text,boolean,boolean,boolean,text,text,jsonb,jsonb,uuid,uuid,uuid),
  public.edit_post(uuid,text,text,text,text),
  public.send_question(uuid,text,boolean),
  public.answer_question(uuid,text,boolean),
  public.set_answer_public(uuid,boolean),
  public.reject_question(uuid),
  public.delete_question(uuid),
  public.block_question_sender(uuid),
  public.post_reply(uuid,text,uuid,uuid),
  public.set_reaction(text,uuid,text),
  public.report_content(text,uuid,text,text),
  public.vote_poll(uuid,int),
  public.poll_results(uuid),
  public.reveal_post(uuid),
  public.record_discovery(text,text),
  public.complete_onboarding(text,text,text,text,text,text,text[],date),
  public.my_blocks(),
  public.unblock_ref(uuid),
  public.admin_stats(),
  public.admin_upsert_badge(text,text,text,text,int,boolean),
  public.admin_upsert_prompt(uuid,text,boolean),
  public.mod_dismiss_report(uuid,text),
  public.mod_get_question_sender(uuid),
  public.mod_remove_content(text,uuid,uuid,text),
  public.mod_restore_content(text,uuid,text),
  public.mod_set_role(uuid,text),
  public.mod_set_user_status(uuid,text,text),
  public.mod_suppress_trending(uuid,boolean)
from public, anon;

alter function public.set_updated_at() set search_path = public;
alter function public.has_contact_info(text) set search_path = public;
