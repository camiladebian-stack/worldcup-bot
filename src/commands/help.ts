import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { buildHelpEmbed } from "../utils/embeds";

export const helpCommand = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show bot help");

export async function executeHelp(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const embed = buildHelpEmbed();
  await interaction.reply({ embeds: [embed] });
}
