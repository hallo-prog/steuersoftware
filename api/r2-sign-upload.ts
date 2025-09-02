// Serverless Function: Liefert signierte PUT URL für externen Object Storage (z.B. Cloudflare R2)
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL } = process.env;

const r2Enabled = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_BASE_URL);

const s3 = r2Enabled ? new S3Client({
	region: 'auto',
	endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! }
}) : null;

export default async function handler(req: any, res: any) {
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	if (!r2Enabled) return res.status(503).json({ error: 'R2 not configured' });
	try {
		const body = typeof req.body === 'object' ? req.body : (() => { try { return JSON.parse(req.body || '{}'); } catch { return {}; } })();
		const { filename, contentType } = body;
		if (!filename || typeof filename !== 'string') return res.status(400).json({ error: 'filename missing' });
		const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
		const cmd = new PutObjectCommand({ Bucket: R2_BUCKET, Key: safeName, ContentType: contentType || 'application/octet-stream' });
		const expiresIn = 60 * 5;
		const uploadUrl = await getSignedUrl(s3!, cmd, { expiresIn });
		const publicUrl = `${R2_PUBLIC_BASE_URL!.replace(/\/$/,'')}/${safeName}`;
		res.status(200).json({ uploadUrl, publicUrl, expiresIn });
	} catch (e: any) {
		console.error('R2 sign error', e);
		res.status(500).json({ error: 'sign failed' });
	}
}

