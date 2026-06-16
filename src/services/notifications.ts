import {
  Client,
  TextChannel,
  EmbedBuilder,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { Match, EventType } from "../types";
import { isEventNotified, markEventNotified } from "./database";
import {
  buildGoalEmbed,
  buildMatchStartEmbed,
  buildMatchEndEmbed,
  buildRematchEmbed,
} from "../utils/embeds";
import { minutesUntil } from "../utils/timezone";

export class NotificationService {
  private client: Client;
  private channelId: string;
  private roleId: string;

  constructor(client: Client, channelId: string, roleId: string) {
    this.client = client;
    this.channelId = channelId;
    this.roleId = roleId;
  }

  updateConfig(channelId: string, roleId: string): void {
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

  async sendReminder(match: Match): Promise<boolean> {
    if (await isEventNotified(match.id, EventType.REMINDER)) return false;

    const channel = this.getChannel();
    if (!channel) return false;

    const embed = buildRematchEmbed(match);
    const roleMention = this.getRoleMention();

    try {
      await channel.send({
        content: roleMention ? `⏰ ${roleMention} ¡Faltan 5 minutos!` : undefined,
        embeds: [embed],
      });
      await markEventNotified(match.id, EventType.REMINDER, new Date(match.utcDate));
      return true;
    } catch (error) {
      console.error("[Notification] Failed to send reminder:", error);
      return false;
    }
  }

  async sendKickoff(match: Match): Promise<boolean> {
    if (await isEventNotified(match.id, EventType.KICKOFF)) return false;

    const channel = this.getChannel();
    if (!channel) return false;

    const embed = buildMatchStartEmbed(match);
    const roleMention = this.getRoleMention();

    try {
      await channel.send({
        content: roleMention ? `🏟️ ${roleMention} ¡Comienza el partido!` : undefined,
        embeds: [embed],
      });
      await markEventNotified(match.id, EventType.KICKOFF, new Date(match.utcDate));
      return true;
    } catch (error) {
      console.error("[Notification] Failed to send kickoff:", error);
      return false;
    }
  }

  async sendGoal(match: Match): Promise<boolean> {
    if (await isEventNotified(match.id, EventType.GOAL)) return false;

    const channel = this.getChannel();
    if (!channel) return false;

    const embed = buildGoalEmbed(match);
    const roleMention = this.getRoleMention();

    try {
      await channel.send({
        content: roleMention ? `⚽ ${roleMention} ¡GOOOOOL!` : undefined,
        embeds: [embed],
      });
      await markEventNotified(match.id, EventType.GOAL, new Date(match.utcDate));
      return true;
    } catch (error) {
      console.error("[Notification] Failed to send goal:", error);
      return false;
    }
  }

  async sendHalftime(match: Match): Promise<boolean> {
    if (await isEventNotified(match.id, EventType.HALFTIME)) return false;

    const channel = this.getChannel();
    if (!channel) return false;

    const home = match.score.halfTime.home ?? 0;
    const away = match.score.halfTime.away ?? 0;

    const embed = new EmbedBuilder()
      .setTitle("⏸️ Entretiempo")
      .setDescription(
        `**${match.homeTeam.name}** ${home} - ${away} **${match.awayTeam.name}**`
      )
      .setColor(0xfee75c)
      .setTimestamp();

    if (match.homeTeam.crest) {
      embed.setThumbnail(match.homeTeam.crest);
    }

    try {
      await channel.send({ embeds: [embed] });
      await markEventNotified(match.id, EventType.HALFTIME, new Date(match.utcDate));
      return true;
    } catch (error) {
      console.error("[Notification] Failed to send halftime:", error);
      return false;
    }
  }

  async sendFullTime(match: Match): Promise<boolean> {
    if (await isEventNotified(match.id, EventType.FULLTIME)) return false;

    const channel = this.getChannel();
    if (!channel) return false;

    const embed = buildMatchEndEmbed(match);
    const roleMention = this.getRoleMention();

    try {
      await channel.send({
        content: roleMention ? `🏁 ${roleMention} Partido finalizado` : undefined,
        embeds: [embed],
      });
      await markEventNotified(match.id, EventType.FULLTIME, new Date(match.utcDate));
      return true;
    } catch (error) {
      console.error("[Notification] Failed to send fulltime:", error);
      return false;
    }
  }

  async sendRaw(embed: EmbedBuilder, content?: string): Promise<boolean> {
    const channel = this.getChannel();
    if (!channel) return false;

    try {
      await channel.send({ content, embeds: [embed] });
      return true;
    } catch (error) {
      console.error("[Notification] Failed to send message:", error);
      return false;
    }
  }
}
