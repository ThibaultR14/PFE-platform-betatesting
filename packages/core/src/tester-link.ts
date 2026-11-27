import { errors, jwtVerify, SignJWT } from "jose";

// Lien signé vers la page web testeur `/t/[token]` (#17) : le bot le signe, le site le vérifie.
// Les deux côtés partagent le secret `TESTER_LINK_SECRET`. Le jeton désigne un testeur et un
// assignment : la page vérifie ensuite l'état de l'assignment (terminé → plus de réponse possible).

/** Chemin de la page web testeur, suivi du jeton : `/t/<token>`. */
export const TESTER_PAGE_PATH = "/t";
/** Durée de validité d'un lien. Les relances (#26) renvoient un lien neuf. */
export const TESTER_LINK_TTL_DAYS = 7;
/** Longueur minimale du secret, pour qu'il ne puisse pas être deviné. */
export const TESTER_LINK_MIN_SECRET_LENGTH = 32;

/** Un jeton signé pour un autre usage avec le même secret est refusé. */
const AUDIENCE = "tester-link";
const ALGORITHM = "HS256";
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TesterLinkClaims {
  testerId: string;
  assignmentId: string;
}

/** Lève une erreur si le secret est trop court. */
export function assertTesterLinkSecret(secret: string): void {
  if (secret.length < TESTER_LINK_MIN_SECRET_LENGTH) {
    throw new Error(
      `TESTER_LINK_SECRET doit faire au moins ${TESTER_LINK_MIN_SECRET_LENGTH} caractères ` +
        `(ex. openssl rand -base64 32).`,
    );
  }
}

/** Signe un jeton valable `TESTER_LINK_TTL_DAYS` jours à partir de `now`. */
export async function signTesterLink(
  claims: TesterLinkClaims,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  assertTesterLinkSecret(secret);
  return new SignJWT({ assignmentId: claims.assignmentId })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.testerId)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(new Date(now.getTime() + TESTER_LINK_TTL_DAYS * DAY_MS))
    .sign(key(secret));
}

/**
 * Vérifie un jeton et renvoie ce qu'il désigne, ou `null` s'il est expiré, modifié, signé avec
 * un autre secret ou pour un autre usage.
 */
export async function verifyTesterLink(
  token: string,
  secret: string,
  now: Date = new Date(),
): Promise<TesterLinkClaims | null> {
  assertTesterLinkSecret(secret);
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: [ALGORITHM],
      audience: AUDIENCE,
      currentDate: now,
      requiredClaims: ["sub", "exp"],
    });
    const { sub, assignmentId } = payload;
    if (typeof sub !== "string" || !sub || typeof assignmentId !== "string" || !assignmentId) {
      return null;
    }
    return { testerId: sub, assignmentId };
  } catch (error) {
    if (error instanceof errors.JOSEError) return null;
    throw error;
  }
}

/** URL complète du lien : `webUrl` est l'URL publique du site, sans `/` final. */
export function testerLinkUrl(webUrl: string, token: string): string {
  return `${webUrl}${TESTER_PAGE_PATH}/${token}`;
}

const key = (secret: string): Uint8Array => new TextEncoder().encode(secret);
