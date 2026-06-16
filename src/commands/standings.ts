import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import * as api from "../services/api";
import { buildStandingsEmbed } from "../utils/embeds";

export const standingsCommand = new SlashCommandBuilder()
  .setName("standings")
  .setDescription("Show group standings");

export async function executeStandings(
  interaction: ChatInputCommandInteraction,
  competitionCode: string
): Promise<void> {
  await interaction.deferReply();

  try {
    const standings = await api.getStandings(competitionCode);
    if (standings.length === 0) {
      await interaction.editReply({
        content: "No standings available.",
      });
      return;
    }

    const competitionName = standings[0]?.group?.name || "World Cup";
    const embed = buildStandingsEmbed(standings, competitionName);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("[Command] Error in /standings:", error);
    await interaction.editReply({
      content: "❌ Error fetching standings.",
    });
  }
}
