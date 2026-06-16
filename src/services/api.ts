import { Match, Standing, ApiResponse } from "../types";

const BASE_URL = "https://api.football-data.org/v4";
const REQUEST_TIMEOUT = 15_000;

let apiKey = "";

export function setApiKey(key: string): void {
  apiKey = key;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2_000;

async function fetchApi<T>(endpoint: string, retries = MAX_RETRIES): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        headers: { "X-Auth-Token": apiKey },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "60") * 1000;
        if (attempt < retries) {
          console.warn(`[API] Rate limited, retrying in ${retryAfter / 1000}s...`);
          await new Promise((r) => setTimeout(r, retryAfter));
          continue;
        }
        throw new Error(`RATE_LIMITED:${retryAfter / 1000}`);
      }

      if (response.status >= 500 && attempt < retries) {
        console.warn(`[API] Server error ${response.status}, retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }

      if (!response.ok) {
        throw new Error(`API_ERROR:${response.status}:${response.statusText}`);
      }

      return response.json() as Promise<T>;
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === "AbortError" && attempt < retries) {
        console.warn(`[API] Request timeout, retrying...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`API_ERROR: Max retries exceeded for ${endpoint}`);
}

export async function getTodayMatches(competitionCode: string): Promise<Match[]> {
  const data = await fetchApi<ApiResponse<Match>>(
    `/competitions/${competitionCode}/matches?status=SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED`
  );
  const allMatches = data.matches || [];
  const todayStr = new Date().toISOString().split("T")[0];

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
  const data = await fetchApi<ApiResponse<Match>>(
    `/competitions/${competitionCode}/matches?status=SCHEDULED,TIMED`
  );
  const matches = (data.matches || [])
    .filter((m) => new Date(m.utcDate) > new Date())
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
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

export async function getStandings(competitionCode: string): Promise<Standing[]> {
  const data = await fetchApi<ApiResponse<Standing>>(
    `/competitions/${competitionCode}/standings`
  );
  return data.standings || [];
}

export async function getAllActiveMatches(competitionCode: string): Promise<Match[]> {
  const data = await fetchApi<ApiResponse<Match>>(
    `/competitions/${competitionCode}/matches?status=SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED`
  );
  return data.matches || [];
}
