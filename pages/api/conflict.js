import { resolveConflict } from '../../lib/storage';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { id, action, mergedPositionen } = req.body;
    if (!id || !action) return res.status(400).json({ ok: false, error: 'id und action erforderlich' });

    const updated = await resolveConflict(id, action, mergedPositionen);
    if (!updated) return res.status(404).json({ ok: false, error: 'Bestellung nicht gefunden' });

    res.status(200).json({ ok: true, bestellung: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
