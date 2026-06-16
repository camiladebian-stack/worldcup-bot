import { Match, Standing, MatchStatus, ApiResponse } from "../types";
import { parseISO } from "date-fns";

const BASE_URL = "https://api.football-data.org/v4";

let apiKey = "";

export function setApiKey(key: string): void {
  apiKey = key;
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": apiKey,
    },
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After") || "60";
    throw new Error(`RATE_LIMITED:${retryAfter}`);
  }

  if (!response.ok) {
    throw new Error(`API_ERROR:${response.status}:${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function getTodayMatches(competitionCode: string): Promise<Match[]> {
  const data = await fetchApi<ApiResponse<Match>>(
    `/competitions/${competitionCode}/matches?status=SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED`
  );
  const allMatches = data.matches || [];

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  return allMatches.filter((match) => {
    const matchDate = new Date(match.utcDate).toISOString().split("T")[0];
    return matchDate === todayStr;
  });
}

export async function getLiveMatches(competitionCode: string): Promise<Match[]> {
  const data = await fetchApi<ApiResponse<Match>>(
    `/competitions/${competitionCode}/matches?status=IN_PLAY,PAUSED`
  );
  return data.matches || [];
}

export async function getUpcomingMatches(
  competitionCode: string,
  limit: number = 20
): Promise<Match[]> {
  const now = new Date().toISOString();
  const data = await fetchApi<ApiResponse<Match>>(
    `/competitions/${competitionCode}/matches?status=SCHEDULED,TIMED`
  );
  const matches = (data.matches || [])
    .filter((m) => new Date(m.utcDate) > new Date())
    .sort(
      (a, b) =>
        new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );
  return matches.slice(0, limit);
}

export async function getTeamMatches(
  competitionCode: string,
  teamName: string
): Promise<Match[]> {
  const data = await fetchApi<ApiResponse<Match>>(
    `/competitions/${competitionCode}/matches?status=SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED`
  );
  const matches = data.matches || [];
  const query = teamName.toLowerCase();

  return matches.filter(
    (m) =>
      m.homeTeam.name.toLowerCase().includes(query) ||
      m.awayTeam.name.toLowerCase().includes(query) ||
      m.homeTeam.tla.toLowerCase().includes(query) ||
      m.awayTeam.tla.toLowerCase().includes(query) ||
      m.homeTeam.shortName.toLowerCase().includes(query) ||
      m.awayTeam.shortName.toLowerCase().includes(query)
  );
}

export async function getMatchById(
  competitionCode: string,
  matchId: number
): Promise<Match | null> {
  try {
    const match = await fetchApi<Match>(
      `/competitions/${competitionCode}/matches/${matchId}`
    );
    return match;
  } catch {
    return null;
  }
}

export async function getStandings(
  competitionCode: string
): Promise<Standing[]> {
  const data = await fetchApi<ApiResponse<Standing>>(
    `/competitions/${competitionCode}/standings`
  );
  return data.standings || [];
}

export async function getAllActiveMatches(
  competitionCode: string
): Promise<Match[]> {
  const data = await fetchApi<ApiResponse<Match>>(
    `/competitions/${competitionCode}/matches?status=SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED`
  );
  return data.matches || [];
}
