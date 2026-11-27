/** Textes français. Toute chaîne visible par un utilisateur doit être ici. */
export const fr = {
  app: {
    name: "MicroBeta",
    tagline: "Faites tester votre produit, cinq minutes à la fois.",
  },
  bot: {
    ready: "Bot connecté en tant que {tag}",
    commands: {
      // Discord impose un nom en minuscules, sans espace (32 caractères max)
      // et une description de 100 caractères max.
      aide: {
        name: "aide",
        description: "Découvrir ce que fait ce bot et les commandes disponibles",
      },
    },
    help: {
      body:
        "Salut ! Je suis le bot **{appName}**. Je t'envoie les micro-tests des projets auxquels tu participes.\n\n" +
        "• Un micro-test prend environ 5 minutes : quelques questions, auxquelles tu réponds avec des boutons ou un court texte.\n" +
        "• Je ne t'envoie aucun micro-test avant que tu aies accepté de participer à une campagne.\n\n" +
        "**Commandes**\n" +
        "• `/aide` : afficher ce message",
    },
    // Message privé d'accueil, envoyé une seule fois par campagne (tâche send-welcome).
    welcome: {
      intro:
        "Salut ! Je suis le bot **{appName}**. **{ownerName}** t'invite à tester **{campaignName}**.",
      durationOne: "Le test tient en **1 micro-test** d'environ {minutes} minutes.",
      durationMany:
        "Le test se fait en **{count} micro-tests** d'environ {minutes} minutes chacun, que je t'envoie un par un.",
      product: "Le produit à tester : {url}",
      privacy: "Ce qu'on fait de tes réponses : {url}",
      callToAction:
        "Si tu es partant, clique sur le bouton ci-dessous. Je ne t'envoie rien avant ton accord, et tu pourras arrêter quand tu veux.",
      // Libellé d'un bouton Discord : 80 caractères max.
      button: "J'accepte de participer",
    },
    // Réponses au clic sur « J'accepte de participer ».
    consent: {
      accepted: "✅ C'est noté, merci ! Ton premier micro-test arrive très vite.",
      alreadyAccepted: "C'est déjà noté : tu participes à cette campagne.",
      optedOut: "Tu as quitté cette campagne : je ne t'enverrai plus rien.",
      notYou: "Cette invitation ne t'est pas destinée.",
      unknownTester: "Cette invitation n'existe plus.",
    },
    // Message privé d'un micro-test : intro et première question (tâche send-microtest).
    microtest: {
      title: "📝 **Nouveau micro-test : {title}**",
      durationOne: "Environ {minutes} minutes · 1 question",
      durationMany: "Environ {minutes} minutes · {count} questions",
      // Le bot ne lit pas les messages écrits en privé (intent Guilds seul) : on le dit.
      buttonsOnly:
        "Réponds avec les boutons sous chaque question : je ne lis pas les messages écrits.",
      questionHeader: "**Question {number}/{count}**",
      optional: "(facultative)",
      hint: {
        TEXT: "Clique sur « Répondre » pour écrire ta réponse.",
        RATING: "Choisis une note de 1 à 5 avec les boutons ci-dessous.",
        YESNO: "Réponds avec les boutons ci-dessous.",
        SINGLE: "Choisis une seule réponse ci-dessous :",
        MULTI: "Choisis une ou plusieurs réponses dans le menu ci-dessous :",
      },
      webHint:
        "Tu préfères répondre sur le web, ou joindre une capture d'écran ? Utilise le bouton ci-dessous.",
      // Libellé d'un bouton Discord : 80 caractères max.
      webButton: "Répondre sur le web",
    },
    // Réponses aux questions d'un micro-test (boutons, menus et fenêtre de saisie).
    answer: {
      // Libellés de boutons : 80 caractères max.
      yes: "Oui",
      no: "Non",
      skip: "Passer",
      write: "✏️ Répondre",
      // Texte d'un menu de sélection avant le choix : 150 caractères max.
      pickOne: "Choisis une réponse",
      pickMany: "Choisis une ou plusieurs réponses",
      // Fenêtre de saisie : titre et libellé du champ, 45 caractères max.
      modalTitle: "Ta réponse",
      modalLabel: "Écris ta réponse",
      recorded: "✅ Ta réponse : {value}",
      rating: "{rating}/5",
      skipped: "⏭️ Question passée.",
      stale: "⚠️ Cette question a changé entre-temps : cette version n'est plus valable.",
      completed: "🎉 Micro-test terminé, merci !",
      nextIn: "Le prochain arrive dans environ {delay}.",
      nextSoon: "Le prochain arrive dans quelques instants.",
      last: "C'était le dernier micro-test de cette campagne. Merci beaucoup pour ton aide !",
      delay: {
        hour: "1 heure",
        hours: "{count} heures",
        day: "1 jour",
        days: "{count} jours",
      },
      // Réponses éphémères, quand le clic n'enregistre rien.
      alreadyAnswered: "Tu as déjà répondu à cette question, merci !",
      alreadyCompleted: "Ce micro-test est déjà terminé, merci !",
      optedOut: "Tu as quitté cette campagne : ta réponse n'a pas été enregistrée.",
      notYou: "Ce micro-test ne t'est pas destiné.",
      unknown: "Ce micro-test n'existe plus.",
      invalid: "Cette réponse n'est pas valable. Réessaie avec les boutons de la question.",
    },
    errors: {
      unknownCommand:
        "Cette commande n'existe plus. Tape `/aide` pour voir celles qui sont disponibles.",
      unknownButton: "Ce bouton n'est plus valable.",
      generic: "Oups, quelque chose s'est mal passé de mon côté. Réessaie dans quelques instants.",
    },
  },
} as const;
