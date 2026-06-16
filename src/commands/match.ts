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
  .setDescription("Consulta partidos de la Copa Mundial")
  .addSubcommand((sub) =>
    sub.setName("today").setDescription("Partidos de hoy")
  )
  .addSubcommand((sub) =>
    sub.setName("live").setDescription("Partidos en vivo ahora")
  )
  .addSubcommand((sub) =>
    sub.setName("upcoming").setDescription("Próximos partidos")
  )
  .addSubcommand((sub) =>
    sub
      .setName("team")
      .setDescription("Partidos de un equipo")
      .addStringOption((opt) =>
        opt
          .setName("nombre")
          .setDescription("Nombre o sigla del equipo")
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
        const embed = buildScheduleEmbed(
          matches,
          "Próximos Partidos"
        );
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "team": {
        const teamName = interaction.options.getString("nombre", true);
        const matches = await api.getTeamMatches(competitionCode, teamName);
        const embed = buildTeamMatchesEmbed(matches, teamName);
        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  } catch (error: any) {
    console.error(`[Command] Error in /match ${subcommand}:`, error);
    await interaction.editReply({
      content: "❌ Error al obtener los datos. Intenta de nuevo en unos segundos.",
    });
  }
}
