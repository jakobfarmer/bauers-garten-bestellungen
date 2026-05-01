import { resolveConflict, getAlleBestellungen } from '../../lib/storage';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { neueId, alteId, action } = req.body;
    // action: 'replace' | 'add' | 'keep_both'
    if (!neueId || !alteId || !action) {
      return res.status(400).json({ ok: false, error: 'neueId, alteId, action erforderlich' });
    }

    const liste = await getAlleBestellungen();
    const neue = liste.find(b => b.id === neueId);
    const alte = liste.find(b => b.id === alteId);

    if (!neue || !alte) return res.status(404).json({ ok: false, error: 'Bestellung nicht gefunden' });

    let mergedPositionen;
    if (action === 'replace') {
      mergedPositionen = neue.positionen;
    } else if (action === 'add') {
      // Mengen pro Produkt addieren
      const map = {};
      [...alte.positionen, ...neue.positionen].forEach(p => {
        const k = p.produkt;
        if (!map[k]) map[k] = { ...p };
        else map[k].menge = (map[k].menge || 0) + (p.menge || 0);
      });
      mergedPositionen = Object.values(map);
    } else if (action === 'keep_both') {
      mergedPositionen = neue.positionen; // beide bleiben separat - nichts mergen
    }

    if (action !== 'keep_both') {
      // Alte Bestellung als "ersetzt" markieren
      const idxAlt = liste.findIndex(b => b.id === alteId);
      if (idxAlt >= 0) {
        liste[idxAlt].status = 'ersetzt';
        liste[idxAlt].ersetztDurch = neueId;
      }
    }

    await resolveConflict(neueId, action, mergedPositionen);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Conflict resolve error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
