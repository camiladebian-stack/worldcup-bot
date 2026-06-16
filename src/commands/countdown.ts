import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
} from "discord.js";
import { Match } from "../types";
import * as api from "../services/api";
import { toArgentinaTime, formatCountdown, minutesUntil } from "../utils/timezone";

const COLORS = {
  scheduled: 0x5865f2,
  default: 0x2f3136,
};

const activeCountdowns = new Map<string, NodeJS.Timeout>();

function buildCountdownEmbed(matches: Match[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("⏳ Next Matches — Live Countdown")
    .setColor(COLORS.scheduled)
    .setTimestamp();

  if (matches.length === 0) {
    embed.setDescription("No upcoming matches scheduled.");
    return embed;
  }

  const lines = matches.map((match) => {
    const time = toArgentinaTime(match.utcDate);
    const countdown = formatCountdown(match.utcDate);
    const minutes = minutesUntil(match.utcDate);

    let status: string;
    if (minutes <= 0) {
      status = "🔴 Starting now!";
    } else if (minutes < 60) {
      status = `⏱️ ${countdown}`;
    } else {
      status = `⏰ ${countdown}`;
    }

    return `**${match.homeTeam.name}** vs **${match.awayTeam.name}**\n\`${time}\` ART — ${status}`;
  });

  embed.setDescription(lines.join("\n\n"));
  return embed;
}

export const countdownCommand = new SlashCommandBuilder()
  .setName("countdown")
  .setDescription("Show live countdown for next 3 matches");

export async function executeCountdown(
  interaction: ChatInputCommandInteraction,
  competitionCode: string
): Promise<void> {
  const key = `${interaction.guildId}:${interaction.channelId}`;

  if (activeCountdowns.has(key)) {
    clearInterval(activeCountdowns.get(key)!);
    activeCountdowns.delete(key);
  }

  const upcoming = await api.getUpcomingMatches(competitionCode, 3);

  const reply = await interaction.reply({
    embeds: [buildCountdownEmbed(upcoming)],
    fetchReply: true,
  });

  if (upcoming.length === 0) return;

  const interval = setInterval(async () => {
    try {
      const refreshed = await api.getUpcomingMatches(competitionCode, 3);
      await reply.edit({ embeds: [buildCountdownEmbed(refreshed)] }).catch(() => {});

      if (refreshed.length === 0 || minutesUntil(refreshed[0].utcDate) <= 0) {
        clearInterval(interval);
        activeCountdowns.delete(key);
      }
    } catch {
      clearInterval(interval);
      activeCountdowns.delete(key);
    }
  }, 60_000);

  activeCountdowns.set(key, interval);
}
