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
      return "🔴 LIVE";
    case MatchStatus.PAUSED:
      return "⏸️ HALF TIME";
    case MatchStatus.FINISHED:
      return "✅ FINISHED";
    case MatchStatus.SCHEDULED:
    case MatchStatus.TIMED:
      return "⏰ SCHEDULED";
    case MatchStatus.POSTPONED:
      return "❌ POSTPONED";
    case MatchStatus.CANCELLED:
      return "🚫 CANCELLED";
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
  if (match.status === MatchStatus.SCHEDULED || match.status === MatchStatus.TIMED) {
    return "vs";
  }

  const home = match.score.fullTime.home ?? 0;
  const away = match.score.fullTime.away ?? 0;

  if (match.status === MatchStatus.IN_PLAY || match.status === MatchStatus.PAUSED) {
    const htHome = match.score.halfTime.home ?? 0;
    const htAway = match.score.halfTime.away ?? 0;
    return `**${home}** - **${away}** (HT: ${htHome}-${htAway})`;
  }

  return `**${home}** - **${away}**`;
}

export function buildMatchEmbed(match: Match): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${match.homeTeam.tla} vs ${match.awayTeam.tla}`)
    .setDescription(statusEmoji(match.status))
    .setColor(statusColor(match.status))
    .addFields(
      { name: match.homeTeam.name, value: match.homeTeam.tla, inline: true },
      { name: scoreLine(match), value: "\u200B", inline: true },
      { name: match.awayTeam.name, value: match.awayTeam.tla, inline: true }
    )
    .setTimestamp();

  if (match.homeTeam.crest) {
    embed.setThumbnail(match.homeTeam.crest);
  }

  if (match.status === MatchStatus.SCHEDULED || match.status === MatchStatus.TIMED) {
    embed.addFields({
      name: "Kickoff (Argentina)",
      value: `\`${toArgentinaDateTime(match.utcDate)}\` (${formatCountdown(match.utcDate)})`,
      inline: false,
    });
  }

  if (match.group) {
    embed.addFields({ name: "Group", value: match.group, inline: true });
  }

  if (match.matchday) {
    embed.addFields({ name: "Matchday", value: `${match.matchday}`, inline: true });
  }

  if (match.stage && match.stage !== "GROUP_STAGE") {
    embed.addFields({
      name: "Stage",
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
    .setTitle("⚽ GOOOAL!")
    .setDescription(
      `**${match.homeTeam.name}** ${home} - ${away} **${match.awayTeam.name}**`
    )
    .setColor(0x00ff00)
    .setTimestamp();

  if (scorer) {
    embed.addFields({ name: "Scored by", value: scorer, inline: true });
  }

  embed.addFields({
    name: "Time",
    value: `${toArgentinaTime(match.utcDate)} ART`,
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
    .setDescription("Match starts in **5 minutes**")
    .setColor(COLORS.scheduled)
    .addFields(
      { name: "Kickoff (Argentina)", value: `\`${toArgentinaTime(match.utcDate)}\``, inline: true },
      { name: "Competition", value: match.competition.name, inline: true }
    )
    .setThumbnail(match.homeTeam.crest)
    .setTimestamp();
}

export function buildMatchStartEmbed(match: Match): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🏟️ Match Started!")
    .setDescription(`**${match.homeTeam.name}** vs **${match.awayTeam.name}**`)
    .setColor(COLORS.live)
    .addFields({
      name: "Status",
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
    .setTitle("🏁 Full Time")
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
    .setTitle(`📊 Standings - ${competitionName}`)
    .setColor(COLORS.default)
    .setTimestamp();

  for (const standing of standings) {
    if (standing.table.length === 0) continue;

    const lines = standing.table.map(
      (entry) =>
        `\`${entry.position.toString().padStart(2)}\` **${entry.team.tla}** | ${entry.playedGames}P ${entry.won}W ${entry.draw}D ${entry.lost}L | **${entry.points}**pts | ${entry.goalsFor}:${entry.goalsAgainst} (${entry.goalDifference > 0 ? "+" : ""}${entry.goalDifference})`
    );

    embed.addFields({
      name: standing.group.name || standing.group.id,
      value: lines.join("\n"),
      inline: false,
    });
  }

  return embed;
}

export function buildScheduleEmbed(matches: Match[], title: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(COLORS.scheduled)
    .setTimestamp();

  if (matches.length === 0) {
    embed.setDescription("No upcoming matches scheduled.");
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
    .setTitle("📅 Today's Matches (Argentina)")
    .setColor(COLORS.scheduled)
    .setTimestamp();

  if (matches.length === 0) {
    embed.setDescription("No matches today.");
    return embed;
  }

  const lines = matches.map((match) => {
    const time = toArgentinaTime(match.utcDate);
    let status: string;

    switch (match.status) {
      case MatchStatus.IN_PLAY:
        const h = match.score.fullTime.home ?? 0;
        const a = match.score.fullTime.away ?? 0;
        status = `🔴 LIVE **${h}-${a}**`;
        break;
      case MatchStatus.PAUSED:
        const hh = match.score.halfTime.home ?? 0;
        const ah = match.score.halfTime.away ?? 0;
        status = `⏸️ HT **${hh}-${ah}**`;
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
    .setTitle("🔴 Live Matches")
    .setColor(COLORS.live)
    .setTimestamp();

  if (matches.length === 0) {
    embed.setDescription("No live matches right now.");
    return embed;
  }

  const lines = matches.map((match) => {
    const home = match.score.fullTime.home ?? 0;
    const away = match.score.fullTime.away ?? 0;
    const status = match.status === MatchStatus.PAUSED ? " (HT)" : "";
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
    .setTitle(`⚽ Matches for ${teamName}`)
    .setColor(COLORS.scheduled)
    .setTimestamp();

  if (matches.length === 0) {
    embed.setDescription(`No matches found for ${teamName}.`);
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
    .setTitle("🏆 World Cup Bot - Commands")
    .setDescription("Real-time FIFA World Cup match updates bot")
    .setColor(COLORS.default)
    .addFields(
      { name: "/match today", value: "Show all of today's matches", inline: false },
      { name: "/match live", value: "Show matches currently live", inline: false },
      { name: "/match upcoming", value: "Show upcoming scheduled matches", inline: false },
      { name: "/match [team]", value: "Search matches for a specific team", inline: false },
      { name: "/standings", value: "Show current group standings", inline: false },
      { name: "/timezone argentina", value: "Show current time in Argentina (ART)", inline: false },
      { name: "/help", value: "Show this help message", inline: false }
    )
    .setFooter({ text: "All times shown in Argentina time (ART)" });
}
