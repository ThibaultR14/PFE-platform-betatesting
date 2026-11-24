import { t } from "@microbeta/i18n";
import { ephemeral, slashCommand, type BotCommand } from "./types";

/** `/aide` : présente le bot et ses commandes. Sans lien à une campagne pour l'instant (#27). */
export const aide: BotCommand = {
  data: slashCommand(t("bot.commands.aide.name"), t("bot.commands.aide.description")).toJSON(),
  async execute(interaction) {
    await interaction.reply(ephemeral(t("bot.help.body", { appName: t("app.name") })));
  },
};
