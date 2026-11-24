export interface ShutdownStep {
  name: string;
  run: () => Promise<void>;
}

export interface ShutdownOptions {
  /** Au-delà, le process sort quand même, avec le code 1. */
  timeoutMs: number;
  exit: (code: number) => void;
  log?: (message: string) => void;
  logError?: (message: string, error?: unknown) => void;
}

/**
 * Renvoie la fonction à appeler sur SIGINT/SIGTERM. Elle exécute les étapes dans l'ordre,
 * une seule fois même si plusieurs signaux arrivent. Une étape qui échoue n'empêche pas les
 * suivantes, et le process sort alors avec le code 1.
 */
export function createShutdown(
  steps: readonly ShutdownStep[],
  {
    timeoutMs,
    exit,
    log = (message) => console.log(message),
    logError = (message, error) => console.error(message, error ?? ""),
  }: ShutdownOptions,
): (signal: string) => Promise<void> {
  let stopping = false;

  return async (signal) => {
    if (stopping) return;
    stopping = true;
    log(`[bot] ${signal} reçu, arrêt en cours…`);

    const timer = setTimeout(() => {
      logError(`[bot] arrêt trop long (plus de ${timeoutMs} ms), sortie forcée.`);
      exit(1);
    }, timeoutMs);

    let code = 0;
    for (const step of steps) {
      try {
        await step.run();
      } catch (error) {
        logError(`[bot] échec de l'arrêt de ${step.name} :`, error);
        code = 1;
      }
    }
    clearTimeout(timer);
    exit(code);
  };
}
