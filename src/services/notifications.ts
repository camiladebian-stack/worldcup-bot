import {
  Client,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import { Match, EventType } from "../types";
import { isEventNotified, markEventNotified } from "./database";
import {
  buildGoalEmbed,
  buildMatchStartEmbed,
  buildMatchEndEmbed,
  buildRematchEmbed,
  buildAnalysisEmbed,
} from "../utils/embeds";

export class NotificationService {
  private client: Client;
  private channelId: string;
  private roleId: string;

  constructor(client: Client, channelId: string, roleId: string) {
    this.client = client;
    this.channelId = channelId;
    this.roleId = roleId;
  }

  private getChannel(): TextChannel | null {
    const channel = this.client.channels.cache.get(this.channelId);
    if (!channel || !("send" in channel)) {
      return null;
    }
    return channel as TextChannel;
  }

  private getRoleMention(): string {
    if (!this.roleId) return "";
    return `<@&${this.roleId}>`;
  }

  private async safeSend(options: { content?: string; embeds: EmbedBuilder[] }): Promise<boolean> {
    const channel = this.getChannel();
    if (!channel) return false;
    try {
      await channel.send(options);
      return true;
    } catch (error) {
      console.error("[Notification] Failed to send message:", error);
      return false;
    }
  }

  async sendReminder(match: Match): Promise<boolean> {
    if (await isEventNotified(match.id, EventType.REMINDER)) return false;

    const roleMention = this.getRoleMention();
    const sent = await this.safeSend({
      content: roleMention ? `⏰ ${roleMention} 5 minutes to kickoff!` : undefined,
      embeds: [buildRematchEmbed(match)],
    });

    if (sent) {
      await markEventNotified(match.id, EventType.REMINDER, new Date(match.utcDate));
    }
    return sent;
  }

  async sendKickoff(match: Match): Promise<boolean> {
    if (await isEventNotified(match.id, EventType.KICKOFF)) return false;

    const roleMention = this.getRoleMention();
    const sent = await this.safeSend({
      content: roleMention ? `🏟️ ${roleMention} Match has started!` : undefined,
      embeds: [buildMatchStartEmbed(match)],
    });

    if (sent) {
      await markEventNotified(match.id, EventType.KICKOFF, new Date(match.utcDate));
    }
    return sent;
  }

  async sendGoal(match: Match): Promise<boolean> {
    if (await isEventNotified(match.id, EventType.GOAL)) return false;

    const roleMention = this.getRoleMention();
    const sent = await this.safeSend({
      content: roleMention ? `⚽ ${roleMention} GOOOAL!` : undefined,
      embeds: [buildGoalEmbed(match)],
    });

    if (sent) {
      await markEventNotified(match.id, EventType.GOAL, new Date(match.utcDate));
    }
    return sent;
  }

  async sendHalftime(match: Match): Promise<boolean> {
    if (await isEventNotified(match.id, EventType.HALFTIME)) return false;

    const home = match.score.halfTime.home ?? 0;
    const away = match.score.halfTime.away ?? 0;

    const embed = new EmbedBuilder()
      .setTitle("⏸️ Half Time")
      .setDescription(
        `**${match.homeTeam.name}** ${home} - ${away} **${match.awayTeam.name}**`
      )
      .setColor(0xfee75c)
      .setTimestamp();

    if (match.homeTeam.crest) {
      embed.setThumbnail(match.homeTeam.crest);
    }

    const sent = await this.safeSend({ embeds: [embed] });
    if (sent) {
      await markEventNotified(match.id, EventType.HALFTIME, new Date(match.utcDate));
    }
    return sent;
  }

  async sendFullTime(match: Match): Promise<boolean> {
    if (await isEventNotified(match.id, EventType.FULLTIME)) return false;

    const roleMention = this.getRoleMention();
    const sent = await this.safeSend({
      content: roleMention ? `🏁 ${roleMention} Full Time` : undefined,
      embeds: [buildMatchEndEmbed(match)],
    });

    if (sent) {
      await markEventNotified(match.id, EventType.FULLTIME, new Date(match.utcDate));
    }
    return sent;
  }

  async sendAnalysis(match: Match, analysis: string): Promise<boolean> {
    if (await isEventNotified(match.id, EventType.ANALYSIS)) return false;

    const sent = await this.safeSend({
      embeds: [buildAnalysisEmbed(match, analysis)],
    });

    if (sent) {
      await markEventNotified(match.id, EventType.ANALYSIS, new Date(match.utcDate));
    }
    return sent;
  }
}
