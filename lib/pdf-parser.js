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
    {"produkt": "Vollständige Produktbezeichnung", "menge": 36, "einheit": "Kiste", "gebinde": "10 Bund"}
  ]
}

== KUNDEN-REGELN ==

KUNDE = bestellende Firma. NIEMALS "Bauers Garten" eintragen, das ist der Empfänger der Bestellung (Lieferant).

- Bei dennree-Bestellungen steht der Filialname oben links nach "dennree GmbH - " (z.B. "dennree GmbH - Filiale Stuttgart" oder "dennree GmbH - Zentrale Töpen"). Trag dann ein: "dennree Filiale Stuttgart" bzw. "dennree Zentrale Töpen".
- Bei E.L.D. GmbH: trag "E.L.D. GmbH" ein
- Bei Rinklin Naturkost: trag "Rinklin Naturkost" ein
- Bei Grundhöfer: trag "Grundhöfer GmbH" ein
- Sonst: nimm den Firmennamen aus dem Briefkopf der Bestellung (NICHT von Bauers Garten!)
- Absender-Mail zur Orientierung: ${absender}

== DATUMS-REGELN ==

LIEFERDATUM = der Tag der Lieferung/Abholung.
- Bei dennree heißt das Feld meist "Abholdatum"
- Bei E.L.D./Rinklin steht oft im Fließtext "Bestellung für Selbstabholung am [Wochentag], TT.MM.JJJJ"
- NICHT das Bestelldatum verwenden. Beide getrennt eintragen.

Format immer TT.MM.JJJJ. Wenn das PDF nur TT.MM.JJ zeigt, ergänze JJ zu 20JJ (z.B. "01.05.26" → "01.05.2026").

== MENGEN-REGELN (WICHTIG!) ==

WIR WOLLEN IMMER DIE ANZAHL DER KISTEN / GEBINDE / VERPACKUNGSEINHEITEN, NICHT DIE GESAMT-STÜCKZAHL.

Format: "menge" = Anzahl Kisten, "einheit" = Verpackungstyp ("Kiste", "Bund", "Stück", "Beutel"), "gebinde" = was in einer Kiste drin ist.

BEISPIEL E.L.D./Rinklin (Tabelle hat 3 Spalten: Menge | Verpackung | Bezeichnung):
  Zeile: "36,00 | 10,00 x Bund | Rote Bete im Bund Bauers Garten"
  → menge: 36, einheit: "Kiste", gebinde: "10 Bund", produkt: "Rote Bete im Bund"
  
  Zeile: "104,00 | 12,00 x Bund | Radieschen Bauers Garten"
  → menge: 104, einheit: "Kiste", gebinde: "12 Bund", produkt: "Radieschen"
  
  Zeile: "32,00 | 8,00 x Stück | Romana Herzen rot (8 Stück, unverpackt)"
  → menge: 32, einheit: "Kiste", gebinde: "8 Stück", produkt: "Romana Herzen rot"

BEISPIEL dennree (Format: "Anzahl x Gebinde Menge Bezeichnung"):
  Zeile: "100 x 8 Bnd  800 Bnd  reg.Radieschen 8er Kiste"
  → menge: 100, einheit: "Kiste", gebinde: "8 Bund", produkt: "Radieschen 8er Kiste"
  
  Zeile: "90 x 4 Kg  360 Kg  reg.Lauch ca.300-500g Stück 4 kg"
  → menge: 90, einheit: "Kiste", gebinde: "4 kg", produkt: "Lauch ca.300-500g Stück"
  
  Zeile: "208 x 12 St  2.496 St  Kohlrabi weiß ca. 300-500g 12 St"
  → menge: 208, einheit: "Kiste", gebinde: "12 Stück", produkt: "Kohlrabi weiß"

WICHTIG: Die "menge" ist IMMER die Anzahl der Verpackungseinheiten/Kisten – die kleinere Zahl, NICHT die hochgerechnete Gesamt-Stückzahl.

== PRODUKT-REGELN ==

- "produkt" = Hauptbezeichnung ohne Verpackungsangabe (z.B. "Radieschen", nicht "Radieschen 8er Kiste"), aber mit ausreichender Beschreibung um Sorten/Varianten zu unterscheiden
- "Bauers Garten" am Ende der Produktbezeichnung (E.L.D./Rinklin Format) kann weggelassen werden
- "reg." am Anfang (dennree-Format für regional) kann weggelassen werden

== FALLBACK ==

Wenn etwas nicht erkennbar ist: leeren String "" verwenden, NIE erfinden.`,
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
