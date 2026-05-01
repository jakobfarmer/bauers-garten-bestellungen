import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const KEY_BESTELLUNGEN = 'bestellungen:liste';
const KEY_LAST_SYNC = 'bestellungen:lastsync';
const KEY_VERARBEITETE_MAILS = 'bestellungen:verarbeitete-mails';

// Alle Bestellungen lesen
export async function getAlleBestellungen() {
  const liste = await redis.get(KEY_BESTELLUNGEN);
  return liste || [];
}

// Bestellung hinzufügen oder aktualisieren
export async function saveBestellung(bestellung) {
  const liste = await getAlleBestellungen();
  const idx = liste.findIndex(b => b.id === bestellung.id);
  if (idx >= 0) {
    liste[idx] = { ...liste[idx], ...bestellung };
  } else {
    liste.unshift(bestellung);
  }
  await redis.set(KEY_BESTELLUNGEN, liste);
  return bestellung;
}

// Status einer Bestellung ändern
export async function setBestellungStatus(bestellungId, status) {
  const liste = await getAlleBestellungen();
  const idx = liste.findIndex(b => b.id === bestellungId);
  if (idx < 0) return null;
  liste[idx].status = status;
  liste[idx].statusGeaendert = new Date().toISOString();
  await redis.set(KEY_BESTELLUNGEN, liste);
  return liste[idx];
}

// Konflikt-Auflösung speichern
export async function resolveConflict(bestellungId, action, mergedPositionen) {
  const liste = await getAlleBestellungen();
  const idx = liste.findIndex(b => b.id === bestellungId);
  if (idx < 0) return null;

  liste[idx].konflikt = false;
  liste[idx].konfliktBehandlung = action;
  liste[idx].konfliktBehandeltAm = new Date().toISOString();

  if (action === 'replace' || action === 'add') {
    liste[idx].positionen = mergedPositionen;
    // Frühere Versionen archivieren
    liste[idx].fruehereVersionen = liste[idx].fruehereVersionen || [];
  }

  await redis.set(KEY_BESTELLUNGEN, liste);
  return liste[idx];
}

// Letzte Sync-Zeit
export async function getLastSync() {
  return await redis.get(KEY_LAST_SYNC);
}

export async function setLastSync(ts) {
  await redis.set(KEY_LAST_SYNC, ts);
}

// Verarbeitete Mail-IDs (damit nichts doppelt importiert wird)
export async function isMailVerarbeitet(mailId) {
  const verarbeitete = (await redis.get(KEY_VERARBEITETE_MAILS)) || [];
  return verarbeitete.includes(mailId);
}

export async function markMailVerarbeitet(mailId) {
  const verarbeitete = (await redis.get(KEY_VERARBEITETE_MAILS)) || [];
  if (!verarbeitete.includes(mailId)) {
    verarbeitete.push(mailId);
    // Limit auf 1000 letzte Mails
    if (verarbeitete.length > 1000) verarbeitete.splice(0, verarbeitete.length - 1000);
    await redis.set(KEY_VERARBEITETE_MAILS, verarbeitete);
  }
}

// Konflikt-Erkennung: gibt es schon eine Bestellung von diesem Kunden für diesen Liefertag?
export async function findePossibleConflict(kunde, lieferdatum) {
  const liste = await getAlleBestellungen();
  return liste.find(
    b => b.kunde === kunde && b.lieferdatum === lieferdatum && b.status !== 'erledigt'
  );
}
