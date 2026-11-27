import { signTesterLink, testerLinkUrl } from "@microbeta/core";

/** Ce qu'il faut pour le lien « Répondre sur le web ». Sans l'un des deux, pas de lien. */
export interface WebLinkConfig {
  /** URL publique du site. */
  webUrl: string | null;
  /** Secret des liens signés. */
  testerLinkSecret: string | null;
}

/** Lien signé vers la page web testeur de cet assignment, ou `null` si le lien n'est pas configuré. */
export async function testerWebLink(
  { webUrl, testerLinkSecret }: WebLinkConfig,
  testerId: string,
  assignmentId: string,
  now: Date = new Date(),
): Promise<string | null> {
  if (!webUrl || !testerLinkSecret) return null;
  return testerLinkUrl(
    webUrl,
    await signTesterLink({ testerId, assignmentId }, testerLinkSecret, now),
  );
}
