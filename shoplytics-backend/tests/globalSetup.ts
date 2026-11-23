import { spawn, type ChildProcess } from 'child_process';
import net from 'net';

/**
 * Tests need a real Redis (sessions, rate limiting and caching are Redis features). Unless REDIS_URL is
 * provided, this starts a throw-away `redis-server` on port 6390 (no persistence) and stops it afterwards.
 */
let proc: ChildProcess | undefined;

const ping = (port: number) =>
  new Promise<boolean>((resolve) => {
    const s = net.connect(port, '127.0.0.1', () => {
      s.end();
      resolve(true);
    });
    s.on('error', () => resolve(false));
  });

export async function setup() {
  if (process.env.REDIS_URL) return;
  if (await ping(6390)) return process.env.REDIS_URL ?? void (process.env.REDIS_URL = 'redis://127.0.0.1:6390');

  proc = spawn('redis-server', ['--port', '6390', '--save', '', '--appendonly', 'no', '--bind', '127.0.0.1'], { stdio: 'ignore' });
  proc.on('error', () => undefined);
  for (let i = 0; i < 50; i++) {
    if (await ping(6390)) {
      process.env.REDIS_URL = 'redis://127.0.0.1:6390';
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Could not start redis-server on :6390. Install Redis or set REDIS_URL to a running instance.');
}

export async function teardown() {
  proc?.kill();
}
