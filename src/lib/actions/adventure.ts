"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";
import type { AnswerResult, CollectResult, Person, TeamMessage } from "@/lib/adventure/types";

const ID = /^[0-9a-f-]{36}$/;
const bad = () => ({ ok: false as const, error: friendlyError("not_found") });

/** Start (or switch to) a collection. Adventure is optional: nothing happens until someone chooses it. */
export async function joinAdventure(slug: string, teamId?: string | null): Promise<ActionResult> {
  if (teamId && !ID.test(teamId)) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adv_join", { p_slug: slug, p_team: teamId ?? null });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/adventure", "layout"); revalidatePath("/wall", "layout");
  return { ok: true };
}

export async function pauseAdventure(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("adv_pause");
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/adventure", "layout"); revalidatePath("/wall", "layout");
  return { ok: true };
}

export async function answerRiddle(riddleId: string, answer: string): Promise<ActionResult<{ result: AnswerResult }>> {
  if (!ID.test(riddleId)) return bad();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adv_answer", { p_riddle: riddleId, p_answer: answer.slice(0, 80) });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/adventure", "layout"); revalidatePath("/wall", "layout");
  return { ok: true, result: data as AnswerResult };
}

export async function collectObject(objectId: string, teamId: string | null): Promise<ActionResult<{ result: CollectResult }>> {
  if (!ID.test(objectId) || (teamId && !ID.test(teamId))) return bad();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adv_collect", { p_object: objectId, p_team: teamId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/adventure", "layout");
  return { ok: true, result: data as CollectResult };
}

export async function createTeam(slug: string, name: string, invitees: string[]): Promise<ActionResult<{ id: string }>> {
  if (invitees.some((i) => !ID.test(i))) return bad();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adv_team_create", { p_slug: slug, p_name: name, p_invitees: invitees });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/adventure", "layout"); revalidatePath("/wall", "layout");
  return { ok: true, id: data as string };
}

export async function inviteToTeam(teamId: string, users: string[]): Promise<ActionResult> {
  if (!ID.test(teamId) || users.some((i) => !ID.test(i))) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adv_team_invite", { p_team: teamId, p_users: users });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/adventure/team/${teamId}`);
  return { ok: true };
}

export async function respondToInvite(teamId: string, accept: boolean): Promise<ActionResult> {
  if (!ID.test(teamId)) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adv_team_respond", { p_team: teamId, p_accept: accept });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/adventure", "layout");
  return { ok: true };
}

export async function leaveTeam(teamId: string): Promise<ActionResult> {
  if (!ID.test(teamId)) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adv_team_leave", { p_team: teamId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/adventure", "layout"); revalidatePath("/wall", "layout");
  return { ok: true };
}

export async function sendTeamMessage(teamId: string, body: string): Promise<ActionResult> {
  if (!ID.test(teamId)) return bad();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adv_team_send", { p_team: teamId, p_body: body });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}

/** Polled by the open chat. Reading also marks the chat as read. */
export async function fetchTeamMessages(teamId: string): Promise<ActionResult<{ messages: TeamMessage[] }>> {
  if (!ID.test(teamId)) return bad();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adv_team_messages_get", { p_team: teamId });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, messages: data as TeamMessage[] };
}

export async function fetchFireReactors(type: string, id: string): Promise<ActionResult<{ people: Person[] }>> {
  if (!ID.test(id) || !["post", "answer", "reply"].includes(type)) return bad();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fire_reactors", { p_type: type, p_id: id });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, people: data as Person[] };
}
