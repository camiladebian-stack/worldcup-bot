import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { formatInTimeZone } from "date-fns-tz";

const ART_TIMEZONE = "America/Argentina/Buenos_Aires";

export const timezoneCommand = new SlashCommandBuilder()
  .setName("timezone")
  .setDescription("Consulta horarios")
  .addSubcommand((sub) =>
    sub
      .setName("argentina")
      .setDescription("Muestra la hora actual en Argentina")
  );

export async function executeTimezone(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "argentina") {
    const now = new Date();
    const artTime = formatInTimeZone(now, ART_TIMEZONE, "HH:mm:ss");
    const artDate = formatInTimeZone(now, ART_TIMEZONE, "EEEE, dd 'de' MMMM 'de' yyyy");

    const embed = new EmbedBuilder()
      .setTitle("🕐 Hora en Argentina")
      .setDescription(`**${artTime}**`)
      .setColor(0x74a9d1)
      .addFields(
        {
          name: "Fecha",
          value: artDate,
          inline: true,
        },
        {
          name: "Zona horaria",
          value: "ART (UTC-3)",
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
}
