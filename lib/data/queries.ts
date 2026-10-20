import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import type {
  AchievementProgress,
  AttemptDetails,
  AttemptRow,
  CatalogEntry,
  UserStats,
} from "./types";

/**
 * Read model for pages. Every query runs as the signed-in user: RLS limits table reads to the
 * user's own rows and the RPCs check auth.uid() themselves.
 */

export class DataError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

function fail(error: { message: string } | null): never {
  throw new DataError(error?.message ?? "unknown_error");
}

export const getCatalog = cache(async (): Promise<CatalogEntry[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quiz_catalog");
  if (error) fail(error);
  return (data ?? []) as unknown as CatalogEntry[];
});

export async function getCatalogEntry(quizId: string): Promise<CatalogEntry | null> {
  return (await getCatalog()).find((quiz) => quiz.id === quizId) ?? null;
}

/** Null when the attempt does not exist or belongs to someone else. */
export const getAttempt = cache(async (attemptId: string): Promise<AttemptDetails | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attempt", { p_attempt_id: attemptId });
  if (error) {
    if (error.message.includes("attempt_not_found")) return null;
    fail(error);
  }
  return data as unknown as AttemptDetails;
});

export interface AttemptListOptions {
  status?: AttemptRow["status"] | AttemptRow["status"][];
  quizId?: string;
  limit?: number;
}

export async function listAttempts(options: AttemptListOptions = {}): Promise<AttemptRow[]> {
  const supabase = await createClient();
  let query = supabase.from("quiz_attempts").select("*").order("started_at", { ascending: false });
  if (options.status) query = query.in("status", Array.isArray(options.status) ? options.status : [options.status]);
  if (options.quizId) query = query.eq("quiz_id", options.quizId);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) fail(error);
  return (data ?? []) as unknown as AttemptRow[];
}

export const getStats = cache(async (): Promise<UserStats> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_stats");
  if (error) fail(error);
  return data as unknown as UserStats;
});

export const getAchievements = cache(async (): Promise<AchievementProgress[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_achievements");
  if (error) fail(error);
  return (data ?? []).map((row) => ({
    ...row,
    current_value: Number(row.current_value),
    target_value: Number(row.target_value),
  }));
});

export interface XpEntry {
  amount: number;
  award_type: string;
  created_at: string;
}

export async function listXpSince(since: Date): Promise<XpEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("xp_ledger")
    .select("amount, award_type, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at");
  if (error) fail(error);
  return data ?? [];
}

/** Titles by quiz id, in one language, for lists of attempts. */
export async function quizTitles(): Promise<Record<string, Record<string, string>>> {
  return Object.fromEntries((await getCatalog()).map((quiz) => [quiz.id, quiz.titles]));
}
