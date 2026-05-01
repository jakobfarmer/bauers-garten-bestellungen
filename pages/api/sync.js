import { fetchNeueBestellMails } from '../../lib/graph';
import { parsePdfBestellung } from '../../lib/pdf-parser';
import {
  saveBestellung,
  getLastSync,
  setLastSync,
  isMailVerarbeitet,
  markMailVerarbeitet,
  findePossibleConflict,
} from '../../lib/storage';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const lastSync = await getLastSync();
    const mails = await fetchNeueBestellMails(lastSync);

    let neu = 0;
    let uebersprungen = 0;
    let fehler = 0;

    for (const mail of mails) {
      if (await isMailVerarbeitet(mail.id)) {
        uebersprungen++;
        continue;
      }

      for (const pdf of mail.pdfs) {
        try {
          const parsed = await parsePdfBestellung(pdf.contentBytes, mail.absender);
          if (!parsed || !parsed.kunde) {
            fehler++;
            continue;
          }

          // Konflikt prüfen
          const conflict = await findePossibleConflict(parsed.kunde, parsed.lieferdatum);

          const bestellung = {
            id: `${mail.id}-${pdf.id}`,
            mailId: mail.id,
            kunde: parsed.kunde,
            lieferdatum: parsed.lieferdatum,
            bestelldatum: parsed.bestelldatum,
            positionen: parsed.positionen || [],
            absender: mail.absender,
            betreff: mail.subject,
            empfangenAm: mail.empfangenAm,
            pdfName: pdf.name,
            status: 'neu',
            konflikt: !!conflict,
            konfliktMitId: conflict?.id || null,
            erstelltAm: new Date().toISOString(),
          };

          await saveBestellung(bestellung);
          neu++;
        } catch (err) {
          console.error('PDF-Verarbeitung fehlgeschlagen:', err);
          fehler++;
        }
      }

      await markMailVerarbeitet(mail.id);
    }

    await setLastSync(new Date().toISOString());

    res.status(200).json({
      ok: true,
      neu,
      uebersprungen,
      fehler,
      mailsGeprueft: mails.length,
    });
  } catch (err) {
    console.error('Sync-Fehler:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
