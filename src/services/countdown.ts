import { Client, TextChannel, Message } from "discord.js";
import { Match } from "../types";
import * as api from "./api";
import { buildCountdownEmbed } from "../utils/embeds";
import { minutesUntil } from "../utils/timezone";

export class CountdownService {
  private client: Client;
  private channelId: string;
  private competitionCode: string;
  private updateInterval: NodeJS.Timeout | null = null;
  private currentMessage: Message | null = null;
  private currentMatchId: number | null = null;
  private isRunning = false;

  constructor(client: Client, channelId: string, competitionCode: string) {
    this.client = client;
    this.channelId = channelId;
    this.competitionCode = competitionCode;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[Countdown] Starting countdown service");
    this.refresh();
    this.updateInterval = setInterval(() => this.refresh(), 60_000);
  }

  stop(): void {
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.currentMessage = null;
    this.currentMatchId = null;
    console.log("[Countdown] Stopped countdown service");
  }

  private async refresh(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const upcoming = await api.getUpcomingMatches(this.competitionCode, 1);
      const nextMatch = upcoming[0];

      if (!nextMatch) {
        await this.clearMessage();
        return;
      }

      const minutes = minutesUntil(nextMatch.utcDate);

      if (minutes <= 0) {
        await this.clearMessage();
        return;
      }

      if (nextMatch.id !== this.currentMatchId) {
        await this.clearMessage();
        await this.sendNewCountdown(nextMatch);
      } else {
        await this.updateCountdown(nextMatch);
      }
    } catch (error) {
      console.error("[Countdown] Error refreshing:", error);
    }
  }

  private async sendNewCountdown(match: Match): Promise<void> {
    const channel = this.client.channels.cache.get(this.channelId);
    if (!channel || !("send" in channel)) return;

    try {
      const message = await (channel as TextChannel).send({
        embeds: [buildCountdownEmbed(match)],
      });
      this.currentMessage = message;
      this.currentMatchId = match.id;
      console.log(`[Countdown] Posted countdown for ${match.homeTeam.tla} vs ${match.awayTeam.tla}`);
    } catch (error) {
      console.error("[Countdown] Failed to send countdown:", error);
    }
  }

  private async updateCountdown(match: Match): Promise<void> {
    if (!this.currentMessage) return;

    try {
      await this.currentMessage.edit({
        embeds: [buildCountdownEmbed(match)],
      });
    } catch (error) {
      console.error("[Countdown] Failed to update countdown:", error);
      this.currentMessage = null;
    }
  }

  private async clearMessage(): Promise<void> {
    if (this.currentMessage) {
      try {
        await this.currentMessage.delete();
      } catch {
        // message already deleted
      }
      this.currentMessage = null;
      this.currentMatchId = null;
    }
  }
}
