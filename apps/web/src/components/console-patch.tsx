"use client";

import { useEffect } from "react";

export function ConsolePatch() {
	useEffect(() => {
		const originalError = console.error;
		console.error = (...args: any[]) => {
			if (
				typeof args[0] === "string" &&
				args[0].includes(
					"A VideoSample was garbage collected without first being closed"
				)
			) {
				return;
			}
			originalError.apply(console, args);
		};
	}, []);
	return null;
}
