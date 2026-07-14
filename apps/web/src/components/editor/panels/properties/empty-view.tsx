import { HugeiconsIcon } from "@hugeicons/react";
import { Settings05Icon } from "@hugeicons/core-free-icons";

import { useTranslations } from "next-intl";

export function EmptyView() {
	const t = useTranslations("Editor");
	return (
		<div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground w-full">
			<HugeiconsIcon icon={Settings05Icon} className="size-8 mb-4 opacity-50" />
			<div className="flex flex-col gap-1 items-center">
				<p className="text-lg font-medium ">{t("emptyProperties")}</p>
				<p className="text-sm opacity-80 max-w-44">
					{t("emptyPropertiesSub")}
				</p>
			</div>
		</div>
	);
}
