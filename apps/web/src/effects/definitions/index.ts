import { effectsRegistry } from "../registry";
import { blurEffectDefinition } from "./blur";
import { chromaKeyEffectDefinition } from "./chroma-key";

export const defaultEffectDefinitions = [blurEffectDefinition, chromaKeyEffectDefinition];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffectDefinitions) {
		if (effectsRegistry.has(definition.type)) {
			continue;
		}
		effectsRegistry.register({
			key: definition.type,
			definition,
		});
	}
}
