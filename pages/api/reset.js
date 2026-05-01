import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    await redis.del('bestellungen:lastsync');
    await redis.del('bestellungen:verarbeitete-mails');
    res.status(200).json({ ok: true, reset: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
