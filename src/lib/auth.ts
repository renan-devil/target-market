import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

const SESSION_COOKIE = "gtm_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const MAGIC_TTL_MS = 1000 * 60 * 15; // 15 minutes

function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short (set it in .env)");
  }
  return new TextEncoder().encode(secret);
}

// --- Email domain allow-list ------------------------------------------------

export function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS || "oss.ventures")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 0) return false;
  const domain = normalized.slice(at + 1);
  return allowedDomains().includes(domain);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// --- Magic tokens -----------------------------------------------------------

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a one-time token for `email`, persist its hash, return the raw token. */
export async function createMagicToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.magicToken.create({
    data: {
      email: normalizeEmail(email),
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + MAGIC_TTL_MS),
    },
  });
  return token;
}

/** Consume a magic token. Returns the email if valid, else null. */
export async function consumeMagicToken(token: string): Promise<string | null> {
  const record = await prisma.magicToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record) return null;
  if (record.consumedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;

  await prisma.magicToken.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return record.email;
}

// --- Sessions (stateless JWT in an httpOnly cookie) -------------------------

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export async function createSession(user: SessionUser): Promise<void> {
  const jwt = await new SignJWT({ email: user.email, name: user.name ?? undefined })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(authSecret());

  cookies().set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function destroySession(): void {
  cookies().delete(SESSION_COOKIE);
}

/** Read the current session from the cookie. Returns null if not signed in. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      name: (payload.name as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

/** Throws (caller should redirect) if there is no session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

/** Find-or-create the user row for an allowed email and stamp last login. */
export async function upsertUserOnLogin(email: string): Promise<SessionUser> {
  const normalized = normalizeEmail(email);
  const user = await prisma.user.upsert({
    where: { email: normalized },
    create: { email: normalized, lastLoginAt: new Date() },
    update: { lastLoginAt: new Date() },
  });
  return { id: user.id, email: user.email, name: user.name };
}
