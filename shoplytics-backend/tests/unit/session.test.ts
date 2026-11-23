import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import {
  createSession, isSessionActive, listSessions, refreshSession, revokeAllSessions, revokeSession, verifyAccessToken,
} from '../../src/services/session.service';
import { ApiError } from '../../src/utils/ApiError';

const user = () => `u${Math.random().toString(16).slice(2, 14)}`;

describe('sessions (Redis)', () => {
  it('creates a session whose access token verifies and is active', async () => {
    const uid = user();
    const t = await createSession(uid, { ip: '1.2.3.4', userAgent: 'vitest' });
    const claims = verifyAccessToken(t.accessToken);
    expect(claims.userId).toBe(uid);
    expect(await isSessionActive(claims.sid, uid)).toBe(true);
    expect(t.refreshToken.startsWith(`${claims.sid}.`)).toBe(true);
    expect(t.expiresIn).toBeGreaterThan(0);
  });

  it('a session is not active for a different user', async () => {
    const t = await createSession(user());
    expect(await isSessionActive(verifyAccessToken(t.accessToken).sid, user())).toBe(false);
  });

  it('revoking a session kills the access token immediately (before the JWT expires)', async () => {
    const uid = user();
    const t = await createSession(uid);
    const { sid } = verifyAccessToken(t.accessToken);
    expect(await revokeSession(uid, sid)).toBe(true);
    expect(await isSessionActive(sid, uid)).toBe(false);
    expect(() => verifyAccessToken(t.accessToken)).not.toThrow(); // JWT itself is still "valid"...
  });

  it("a user cannot revoke someone else's session", async () => {
    const t = await createSession(user());
    const { sid } = verifyAccessToken(t.accessToken);
    expect(await revokeSession(user(), sid)).toBe(false);
    expect(await isSessionActive(sid, verifyAccessToken(t.accessToken).userId)).toBe(true);
  });

  it('rotates the refresh token on use and issues a working new access token', async () => {
    const uid = user();
    const t = await createSession(uid);
    const r = await refreshSession(t.refreshToken);
    expect(r.userId).toBe(uid);
    expect(r.tokens.refreshToken).not.toBe(t.refreshToken);
    expect(r.tokens.refreshToken.split('.')[0]).toBe(t.refreshToken.split('.')[0]); // same session id
    expect(await isSessionActive(verifyAccessToken(r.tokens.accessToken).sid, uid)).toBe(true);
    await refreshSession(r.tokens.refreshToken); // the new one keeps working
  });

  it('detects refresh-token reuse and destroys the whole session', async () => {
    const uid = user();
    const t = await createSession(uid);
    const { sid } = verifyAccessToken(t.accessToken);
    const r = await refreshSession(t.refreshToken); // legitimate rotation
    await expect(refreshSession(t.refreshToken)).rejects.toMatchObject({ statusCode: 401 }); // replay of the old token
    expect(await isSessionActive(sid, uid)).toBe(false); // attacker AND victim are logged out
    await expect(refreshSession(r.tokens.refreshToken)).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects malformed or unknown refresh tokens', async () => {
    await expect(refreshSession('garbage')).rejects.toMatchObject({ statusCode: 401 });
    await expect(refreshSession(`${'a'.repeat(32)}.${'b'.repeat(64)}`)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('logs out everywhere, optionally keeping the current device', async () => {
    const uid = user();
    const a = await createSession(uid);
    const b = await createSession(uid);
    const c = await createSession(uid);
    const keep = verifyAccessToken(a.accessToken).sid;
    expect(await revokeAllSessions(uid, keep)).toBe(2);
    expect(await isSessionActive(keep, uid)).toBe(true);
    expect(await isSessionActive(verifyAccessToken(b.accessToken).sid, uid)).toBe(false);
    expect(await isSessionActive(verifyAccessToken(c.accessToken).sid, uid)).toBe(false);
    expect(await revokeAllSessions(uid)).toBe(1);
  });

  it('lists live sessions, flags the current one and cleans up dead ones', async () => {
    const uid = user();
    const a = await createSession(uid, { userAgent: 'laptop' });
    const b = await createSession(uid, { userAgent: 'phone' });
    const sidA = verifyAccessToken(a.accessToken).sid;
    await revokeSession(uid, verifyAccessToken(b.accessToken).sid);
    const list = await listSessions(uid, sidA);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: sidA, current: true, userAgent: 'laptop' });
  });

  it('distinguishes an expired access token (client should refresh) from an invalid one', async () => {
    const expired = jwt.sign({ sid: 'x' }, process.env.JWT_ACCESS_SECRET!, { subject: 'u1', expiresIn: -10 });
    expect(() => verifyAccessToken(expired)).toThrowError(expect.objectContaining({ statusCode: 401, details: { code: 'TOKEN_EXPIRED' } }));
    expect(() => verifyAccessToken('not.a.jwt')).toThrowError(expect.objectContaining({ statusCode: 401, message: 'Invalid token' }));
  });

  it('rejects tokens signed with another secret or the "none" algorithm', async () => {
    const forged = jwt.sign({ sid: 'x' }, 'some-other-secret-some-other-secret-1234', { subject: 'u1' });
    expect(() => verifyAccessToken(forged)).toThrowError(expect.objectContaining({ statusCode: 401 }));
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"u1","sid":"x"}').toString('base64url')}.`;
    expect(() => verifyAccessToken(none)).toThrowError(expect.objectContaining({ statusCode: 401 }));
  });
});
