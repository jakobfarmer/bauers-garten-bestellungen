import { getAlleBestellungen, setBestellungStatus } from '../../lib/storage';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const liste = await getAlleBestellungen();
      res.status(200).json({ ok: true, bestellungen: liste });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    // Status-Update
    try {
      const { id, status } = req.body;
      if (!id || !status) return res.status(400).json({ ok: false, error: 'id und status erforderlich' });
      const updated = await setBestellungStatus(id, status);
      res.status(200).json({ ok: true, bestellung: updated });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  res.status(405).end();
}
