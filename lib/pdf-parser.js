import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function parsePdfBestellung(base64Pdf, absender) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            type: 'text',
            text: `Du liest Bestellungen, die Kunden an die Firma "Bauers Garten GmbH & Co. KG" (Grasweg 2a, 76872 Winden) schicken. Bauers Garten ist der LIEFERANT, NIEMALS der Kunde.

Antworte NUR mit einem JSON-Objekt im folgenden Format, kein Text drumherum, keine Backticks, kein Markdown:

{
  "kunde": "Genauer Name der bestellenden Firma/Filiale",
  "lieferdatum": "TT.MM.JJJJ",
  "bestelldatum": "TT.MM.JJJJ",
  "bestellnummer": "Bestell- oder Belegnummer",
  "positionen": [
    {"produkt": "Vollständige Produktbezeichnung", "menge": 220, "einheit": "VK"}
  ]
}

WICHTIGE REGELN:

1. KUNDE = bestellende Firma. NIEMALS "Bauers Garten" eintragen, das ist der Empfänger der Bestellung (Lieferant).
   - Bei dennree-Bestellungen steht der Filialname oben links nach "dennree GmbH - " (z.B. "dennree GmbH - Filiale Stuttgart" oder "dennree GmbH - Zentrale Töpen"). Trag dann ein: "dennree Filiale Stuttgart" bzw. "dennree Zentrale Töpen".
   - Bei E.L.D. GmbH: trag "E.L.D. GmbH" ein
   - Bei Rinklin Naturkost: trag "Rinklin Naturkost" ein
   - Bei Grundhöfer: trag "Grundhöfer GmbH" ein
   - Sonst: nimm den Firmennamen aus dem Briefkopf der Bestellung (NICHT von Bauers Garten!)
   - Absender-Mail zur Orientierung: ${absender}

2. LIEFERDATUM = der Tag der Lieferung/Abholung (oft "Abholdatum", "Liefertermin", "Selbstabholung am ...").
   NICHT das Bestelldatum verwenden. Beide Daten getrennt eintragen.
   Format immer TT.MM.JJJJ (z.B. "01.05.2026" statt "01.05.26" – ergänze zweistelliges JJ immer zu 20JJ).

3. PRODUKTE = jede Bestellposition als eigener Eintrag.
   - "produkt" = ganze Produktbezeichnung wie sie in der Bestellung steht
   - "menge" = bestellte Stückzahl/Menge als Zahl (verwende die GESAMTMENGE in der Hauptmaßeinheit, nicht die Anzahl Gebinde × Inhalt)
   - "einheit" = Einheit (Bnd, St, Kg, Btl, Ki, VK, etc.)

4. Wenn etwas nicht erkennbar ist: leeren String "" verwenden, NIE erfinden.`,
          },
        ],
      },
    ],
  });

  const text = message.content.map(b => b.text || '').join('').trim();
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('PDF parse failed:', err, 'Text was:', cleaned);
    return null;
  }
}
