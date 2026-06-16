import {
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from "discord.js";

export interface Match {
  id: number;
  competition: { id: number; name: string; emblem: string };
  season: { id: number; startDate: string; endDate: string; currentMatchday: number };
  utcDate: string;
  status: MatchStatus;
  matchday: number;
  stage: string;
  group: string | null;
  homeTeam: Team;
  awayTeam: Team;
  score: Score;
  referees: Referee[];
}

export interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface Score {
  winner: string | null;
  duration: string;
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}

export interface Referee {
  id: number;
  name: string;
  type: string;
  nationality: string;
}

export enum MatchStatus {
  SCHEDULED = "SCHEDULED",
  TIMED = "TIMED",
  IN_PLAY = "IN_PLAY",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
  SUSPENDED = "SUSPENDED",
  POSTPONED = "POSTPONED",
  CANCELLED = "CANCELLED",
  AWARDED = "AWARDED",
}

export interface Standing {
  stage: string;
  type: string;
  group: { id: string; name: string };
  table: StandingEntry[];
}

export interface StandingEntry {
  position: number;
  team: Team;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface CommandDefinition {
  data: SlashCommandBuilder;
  execute: (...args: any[]) => Promise<void>;
}

export interface MatchEvent {
  id: string;
  matchId: number;
  type: EventType;
  notifiedAt: Date;
}

export enum EventType {
  KICKOFF = "kickoff",
  GOAL = "goal",
  HALFTIME = "halftime",
  FULLTIME = "fulltime",
  REMINDER = "reminder",
}

export interface BotConfig {
  notificationChannelId: string;
  pingRoleId: string;
  competitionCode: string;
  guildId: string;
}

export interface ApiResponse<T> {
  count: number;
  filters: Record<string, unknown>;
  resultSet: {
    count: number;
    competitions: string;
    first: string;
    last: string;
    played: number;
  };
  matches?: T[];
  match?: T;
  standings?: T[];
}
