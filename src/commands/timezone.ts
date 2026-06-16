import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { formatInTimeZone } from "date-fns-tz";

const ART_TIMEZONE = "America/Argentina/Buenos_Aires";

export const timezoneCommand = new SlashCommandBuilder()
  .setName("timezone")
  .setDescription("Check time zones")
  .addSubcommand((sub) =>
    sub
      .setName("argentina")
      .setDescription("Show current time in Argentina")
  );

export async function executeTimezone(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "argentina") {
    const now = new Date();
    const artTime = formatInTimeZone(now, ART_TIMEZONE, "HH:mm:ss");
    const artDate = formatInTimeZone(now, ART_TIMEZONE, "EEEE, MMMM dd, yyyy");

    const embed = new EmbedBuilder()
      .setTitle("🕐 Argentina Time")
      .setDescription(`**${artTime}**`)
      .setColor(0x74a9d1)
      .addFields(
        { name: "Date", value: artDate, inline: true },
        { name: "Timezone", value: "ART (UTC-3)", inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
}
