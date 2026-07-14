import { buildStickerId, parseStickerId } from "../sticker-id";
import type {
	StickerBrowseResult,
	StickerItem,
	StickerProvider,
	StickerSearchResult,
} from "../types";

const EMOJIS_PROVIDER_ID = "emojis";
const DEFAULT_SEARCH_LIMIT = 100;

let emojisCache: Record<string, string> | null = null;
let emojisList: { name: string; url: string }[] | null = null;

async function loadEmojis() {
	if (emojisList) return emojisList;
	try {
		const res = await fetch("https://api.github.com/emojis");
		if (!res.ok) throw new Error("Failed to fetch emojis");
		emojisCache = await res.json();
		
		emojisList = Object.entries(emojisCache || {}).map(([name, url]) => ({
			name,
			url: url as string,
		}));
		return emojisList;
	} catch (error) {
		console.error("Error loading emojis:", error);
		return [];
	}
}

function toStickerItem({ name, url }: { name: string; url: string }): StickerItem {
	const match = url.match(/unicode\/([a-f0-9\-]+)\.png/);
	const hex = match ? match[1] : name;
	const finalUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}`;

	return {
		id: buildStickerId({
			providerId: EMOJIS_PROVIDER_ID,
			providerValue: hex,
		}),
		provider: EMOJIS_PROVIDER_ID,
		name: name.replace(/_/g, " "),
		previewUrl: finalUrl,
		metadata: {
			emojiName: name,
		},
	};
}

export const emojisProvider: StickerProvider = {
	id: EMOJIS_PROVIDER_ID,
	async search({
		query,
		options,
	}: {
		query: string;
		options?: { limit?: number };
	}): Promise<StickerSearchResult> {
		const emojis = await loadEmojis();
		const normalizedQuery = query.trim().toLowerCase();
		
		const filtered = normalizedQuery
			? emojis.filter((e) => e.name.toLowerCase().includes(normalizedQuery))
			: emojis;

		const limit = options?.limit ?? DEFAULT_SEARCH_LIMIT;
		const items = filtered.slice(0, limit);

		return {
			items: items.map(toStickerItem),
			total: filtered.length,
			hasMore: filtered.length > limit,
		};
	},
	async browse({
		options,
	}: {
		options?: { page?: number; limit?: number };
	}): Promise<StickerBrowseResult> {
		const emojis = await loadEmojis();
		
		const page = Math.max(1, options?.page ?? 1);
		const limit = Math.max(1, options?.limit ?? DEFAULT_SEARCH_LIMIT);
		const startIndex = (page - 1) * limit;
		const endIndex = startIndex + limit;
		const items = emojis.slice(startIndex, endIndex);

		return {
			sections: [
				{
					id: "all",
					items: items.map(toStickerItem),
					hasMore: endIndex < emojis.length,
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
		let url = `https://github.githubassets.com/images/icons/emoji/unicode/${providerValue}.png?v8`;
		// Proxy through wsrv.nl to add CORS headers
		return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
	},
};
