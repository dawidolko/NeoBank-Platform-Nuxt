import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import argon2 from 'argon2'
import type { H3Event } from 'h3'
import type { Role, User } from '@prisma/client'
import { prisma } from './prisma'

export const SESSION_COOKIE = 'neobank_session'

/**
 * Argon2id parameters. Deliberately above the library defaults — a banking
 * login is not a hot path and the extra cost is paid once per sign-in.
 */
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — OWASP minimum
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON_OPTIONS)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    // A malformed stored hash must read as "wrong password", never as a crash.
    return false
  }
}

/**
 * Session tokens are random 256-bit values handed to the client, but only
 * their SHA-256 digest is stored. A leaked database therefore yields no
 * usable session cookies.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Constant-time compare for two hex digests of equal length. */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8')
  const bufferB = Buffer.from(b, 'utf8')

  if (bufferA.length !== bufferB.length) return false

  return timingSafeEqual(bufferA, bufferB)
}

export type SessionUser = Pick<
  User,
  'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'status'
>

/** Create a session row and set the cookie on the response. */
export async function createSession(event: H3Event, userId: string): Promise<string> {
  const config = useRuntimeConfig(event)
  const ttlHours = Number(config.sessionTtlHours) || 720
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
      userAgent: getRequestHeader(event, 'user-agent')?.slice(0, 255) ?? null,
      ipAddress: getRequestIP(event, { xForwardedFor: true }) ?? null,
    },
  })

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttlHours * 60 * 60,
  })

  return token
}

/** Resolve the signed-in user, or null. Expired sessions are swept on read. */
export async function resolveSessionUser(event: H3Event): Promise<SessionUser | null> {
  const token = getCookie(event, SESSION_COOKIE)

  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  })

  if (!session) return null

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }

  // A suspended or closed account keeps its session row but loses access.
  if (session.user.status !== 'ACTIVE') return null

  const { id, email, firstName, lastName, role, status } = session.user

  return { id, email, firstName, lastName, role, status }
}

export async function destroySession(event: H3Event): Promise<void> {
  const token = getCookie(event, SESSION_COOKIE)

  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashSessionToken(token) } })
      .catch(() => undefined)
  }

  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

/** Require an authenticated user, or throw 401. */
export function requireUser(event: H3Event): SessionUser {
  const user = event.context.user as SessionUser | null | undefined

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  return user
}

/** Require a specific role, or throw 403. */
export function requireRole(event: H3Event, role: Role): SessionUser {
  const user = requireUser(event)

  if (user.role !== role) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' })
  }

  return user
}
