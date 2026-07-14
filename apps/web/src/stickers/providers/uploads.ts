import { buildStickerId, parseStickerId } from "../sticker-id";
import type {
	StickerBrowseResult,
	StickerItem,
	StickerProvider,
	StickerSearchResult,
} from "../types";

export const UPLOADS_PROVIDER_ID = "uploads";

async function loadUploadedStickers(): Promise<string[]> {
	try {
		const res = await fetch("/api/stickers");
		if (!res.ok) return [];
		const data = await res.json();
		return data.urls || [];
	} catch (error) {
		console.error("Error loading uploaded stickers:", error);
		return [];
	}
}

function toStickerItem(url: string, index: number): StickerItem {
	// We'll use the URL path (or a part of it) as the provider value
	// For simplicity, we just base64 encode the URL so it can be parsed easily
	const encodedUrl = encodeURIComponent(url);
	return {
		id: buildStickerId({
			providerId: UPLOADS_PROVIDER_ID,
			providerValue: encodedUrl,
		}),
		provider: UPLOADS_PROVIDER_ID,
		name: `Custom Sticker ${index + 1}`,
		previewUrl: url,
		metadata: {},
	};
}

export const uploadsProvider: StickerProvider = {
	id: UPLOADS_PROVIDER_ID,
	async search({
		query,
		options,
	}: {
		query: string;
		options?: { limit?: number };
	}): Promise<StickerSearchResult> {
		// Searching custom stickers isn't implemented yet, just return empty
		return {
			items: [],
			total: 0,
			hasMore: false,
		};
	},
	async browse({
		options,
	}: {
		options?: { page?: number; limit?: number };
	}): Promise<StickerBrowseResult> {
		const urls = await loadUploadedStickers();
		
		const page = Math.max(1, options?.page ?? 1);
		const limit = Math.max(1, options?.limit ?? 50);
		const startIndex = (page - 1) * limit;
		const endIndex = startIndex + limit;
		const items = urls.slice(startIndex, endIndex);

		return {
			sections: [
				{
					id: "all",
					items: items.map((url, i) => toStickerItem(url, startIndex + i)),
					hasMore: endIndex < urls.length,
					layout: "grid",
				},
			],
		};
	},
	resolveUrl({
		stickerId,
	}: {
		stickerId: string;
		options?: { width?: number; height?: number };
	}): string {
		const { providerValue } = parseStickerId({ stickerId });
		return decodeURIComponent(providerValue);
	},
};
