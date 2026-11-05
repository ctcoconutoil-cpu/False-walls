import { createClient } from "@/lib/supabase/server";
import type { BookShelf, Collection, Overview, Person, ProfileAdventure, Rewards, TeamDetail, TeamMessage, MazeAdventure } from "@/lib/adventure/types";

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) return null;
  return data as T;
}

export const getOverview = () => rpc<Overview>("adv_overview");
export const getCollection = (slug: string) => rpc<Collection>("adv_collection", { p_slug: slug });
export const getBook = () => rpc<BookShelf[]>("adv_book");
export const getRewards = () => rpc<Rewards>("adv_rewards");
export const getTeam = (id: string) => rpc<TeamDetail>("adv_team_detail", { p_team: id });
export const getTeamMessages = (id: string) => rpc<TeamMessage[]>("adv_team_messages_get", { p_team: id });
export const getFriends = (team?: string) => rpc<(Person & { id: string })[]>("adv_friends", { p_team: team ?? null });
export const getMazeAdventure = (area: string) => rpc<MazeAdventure | null>("adv_maze", { p_area: area });
export const getProfileAdventure = (userId: string) => rpc<ProfileAdventure>("adv_profile", { p_user: userId });
export const getFireReactors = (type: string, id: string) => rpc<Person[]>("fire_reactors", { p_type: type, p_id: id });
