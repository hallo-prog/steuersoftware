import { supabase } from '../src/supabaseClient';

// Hybrid Upload Service: entscheidet zwischen Supabase Storage (Standard) und Cloudflare R2 (falls aktiviert)
// Umschalten anhand Nutzungsschwelle des Supabase Buckets (Heuristik) + Env Flag für R2.

interface UploadDecision { provider: 'supabase' | 'r2'; reason: string }

const SUPABASE_BUCKET = 'belege';
const USAGE_THRESHOLD = parseFloat((import.meta as any).env?.VITE_SUPABASE_USAGE_THRESHOLD || '0.8');
let lastUsageCheck: { at: number; fraction: number } | null = null;
const USAGE_CACHE_MS = 60_000; // 1 Minute Cache

async function estimateSupabaseBucketUsageFraction(): Promise<number> {
	const now = Date.now();
	if (lastUsageCheck && now - lastUsageCheck.at < USAGE_CACHE_MS) return lastUsageCheck.fraction;
	try {
		let total = 0; let page = 0; const pageSize = 100; const HARD_CAP_PAGES = 10;
		while (page < HARD_CAP_PAGES) {
			const { data, error } = await (supabase as any).storage.from(SUPABASE_BUCKET).list('', {
				limit: pageSize,
				offset: page * pageSize,
				sortBy: { column: 'name', order: 'asc' }
			});
			if (error) break;
			if (!data || data.length === 0) break;
			for (const obj of data) {
				if (obj.metadata && typeof obj.metadata.size === 'number') total += obj.metadata.size;
			}
			if (data.length < pageSize) break;
			page++;
		}
		const fraction = total / 1_000_000_000; // 1 GB Referenz (Free Tier Supabase)
		lastUsageCheck = { at: now, fraction };
		return fraction;
	} catch {
		return 0;
	}
}

function hasR2Env() {
	return !!( (import.meta as any).env?.VITE_R2_ENABLED || (typeof window !== 'undefined' && (window as any).__R2_ENABLED__));
}

async function decideProvider(): Promise<UploadDecision> {
	const fraction = await estimateSupabaseBucketUsageFraction();
	if (fraction >= USAGE_THRESHOLD && hasR2Env()) {
		return { provider: 'r2', reason: `Supabase Bucket bei ${(fraction * 100).toFixed(1)}%` };
	}
	return { provider: 'supabase', reason: `Supabase unter Schwelle ${(fraction * 100).toFixed(1)}%` };
}

export interface HybridUploadResult {
	provider: 'supabase' | 'r2';
	publicUrl: string;
	path: string;
	size: number;
}

export async function hybridUpload(file: File, opts?: { prefix?: string }): Promise<HybridUploadResult> {
	const decision = await decideProvider();
	const ext = file.name.includes('.') ? file.name.split('.').pop() : 'dat';
	const uniqueName = `${crypto.randomUUID()}.${ext}`;
	const prefix = opts?.prefix ? opts.prefix.replace(/\\+/g,'/').replace(/^\/+|\/+$/g,'') : '';
	const finalPath = prefix ? `${prefix}/${uniqueName}` : uniqueName;
	if (decision.provider === 'supabase') {
		const { data, error } = await (supabase as any).storage.from(SUPABASE_BUCKET).upload(finalPath, file, { upsert: false });
		if (error) throw error;
		const { data: pub } = (supabase as any).storage.from(SUPABASE_BUCKET).getPublicUrl(data.path);
		return { provider: 'supabase', publicUrl: pub.publicUrl, path: data.path, size: file.size };
	} else {
		const res = await fetch('/api/r2-sign-upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: finalPath, contentType: file.type }) });
		if (!res.ok) throw new Error('Signierung fehlgeschlagen');
		const { uploadUrl, publicUrl } = await res.json();
		const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
		if (!put.ok) throw new Error('R2 Upload fehlgeschlagen');
		return { provider: 'r2', publicUrl, path: finalPath, size: file.size };
	}
}

// Optional Helper: direkte Supabase Nutzung erzwingen (z.B. für Debug)
export async function forceSupabaseUpload(file: File) { return hybridUpload(file); }
