import { lastImageBase64 } from './upload';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    if (!lastImageBase64) {
      // Fallback: Redirect to the placeholder image using standard HTTP redirect
      res.writeHead(302, { Location: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=600&auto=format&fit=crop' });
      return res.end();
    }

    const imgBuffer = Buffer.from(lastImageBase64, 'base64');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(imgBuffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
