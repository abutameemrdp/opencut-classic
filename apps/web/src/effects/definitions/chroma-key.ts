import type { EffectDefinition } from "@/effects/types";

export const CHROMA_KEY_SHADER = "chroma-key";

// Convert hex color to rgb [0-1]
function hexToRgb(hex: string): [number, number, number] {
	const cleanHex = hex.replace("#", "");
	const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
	const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
	const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
	return [r, g, b];
}

export const chromaKeyEffectDefinition: EffectDefinition = {
	type: "chroma-key",
	name: "Chroma Key",
	keywords: ["chroma", "green screen", "keying", "remove background"],
	params: [
		{
			key: "color",
			label: "Color",
			type: "color",
			default: "#00FF00",
		},
		{
			key: "similarity",
			label: "Similarity",
			type: "number",
			default: 0.1,
			min: 0,
			max: 1.0,
			step: 0.01,
		},
		{
			key: "smoothness",
			label: "Smoothness",
			type: "number",
			default: 0.05,
			min: 0,
			max: 0.5,
			step: 0.01,
		},
	],
	renderer: {
		passes: [
			{
				shader: CHROMA_KEY_SHADER,
				uniforms: ({ effectParams }) => ({
					u_color: hexToRgb((effectParams.color as string) || "#00FF00"),
					u_similarity: (effectParams.similarity as number) ?? 0.1,
					u_smoothness: (effectParams.smoothness as number) ?? 0.05,
				}),
			},
		],
		buildPasses: ({ effectParams }) => {
			return [
				{
					shader: CHROMA_KEY_SHADER,
					uniforms: {
						u_color: hexToRgb((effectParams.color as string) || "#00FF00"),
						u_similarity: (effectParams.similarity as number) ?? 0.1,
						u_smoothness: (effectParams.smoothness as number) ?? 0.05,
					},
				},
			];
		},
	},
};
