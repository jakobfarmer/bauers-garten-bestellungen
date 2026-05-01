import { fetchNeueBestellMails } from '../../lib/graph';
import { parsePdfBestellung } from '../../lib/pdf-parser';
import {
  saveBestellung,
  isMailVerarbeitet,
  markMailVerarbeitet,
  findePossibleConflict,
  setLastSync,
} from '../../lib/storage';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).end();
  }

  try {
    const seit = req.query.seit || null;
    const mails = await fetchNeueBestellMails(seit);

    const verarbeitet = [];
    const konflikte = [];
    const fehler = [];

    for (const mail of mails) {
      if (await isMailVerarbeitet(mail.id)) continue;

      for (const pdf of mail.pdfs) {
        try {
          const parsed = await parsePdfBestellung(pdf.contentBytes, mail.absender);
          if (!parsed) {
            fehler.push({ mailId: mail.id, pdf: pdf.name, grund: 'Parse failed' });
            continue;
          }

          // Konflikt prüfen
          const conflict = await findePossibleConflict(parsed.kunde, parsed.lieferdatum);

          const bestellung = {
            id: `${mail.id}__${pdf.id}`,
            mailId: mail.id,
            pdfName: pdf.name,
            absender: mail.absender,
            empfangenAm: mail.empfangenAm,
            kunde: parsed.kunde,
            lieferdatum: parsed.lieferdatum,
            bestelldatum: parsed.bestelldatum,
            positionen: parsed.positionen || [],
            status: conflict ? 'konflikt' : 'neu',
            konflikt: !!conflict,
            konfliktMit: conflict ? conflict.id : null,
          };

          await saveBestellung(bestellung);

          if (conflict) konflikte.push(bestellung);
          else verarbeitet.push(bestellung);
        } catch (err) {
          console.error('Error parsing pdf:', err);
          fehler.push({ mailId: mail.id, pdf: pdf.name, grund: err.message });
        }
      }

      await markMailVerarbeitet(mail.id);
    }

    await setLastSync(new Date().toISOString());

    res.status(200).json({
      ok: true,
      neue: verarbeitet.length,
      konflikte: konflikte.length,
      fehler: fehler.length,
      details: { verarbeitet, konflikte, fehler },
    });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
