import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export interface FirebaseUser {
  uid: string;
  email: string;
  name: string | null;
}

/** Verifies a Firebase Auth ID token using Google's public JWKS (no firebase-admin needed on Workers). */
export async function verifyFirebaseToken(idToken: string, projectId: string): Promise<FirebaseUser | null> {
  if (!idToken || !projectId) return null;
  try {
    jwks ??= createRemoteJWKSet(new URL(JWKS_URL));
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.sub) return null;
    return {
      uid: payload.sub,
      email: (payload.email as string) ?? "",
      name: (payload.name as string) ?? null,
    };
  } catch {
    return null;
  }
}
