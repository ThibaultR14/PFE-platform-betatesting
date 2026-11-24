import { loadConfig } from "./config";

// Point d'entrée du bot. Le client discord.js et les workers pg-boss
// sont branchés dans l'issue « Bot : connexion Discord ».
const config = loadConfig();
console.log(`Bot prêt à démarrer (application ${config.applicationId}).`);
