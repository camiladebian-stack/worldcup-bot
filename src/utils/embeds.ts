import { EmbedBuilder, ColorResolvable } from "discord.js";
import { Match, MatchStatus, Standing } from "../types";
import { toArgentinaTime, toArgentinaDateTime, formatCountdown } from "./timezone";

const COLORS: Record<string, ColorResolvable> = {
  live: 0xff4500,
  scheduled: 0x5865f2,
  finished: 0x57f287,
  halftime: 0xfee75c,
  default: 0x2f3136,
};

function statusEmoji(status: MatchStatus): string {
  switch (status) {
    case MatchStatus.IN_PLAY:
      return "🔴 EN VIVO";
    case MatchStatus.PAUSED:
      return "⏸️ ENTRETIEMPO";
    case MatchStatus.FINISHED:
      return "✅ FINALIZADO";
    case MatchStatus.SCHEDULED:
    case MatchStatus.TIMED:
      return "⏰ PROGRAMADO";
    case MatchStatus.POSTPONED:
      return "❌ POSTERGADO";
    case MatchStatus.CANCELLED:
      return "🚫 CANCELADO";
    default:
      return status;
  }
}

function statusColor(status: MatchStatus): ColorResolvable {
  switch (status) {
    case MatchStatus.IN_PLAY:
      return COLORS.live;
    case MatchStatus.PAUSED:
      return COLORS.halftime;
    case MatchStatus.FINISHED:
      return COLORS.finished;
    default:
      return COLORS.scheduled;
  }
}

function scoreLine(match: Match): string {
  const home = match.score.fullTime.home ?? 0;
  const away = match.score.fullTime.away ?? 0;

  if (match.status === MatchStatus.SCHEDULED || match.status === MatchStatus.TIMED) {
    return "vs";
  }

  if (match.status === MatchStatus.IN_PLAY || match.status === MatchStatus.PAUSED) {
    const htHome = match.score.halfTime.home ?? 0;
    const htAway = match.score.halfTime.away ?? 0;
    return `**${home}** - **${away}** (ET: ${htHome}-${htAway})`;
  }

  return `**${home}** - **${away}**`;
}

export function buildMatchEmbed(match: Match): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${match.homeTeam.tla} vs ${match.awayTeam.tla}`)
    .setDescription(statusEmoji(match.status))
    .setColor(statusColor(match.status))
    .addFields(
      {
        name: match.homeTeam.name,
        value: match.homeTeam.tla,
        inline: true,
      },
      {
        name: scoreLine(match),
        value: "\u200B",
        inline: true,
      },
      {
        name: match.awayTeam.name,
        value: match.awayTeam.tla,
        inline: true,
      }
    )
    .setTimestamp();

  if (match.homeTeam.crest) {
    embed.setThumbnail(match.homeTeam.crest);
  }

  if (match.status === MatchStatus.SCHEDULED || match.status === MatchStatus.TIMED) {
    embed.addFields({
      name: "Horario (Argentina)",
      value: `\`${toArgentinaDateTime(match.utcDate)}\` (${formatCountdown(match.utcDate)})`,
      inline: false,
    });
  }

  if (match.group) {
    embed.addFields({
      name: "Grupo",
      value: match.group,
      inline: true,
    });
  }

  if (match.matchday) {
    embed.addFields({
      name: "Fecha",
      value: `${match.matchday}`,
      inline: true,
    });
  }

  if (match.stage && match.stage !== "GROUP_STAGE") {
    embed.addFields({
      name: "Fase",
      value: match.stage.replace(/_/g, " "),
      inline: true,
    });
  }

  return embed;
}

export function buildGoalEmbed(match: Match, scorer?: string): EmbedBuilder {
  const home = match.score.fullTime.home ?? 0;
  const away = match.score.fullTime.away ?? 0;

  const embed = new EmbedBuilder()
    .setTitle("⚽ ¡GOOOOOL!")
    .setDescription(
      `**${match.homeTeam.name}** ${home} - ${away} **${match.awayTeam.name}**`
    )
    .setColor(0x00ff00)
    .setTimestamp();

  if (scorer) {
    embed.addFields({ name: "Gol de", value: scorer, inline: true });
  }

  embed.addFields({
    name: "Minuto",
    value: `${toArgentinaTime(match.utcDate)}`,
    inline: true,
  });

  if (match.homeTeam.crest) {
    embed.setThumbnail(match.homeTeam.crest);
  }

  return embed;
}

export function buildRematchEmbed(match: Match): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`⚽ ${match.homeTeam.name} vs ${match.awayTeam.name}`)
    .setDescription("El partido comienza en **5 minutos**")
    .setColor(COLORS.scheduled)
    .addFields(
      {
        name: "Horario (Argentina)",
        value: `\`${toArgentinaTime(match.utcDate)}\``,
        inline: true,
      },
      {
        name: "Competición",
        value: match.competition.name,
        inline: true,
      }
    )
    .setThumbnail(match.homeTeam.crest)
    .setTimestamp();
}

export function buildMatchStartEmbed(match: Match): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`🏟️ ¡Comienza el partido!`)
    .setDescription(`**${match.homeTeam.name}** vs **${match.awayTeam.name}**`)
    .setColor(COLORS.live)
    .addFields({
      name: "Estado",
      value: statusEmoji(MatchStatus.IN_PLAY),
      inline: true,
    })
    .setThumbnail(match.homeTeam.crest)
    .setTimestamp();
}

export function buildMatchEndEmbed(match: Match): EmbedBuilder {
  const home = match.score.fullTime.home ?? 0;
  const away = match.score.fullTime.away ?? 0;

  const embed = new EmbedBuilder()
    .setTitle(`🏁 Partido Finalizado`)
    .setDescription(
      `**${match.homeTeam.name}** ${home} - ${away} **${match.awayTeam.name}**`
    )
    .setColor(COLORS.finished)
    .setTimestamp();

  if (match.homeTeam.crest) {
    embed.setThumbnail(match.homeTeam.crest);
  }

  return embed;
}

export function buildStandingsEmbed(
  standings: Standing[],
  competitionName: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📊 Clasificación - ${competitionName}`)
    .setColor(COLORS.default)
    .setTimestamp();

  for (const standing of standings) {
    if (standing.table.length === 0) continue;

    const lines = standing.table.map(
      (entry) =>
        `\`${entry.position.toString().padStart(2)}\` **${entry.team.tla}** | ${entry.playedGames}PJ ${entry.won}G ${entry.draw}E ${entry.lost}P | **${entry.points}**pts | ${entry.goalsFor}:${entry.goalsAgainst} (${entry.goalDifference > 0 ? "+" : ""}${entry.goalDifference})`
    );

    embed.addFields({
      name: standing.group.name || standing.group.id,
      value: lines.join("\n"),
      inline: false,
    });
  }

  return embed;
}

export function buildScheduleEmbed(
  matches: Match[],
  title: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(COLORS.scheduled)
    .setTimestamp();

  if (matches.length === 0) {
    embed.setDescription("No hay partidos programados.");
    return embed;
  }

  const lines = matches.map((match) => {
    const time = toArgentinaTime(match.utcDate);
    const countdown = formatCountdown(match.utcDate);
    return `\`${time}\` ${match.homeTeam.tla} vs ${match.awayTeam.tla} (${countdown})`;
  });

  embed.setDescription(lines.join("\n"));
  return embed;
}

export function buildTodayEmbed(matches: Match[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("📅 Partidos de Hoy (Argentina)")
    .setColor(COLORS.scheduled)
    .setTimestamp();

  if (matches.length === 0) {
    embed.setDescription("No hay partidos hoy.");
    return embed;
  }

  const lines = matches.map((match) => {
    const time = toArgentinaTime(match.utcDate);
    let status: string;

    switch (match.status) {
      case MatchStatus.IN_PLAY:
        const h = match.score.fullTime.home ?? 0;
        const a = match.score.fullTime.away ?? 0;
        status = `🔴 EN VIVO **${h}-${a}**`;
        break;
      case MatchStatus.PAUSED:
        const hh = match.score.halfTime.home ?? 0;
        const ah = match.score.halfTime.away ?? 0;
        status = `⏸️ ET **${hh}-${ah}**`;
        break;
      case MatchStatus.FINISHED:
        const fh = match.score.fullTime.home ?? 0;
        const fa = match.score.fullTime.away ?? 0;
        status = `✅ **${fh}-${fa}**`;
        break;
      default:
        status = `⏰ ${formatCountdown(match.utcDate)}`;
    }

    return `\`${time}\` ${match.homeTeam.tla} vs ${match.awayTeam.tla} ${status}`;
  });

  embed.setDescription(lines.join("\n"));
  return embed;
}

export function buildLiveEmbed(matches: Match[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("🔴 Partidos en Vivo")
    .setColor(COLORS.live)
    .setTimestamp();

  if (matches.length === 0) {
    embed.setDescription("No hay partidos en vivo ahora mismo.");
    return embed;
  }

  const lines = matches.map((match) => {
    const home = match.score.fullTime.home ?? 0;
    const away = match.score.fullTime.away ?? 0;
    const status =
      match.status === MatchStatus.PAUSED ? " (Entretiempo)" : "";
    return `**${match.homeTeam.tla}** **${home}** - **${away}** **${match.awayTeam.tla}**${status}`;
  });

  embed.setDescription(lines.join("\n"));
  return embed;
}

export function buildTeamMatchesEmbed(
  matches: Match[],
  teamName: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`⚽ Partidos de ${teamName}`)
    .setColor(COLORS.scheduled)
    .setTimestamp();

  if (matches.length === 0) {
    embed.setDescription(`No se encontraron partidos para ${teamName}.`);
    return embed;
  }

  const lines = matches.map((match) => {
    const time = toArgentinaDateTime(match.utcDate);
    let result: string;

    switch (match.status) {
      case MatchStatus.FINISHED:
        const h = match.score.fullTime.home ?? 0;
        const a = match.score.fullTime.away ?? 0;
        result = `✅ ${h}-${a}`;
        break;
      case MatchStatus.IN_PLAY:
      case MatchStatus.PAUSED:
        const ih = match.score.fullTime.home ?? 0;
        const ia = match.score.fullTime.away ?? 0;
        result = `🔴 ${ih}-${ia}`;
        break;
      default:
        result = `⏰ ${formatCountdown(match.utcDate)}`;
    }

    return `\`${time}\` ${match.homeTeam.tla} vs ${match.awayTeam.tla} ${result}`;
  });

  embed.setDescription(lines.join("\n"));
  return embed;
}

export function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🏆 World Cup Bot - Comandos")
    .setDescription("Bot de actualización en tiempo real de la Copa Mundial FIFA")
    .setColor(COLORS.default)
    .addFields(
      {
        name: "/match today",
        value: "Muestra todos los partidos de hoy",
        inline: false,
      },
      {
        name: "/match live",
        value: "Muestra los partidos que están en vivo ahora",
        inline: false,
      },
      {
        name: "/match upcoming",
        value: "Muestra los próximos partidos programados",
        inline: false,
      },
      {
        name: "/match [team]",
        value: "Busca partidos de un equipo específico",
        inline: false,
      },
      {
        name: "/standings",
        value: "Muestra la tabla de posiciones actual",
        inline: false,
      },
      {
        name: "/timezone argentina",
        value: "Muestra la hora actual en Argentina (ART)",
        inline: false,
      },
      {
        name: "/help",
        value: "Muestra esta ayuda",
        inline: false,
      }
    )
    .setFooter({ text: "Todos los horarios están en hora Argentina (ART)" });
}
