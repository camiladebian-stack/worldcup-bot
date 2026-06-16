import { Match, MatchStatus, EventType } from "../types";
import { NotificationService } from "./notifications";
import * as api from "./api";
import { generateMatchAnalysis, AIProviderConfig } from "./ai";
import { cleanupOldEvents, isEventNotified } from "./database";
import { minutesUntil } from "../utils/timezone";

export class PollingService {
  private notificationService: NotificationService;
  private competitionCode: string;
  private aiConfig: AIProviderConfig;
  private pollInterval: NodeJS.Timeout | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastScores = new Map<number, string>();
  private initializedScores = new Set<number>();

  constructor(notificationService: NotificationService, competitionCode: string, aiConfig: AIProviderConfig) {
    this.notificationService = notificationService;
    this.competitionCode = competitionCode;
    this.aiConfig = aiConfig;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[Polling] Starting match polling service");
    this.schedulePoll(0);
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.lastScores.clear();
    this.initializedScores.clear();
    console.log("[Polling] Stopped match polling service");
  }

  private schedulePoll(delayMs: number): void {
    if (!this.isRunning) return;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (delayMs > 0) {
      this.retryTimeout = setTimeout(() => {
        this.retryTimeout = null;
        this.poll();
        this.pollInterval = setInterval(() => this.poll(), 30_000);
      }, delayMs);
    } else {
      this.poll();
      this.pollInterval = setInterval(() => this.poll(), 30_000);
    }
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

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
        this.schedulePoll(retryAfter * 1000);
      } else {
        console.error("[Polling] Error during poll:", error);
      }
    }
  }

  private async processPreMatch(match: Match): Promise<void> {
    const minutes = minutesUntil(match.utcDate);
    if (minutes > 5 || minutes < -2) return;

    if (minutes > 0) {
      await this.notificationService.sendReminder(match);
    } else if (minutes <= 0) {
      await this.notificationService.sendKickoff(match);
    }
  }

  private async processLiveMatch(match: Match): Promise<void> {
    await this.notificationService.sendKickoff(match);

    const scoreKey = `${match.score.fullTime.home ?? 0}-${match.score.fullTime.away ?? 0}`;

    if (!this.initializedScores.has(match.id)) {
      this.initializedScores.add(match.id);
      this.lastScores.set(match.id, scoreKey);
      return;
    }

    const previousScore = this.lastScores.get(match.id);
    if (previousScore && previousScore !== scoreKey) {
      await this.notificationService.sendGoal(match);
    }

    this.lastScores.set(match.id, scoreKey);

    if (match.status === MatchStatus.PAUSED) {
      await this.notificationService.sendHalftime(match);
    }
  }

  private async processFinishedMatch(match: Match): Promise<void> {
    await this.notificationService.sendFullTime(match);
    this.lastScores.delete(match.id);
    this.initializedScores.delete(match.id);

    if (this.aiConfig.groqApiKey || this.aiConfig.openrouterApiKey) {
      generateMatchAnalysis(match, this.aiConfig)
        .then((analysis) => this.notificationService.sendAnalysis(match, analysis))
        .catch((err) => console.error("[Polling] Failed to generate analysis:", err));
    }
  }
}
