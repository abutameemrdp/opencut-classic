"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LanguageSwitcher() {
	const locale = useLocale();
	const router = useRouter();
	const pathname = usePathname();

	const handleLocaleChange = (newLocale: string) => {
		router.replace(pathname, { locale: newLocale });
	};

	return (
		<Select value={locale} onValueChange={handleLocaleChange}>
			<SelectTrigger className="w-[100px] h-8 text-xs">
				<SelectValue placeholder="Language" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="ar">العربية</SelectItem>
				<SelectItem value="en">English</SelectItem>
			</SelectContent>
		</Select>
	);
}
