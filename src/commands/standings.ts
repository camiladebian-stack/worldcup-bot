import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import * as api from "../services/api";
import { buildStandingsEmbed } from "../utils/embeds";

export const standingsCommand = new SlashCommandBuilder()
  .setName("standings")
  .setDescription("Muestra la tabla de posiciones");

export async function executeStandings(
  interaction: ChatInputCommandInteraction,
  competitionCode: string
): Promise<void> {
  await interaction.deferReply();

  try {
    const standings = await api.getStandings(competitionCode);
    if (standings.length === 0) {
      await interaction.editReply({
        content: "No hay clasificación disponible.",
      });
      return;
    }

    const competitionName = standings[0]?.group?.name || "Copa Mundial";
    const embed = buildStandingsEmbed(standings, competitionName);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("[Command] Error in /standings:", error);
    await interaction.editReply({
      content: "❌ Error al obtener la clasificación.",
    });
  }
}
