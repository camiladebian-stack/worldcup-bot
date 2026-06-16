import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Collection,
  Events,
  ChatInputCommandInteraction,
} from "discord.js";
import express from "express";
import dotenv from "dotenv";

import { setApiKey } from "./services/api";
import { askAI } from "./services/ai";
import {
  initializePool,
  initializeDatabase,
  closePool,
} from "./services/database";
import { NotificationService } from "./services/notifications";
import { PollingService } from "./services/polling";
import { matchCommand, executeMatch } from "./commands/match";
import { timezoneCommand, executeTimezone } from "./commands/timezone";
import { helpCommand, executeHelp } from "./commands/help";
import { standingsCommand, executeStandings } from "./commands/standings";

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const GUILD_ID = process.env.GUILD_ID!;
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY!;
const DATABASE_URL = process.env.DATABASE_URL!;
const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID!;
const PING_ROLE_ID = process.env.PING_ROLE_ID || "";
const COMPETITION_CODE = process.env.COMPETITION_CODE || "WC";
const AI_API_KEY = process.env.AI_API_KEY || "";
const PORT = parseInt(process.env.PORT || "3000", 10);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let notificationService: NotificationService;
let pollingService: PollingService;

const commands = new Collection<string, (interaction: ChatInputCommandInteraction) => Promise<void>>();

commands.set("match", (interaction) => executeMatch(interaction, COMPETITION_CODE));
commands.set("timezone", executeTimezone);
commands.set("help", executeHelp);
commands.set("standings", (interaction) => executeStandings(interaction, COMPETITION_CODE));

async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  const commandData = [
    matchCommand.toJSON(),
    timezoneCommand.toJSON(),
    helpCommand.toJSON(),
    standingsCommand.toJSON(),
  ];

  console.log("[Bot] Registering slash commands...");

  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commandData,
  });

  console.log("[Bot] Slash commands registered");
}

function setupHealthCheck(): void {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/", (_req, res) => {
    res.json({
      name: "worldcup-discord-bot",
      status: "running",
    });
  });

  app.listen(PORT, () => {
    console.log(`[Health] Health check server running on port ${PORT}`);
  });
}

async function initializeBot(): Promise<void> {
  console.log("[Bot] Initializing...");

  setApiKey(FOOTBALL_API_KEY);

  initializePool(DATABASE_URL);
  await initializeDatabase();

  notificationService = new NotificationService(
    client,
    NOTIFICATION_CHANNEL_ID,
    PING_ROLE_ID
  );

  pollingService = new PollingService(notificationService, COMPETITION_CODE);
}

async function main(): Promise<void> {
  setupHealthCheck();
  await initializeBot();
  await registerCommands();

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({
        content: "Unknown command.",
        ephemeral: true,
      });
      return;
    }

    try {
      await command(interaction);
    } catch (error) {
      console.error(`[Bot] Error executing command ${interaction.commandName}:`, error);
      const reply = {
        content: "❌ An error occurred while executing the command.",
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith("!ask ")) return;
    if (!AI_API_KEY) return;

    const question = message.content.slice(5).trim();
    if (!question) {
      await message.reply("Usage: `!ask <your question>`");
      return;
    }

    try {
      await message.channel.sendTyping();
      const answer = await askAI(question, AI_API_KEY);

      if (answer.length > 2000) {
        const buffer = Buffer.from(answer, "utf-8");
        await message.reply({
          content: "Response too long, here's the full text:",
          files: [{ attachment: buffer, name: "response.txt" }],
        });
      } else {
        await message.reply(answer);
      }
    } catch (error: any) {
      console.error("[Bot] AI error:", error);
      await message.reply("❌ Error getting AI response. Please try again.");
    }
  });

  client.once(Events.ClientReady, async (c) => {
    console.log(`[Bot] Logged in as ${c.user.tag}`);
    console.log(`[Bot] Competition code: ${COMPETITION_CODE}`);
    console.log(`[Bot] Notification channel: ${NOTIFICATION_CHANNEL_ID}`);

    pollingService.start();
    console.log("[Bot] Polling service started");
  });

  client.on(Events.Error, (error) => {
    console.error("[Bot] Client error:", error);
  });

  client.on(Events.ShardDisconnect, () => {
    console.warn("[Bot] Disconnected from Discord");
  });

  client.on(Events.ShardReconnecting, () => {
    console.log("[Bot] Reconnecting to Discord...");
  });

  process.on("SIGTERM", async () => {
    console.log("[Bot] Received SIGTERM, shutting down...");
    pollingService?.stop();
    await closePool();
    client.destroy();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("[Bot] Received SIGINT, shutting down...");
    pollingService?.stop();
    await closePool();
    client.destroy();
    process.exit(0);
  });

  console.log("[Bot] Connecting to Discord...");
  await client.login(DISCORD_TOKEN);
}

main().catch((error) => {
  console.error("[Bot] Fatal error:", error);
  process.exit(1);
});
