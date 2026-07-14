import { ThemeProvider } from "next-themes";
import Script from "next/script";
import "../globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ChangelogNotification } from "@/changelog/components/changelog-notification";
import { TooltipProvider } from "@/components/ui/tooltip";
import { baseMetaData } from "../metadata";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { BotIdClient } from "botid/client";
import { webEnv } from "@/env/web";
import { Inter } from "next/font/google";
import { ConsolePatch } from "@/components/console-patch";

const siteFont = Inter({ subsets: ["latin"] });

export const metadata = baseMetaData;

const protectedRoutes = [
	{
		path: "/none",
		method: "GET",
	},
];

export default async function RootLayout({
	children,
	params,
}: Readonly<{
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}>) {
	const { locale } = await params;
	const messages = await getMessages();
	const dir = locale === "ar" ? "rtl" : "ltr";

	return (
		<html lang={locale} dir={dir} suppressHydrationWarning>
			<head>
				<BotIdClient protect={protectedRoutes} />

			</head>
			<body className={`${siteFont.className} font-sans antialiased`}>
				<ConsolePatch />
				<NextIntlClientProvider messages={messages}>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						disableTransitionOnChange={true}
					>
						<TooltipProvider>
							<Toaster />
							<Script
								src="https://cdn.databuddy.cc/databuddy.js"
								strategy="afterInteractive"
								async
								data-client-id="UP-Wcoy5arxFeK7oyjMMZ"
								data-disabled={webEnv.NODE_ENV === "development"}
								data-track-attributes={false}
								data-track-errors={true}
								data-track-outgoing-links={false}
								data-track-web-vitals={false}
								data-track-sessions={false}
							/>
							{children}
						</TooltipProvider>
					</ThemeProvider>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
