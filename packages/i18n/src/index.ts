import { fr } from "./fr";

type Dict = typeof fr;

/** Toutes les clés qui pointent vers un texte, ex. "app.name". */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Dict>;

/**
 * Renvoie le texte associé à `key`, en remplaçant les `{param}` par `params`.
 * Un paramètre manquant est laissé tel quel pour rester visible en dev.
 */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const value = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], fr);
  if (typeof value !== "string") {
    throw new Error(`Clé i18n inconnue : ${key}`);
  }
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export { fr };
