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

// Prüft ob Absender eine bekannte Kunden-Domain hat
function istKundenMail(absender) {
  if (!absender) return false;
  return KUNDEN_DOMAINS.some(
    (d) =>
      absender.toLowerCase().includes('@' + d.toLowerCase()) ||
      absender.toLowerCase().endsWith(d.toLowerCase())
  );
}

// Holt neue Mails mit PDF-Anhängen seit timestamp
export async function fetchNeueBestellMails(seitTimestamp) {
  const client = getGraphClient();
  const seit = seitTimestamp
    ? new Date(seitTimestamp).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Microsoft Graph erlaubt filter+orderby nicht zusammen ohne Index.
  // Daher nur Datums-Filter, Sortierung machen wir clientseitig.
  const response = await client
    .api(`/users/${POSTFACH}/messages`)
    .filter(`receivedDateTime ge ${seit}`)
    .select('id,subject,from,receivedDateTime,hasAttachments')
    .top(100)
    .get();

  // Clientseitig sortieren (neueste zuerst)
  const mails = (response.value || []).slice().sort((a, b) => {
    return new Date(b.receivedDateTime) - new Date(a.receivedDateTime);
  });

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
        contentBytes: p.contentBytes, // base64
      })),
    });
  }

  return bestellMails;
}
