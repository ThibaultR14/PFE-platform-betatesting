/**
 * `customId` d'un bouton : `<préfixe>:<argument>`, ex. `consent:<testerId>`.
 * Le préfixe choisit le handler, l'argument identifie l'objet concerné. Discord limite le tout
 * à 100 caractères, ce qui laisse largement la place à un cuid.
 */
const SEPARATOR = ":";

export function customId(prefix: string, arg: string): string {
  return `${prefix}${SEPARATOR}${arg}`;
}

/** Découpe un `customId`. Sans séparateur, l'argument est vide. */
export function parseCustomId(id: string): { prefix: string; arg: string } {
  const index = id.indexOf(SEPARATOR);
  if (index === -1) return { prefix: id, arg: "" };
  return { prefix: id.slice(0, index), arg: id.slice(index + 1) };
}

export const CONSENT_PREFIX = "consent";

export const consentButtonId = (testerId: string): string => customId(CONSENT_PREFIX, testerId);
