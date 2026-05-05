import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const POSTFACH = process.env.MAIL_POSTFACH || 'bestellung@bauersgarten.de';

// Bekannte Kunden-Domains
export const KUNDEN_DOMAINS = [
  'rinklin-naturkost.de',
  'dennree.de',
  'landlinie.de',
  'biogros.lu',
  'engemann-bio.de',
  'grundhoefer-frankfurt.de',
];

// Ordner, in denen Bestell-Mails landen können (Reihenfolge egal)
const SUCH_ORDNER = ['Posteingang', 'Bestellungen', 'DW Eingangsbestellungen'];

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const msal = new ConfidentialClientApplication({
    auth: {
      clientId: CLIENT_ID,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
      clientSecret: CLIENT_SECRET,
    },
  });

  const result = await msal.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });

  cachedToken = result.accessToken;
  tokenExpiry = Date.now() + (result.expiresOn - new Date()).valueOf() - 60000;
  return cachedToken;
}

function getGraphClient() {
  return Client.init({
    authProvider: async (done) => {
      try {
        const token = await getAccessToken();
        done(null, token);
      } catch (err) {
        done(err, null);
      }
    },
  });
}

function istKundenMail(absender) {
  if (!absender) return false;
  return KUNDEN_DOMAINS.some(
    (d) =>
      absender.toLowerCase().includes('@' + d.toLowerCase()) ||
      absender.toLowerCase().endsWith(d.toLowerCase())
  );
}

// Listet alle Mail-Ordner und liefert die IDs der gesuchten Ordner zurück
async function findeOrdnerIds(client) {
  const map = {};

  // Top-Level-Ordner laden
  const topLevel = await client
    .api(`/users/${POSTFACH}/mailFolders`)
    .select('id,displayName')
    .top(50)
    .get();

  for (const ordner of topLevel.value || []) {
    if (SUCH_ORDNER.includes(ordner.displayName)) {
      map[ordner.displayName] = ordner.id;
    }

    // Unterordner durchgehen (z.B. unter Posteingang)
    try {
      const sub = await client
        .api(`/users/${POSTFACH}/mailFolders/${ordner.id}/childFolders`)
        .select('id,displayName')
        .top(50)
        .get();

      for (const subOrdner of sub.value || []) {
        if (SUCH_ORDNER.includes(subOrdner.displayName)) {
          map[subOrdner.displayName] = subOrdner.id;
        }
      }
    } catch (err) {
      // Wenn keine Unterordner: ignorieren
    }
  }

  return map;
}

// Holt Mails aus einem bestimmten Ordner
async function holeMailsAusOrdner(client, ordnerId, seit) {
  const response = await client
    .api(`/users/${POSTFACH}/mailFolders/${ordnerId}/messages`)
    .filter(`receivedDateTime ge ${seit}`)
    .select('id,subject,from,receivedDateTime,hasAttachments')
    .top(100)
    .get();

  return response.value || [];
}

// Holt neue Mails mit PDF-Anhängen seit timestamp aus allen relevanten Ordnern
export async function fetchNeueBestellMails(seitTimestamp) {
  const client = getGraphClient();
  const seit = seitTimestamp
    ? new Date(seitTimestamp).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Ordner-IDs ermitteln
  const ordnerMap = await findeOrdnerIds(client);
  console.log('Gefundene Ordner:', Object.keys(ordnerMap));

  // Mails aus allen Ordnern sammeln (deduplizieren über Mail-ID)
  const alleMails = new Map();
  for (const [name, id] of Object.entries(ordnerMap)) {
    try {
      const mails = await holeMailsAusOrdner(client, id, seit);
      console.log(`Ordner "${name}": ${mails.length} Mails`);
      for (const m of mails) {
        if (!alleMails.has(m.id)) alleMails.set(m.id, m);
      }
    } catch (err) {
      console.error(`Fehler beim Lesen von Ordner "${name}":`, err.message);
    }
  }

  // Nach Datum sortieren (neueste zuerst)
  const mails = Array.from(alleMails.values()).sort(
    (a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime)
  );

  const bestellMails = [];

  for (const mail of mails) {
    if (!mail.hasAttachments) continue;

    const absender = mail.from?.emailAddress?.address || '';
    if (!istKundenMail(absender)) continue;

    // Anhänge holen
    const att = await client
      .api(`/users/${POSTFACH}/messages/${mail.id}/attachments`)
      .get();

    const pdfs = (att.value || []).filter(
      (a) =>
        a.contentType === 'application/pdf' ||
        a.name?.toLowerCase().endsWith('.pdf')
    );
    if (pdfs.length === 0) continue;

    bestellMails.push({
      id: mail.id,
      subject: mail.subject,
      absender,
      empfangenAm: mail.receivedDateTime,
      pdfs: pdfs.map((p) => ({
        id: p.id,
        name: p.name,
        contentBytes: p.contentBytes,
      })),
    });
  }

  return bestellMails;
}
