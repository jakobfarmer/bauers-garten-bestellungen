import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  try {
    await redis.del('bestellungen:lastsync');
    await redis.del('bestellungen:verarbeitete-mails');
    await redis.del('bestellungen:liste');
    res.status(200).json({
      ok: true,
      reset: true,
      message: 'Alle Bestellungen UND Sync-Cache wurden gelöscht. Jetzt zurück zur App und Sync drücken.',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
