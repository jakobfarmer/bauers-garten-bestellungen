import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  // Bewusst auf GET, damit man's einfach im Browser aufrufen kann
  try {
    await redis.del('bestellungen:lastsync');
    await redis.del('bestellungen:verarbeitete-mails');
    res.status(200).json({ ok: true, reset: true, message: 'Sync-Cache wurde geleert. Jetzt zurück zur App und Sync drücken.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
