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
            text: `Lies diese Kunden-Bestellung aus. Antworte NUR mit einem JSON-Objekt im folgenden Format, kein Text drumherum, keine Backticks:

{
  "kunde": "Name des Kunden (Firmenname)",
  "lieferdatum": "TT.MM.JJJJ",
  "bestelldatum": "TT.MM.JJJJ",
  "positionen": [
    {"produkt": "Radieschen 8er Bund", "menge": 220, "einheit": "VK"}
  ]
}

Regeln:
- "kunde" = Firmenname des Bestellers (Absender: ${absender})
- "lieferdatum" = der gewünschte Liefertermin aus der Bestellung
- "bestelldatum" = wann die Bestellung erstellt wurde (falls in PDF erkennbar)
- "produkt" = vollständige Produktbezeichnung wie sie in der Bestellung steht
- "menge" = bestellte Menge als Zahl
- "einheit" = Einheit (VK, Stück, Bund, etc.) – falls nicht klar, "VK"
- Bei mehreren Lieferdaten in einer Bestellung: separate Einträge mit eigenem "lieferdatum"
- Wenn etwas nicht erkennbar: leeren String "" verwenden, NIE erfinden`,
          },
        ],
      },
    ],
  });

  // Antwort aus content blocks extrahieren
  const text = message.content.map(b => b.text || '').join('').trim();
  // JSON aus möglichen Markdown-Blöcken befreien
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('PDF parse failed:', err, 'Text was:', cleaned);
    return null;
  }
}
