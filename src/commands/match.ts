import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import * as api from "../services/api";
import {
  buildTodayEmbed,
  buildLiveEmbed,
  buildScheduleEmbed,
  buildTeamMatchesEmbed,
} from "../utils/embeds";

export const matchCommand = new SlashCommandBuilder()
  .setName("match")
  .setDescription("Look up World Cup matches")
  .addSubcommand((sub) =>
    sub.setName("today").setDescription("Today's matches")
  )
  .addSubcommand((sub) =>
    sub.setName("live").setDescription("Matches live right now")
  )
  .addSubcommand((sub) =>
    sub.setName("upcoming").setDescription("Upcoming matches")
  )
  .addSubcommand((sub) =>
    sub
      .setName("team")
      .setDescription("Matches for a specific team")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Team name or abbreviation")
          .setRequired(true)
      )
  );

export async function executeMatch(
  interaction: ChatInputCommandInteraction,
  competitionCode: string
): Promise<void> {
  await interaction.deferReply();

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case "today": {
        const matches = await api.getTodayMatches(competitionCode);
        const embed = buildTodayEmbed(matches);
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "live": {
        const matches = await api.getLiveMatches(competitionCode);
        const embed = buildLiveEmbed(matches);
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "upcoming": {
        const matches = await api.getUpcomingMatches(competitionCode);
        const embed = buildScheduleEmbed(matches, "Upcoming Matches");
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "team": {
        const teamName = interaction.options.getString("name", true);
        const matches = await api.getTeamMatches(competitionCode, teamName);
        const embed = buildTeamMatchesEmbed(matches, teamName);
        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  } catch (error: any) {
    console.error(`[Command] Error in /match ${subcommand}:`, error);
    await interaction.editReply({
      content: "❌ Error fetching data. Please try again in a few seconds.",
    });
  }
}
