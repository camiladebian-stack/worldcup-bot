import { Match, MatchStatus, EventType } from "../types";
import { NotificationService } from "./notifications";
import * as api from "./api";
import { cleanupOldEvents, isEventNotified } from "./database";
import { minutesUntil } from "../utils/timezone";

export class PollingService {
  private notificationService: NotificationService;
  private competitionCode: string;
  private pollInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastScores: Map<number, string> = new Map();

  constructor(notificationService: NotificationService, competitionCode: string) {
    this.notificationService = notificationService;
    this.competitionCode = competitionCode;
  }

  updateConfig(notificationService: NotificationService, competitionCode: string): void {
    this.notificationService = notificationService;
    this.competitionCode = competitionCode;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[Polling] Starting match polling service");

    this.poll();
    this.pollInterval = setInterval(() => this.poll(), 30_000);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    console.log("[Polling] Stopped match polling service");
  }

  private async poll(): Promise<void> {
    try {
      const allMatches = await api.getAllActiveMatches(this.competitionCode);
      const liveMatches = allMatches.filter(
        (m) => m.status === MatchStatus.IN_PLAY || m.status === MatchStatus.PAUSED
      );

      for (const match of liveMatches) {
        await this.processLiveMatch(match);
      }

      const upcomingMatches = allMatches.filter(
        (m) =>
          (m.status === MatchStatus.SCHEDULED || m.status === MatchStatus.TIMED) &&
          minutesUntil(m.utcDate) <= 6 &&
          minutesUntil(m.utcDate) >= -2
      );

      for (const match of upcomingMatches) {
        await this.processPreMatch(match);
      }

      const finishedMatches = allMatches.filter(
        (m) => m.status === MatchStatus.FINISHED
      );

      for (const match of finishedMatches) {
        await this.processFinishedMatch(match);
      }

      if (Math.random() < 0.01) {
        await cleanupOldEvents(7);
      }
    } catch (error: any) {
      if (typeof error?.message === "string" && error.message.startsWith("RATE_LIMITED:")) {
        const retryAfter = parseInt(error.message.split(":")[1]) || 60;
        console.warn(`[Polling] Rate limited, backing off ${retryAfter}s`);
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = setTimeout(() => {
            this.pollInterval = setInterval(() => this.poll(), 30_000);
            this.poll();
          }, retryAfter * 1000) as unknown as NodeJS.Timeout;
        }
      } else {
        console.error("[Polling] Error during poll:", error);
      }
    }
  }

  private async processPreMatch(match: Match): Promise<void> {
    const minutes = minutesUntil(match.utcDate);

    if (minutes <= 5 && minutes >= -2) {
      const kickoffNotified = await isEventNotified(match.id, EventType.KICKOFF);
      const reminderNotified = await isEventNotified(match.id, EventType.REMINDER);

      if (!reminderNotified && minutes > 0) {
        await this.notificationService.sendReminder(match);
      }

      if (!kickoffNotified && minutes <= 0) {
        await this.notificationService.sendKickoff(match);
      }
    }
  }

  private async processLiveMatch(match: Match): Promise<void> {
    const kickoffNotified = await isEventNotified(match.id, EventType.KICKOFF);
    if (!kickoffNotified) {
      await this.notificationService.sendKickoff(match);
    }

    const currentScoreKey = `${match.score.fullTime.home ?? 0}-${match.score.fullTime.away ?? 0}`;
    const previousScoreKey = this.lastScores.get(match.id);

    if (previousScoreKey && previousScoreKey !== currentScoreKey) {
      const goalNotified = await isEventNotified(match.id, EventType.GOAL);
      if (!goalNotified) {
        await this.notificationService.sendGoal(match);
      }
    }

    this.lastScores.set(match.id, currentScoreKey);

    if (match.status === MatchStatus.PAUSED) {
      const halftimeNotified = await isEventNotified(match.id, EventType.HALFTIME);
      if (!halftimeNotified) {
        await this.notificationService.sendHalftime(match);
      }
    }
  }

  private async processFinishedMatch(match: Match): Promise<void> {
    const fulltimeNotified = await isEventNotified(match.id, EventType.FULLTIME);
    if (!fulltimeNotified) {
      await this.notificationService.sendFullTime(match);
    }
    this.lastScores.delete(match.id);
  }
}
