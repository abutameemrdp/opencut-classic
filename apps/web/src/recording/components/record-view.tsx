"use client";

import {
	useRef,
	useState,
	useEffect,
	useCallback,
} from "react";
import { useEditor } from "@/editor/use-editor";
import { processMediaAssets } from "@/media/processing";
import { useScreenRecorder, type RecordingMode } from "@/recording/hooks/use-screen-recorder";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ComputerIcon,
	Camera02Icon,
	Layout01Icon,
	RecordIcon,
	PauseIcon,
	StopIcon,
	CheckmarkCircle01Icon,
	Cancel01Icon,
	InformationCircleIcon,
	Image01Icon,
	PaintBoardIcon,
	BlurIcon,
	SquareIcon,
} from "@hugeicons/core-free-icons";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	}
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// Mode selector card
// ─────────────────────────────────────────────────────────────

function ModeCard({
	mode,
	activeMode,
	icon,
	label,
	description,
	onClick,
}: {
	mode: RecordingMode;
	activeMode: RecordingMode;
	icon: React.ReactNode;
	label: string;
	description: string;
	onClick: () => void;
}) {
	const isActive = mode === activeMode;
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-all cursor-pointer",
				isActive
					? "border-primary bg-primary/10 text-primary"
					: "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground hover:text-foreground hover:bg-muted/50",
			)}
		>
			<div className={cn("rounded-md p-2", isActive ? "bg-primary/15" : "bg-background")}>
				{icon}
			</div>
			<div>
				<p className="text-xs font-semibold leading-tight">{label}</p>
				<p className="text-xs opacity-70 leading-tight mt-0.5">{description}</p>
			</div>
		</button>
	);
}

// ─────────────────────────────────────────────────────────────
// Recording timer badge
// ─────────────────────────────────────────────────────────────

function TimerBadge({
	elapsedMs,
	isPaused,
}: {
	elapsedMs: number;
	isPaused: boolean;
}) {
	return (
		<div
			className={cn(
				"absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-mono font-bold text-white shadow",
				isPaused ? "bg-yellow-600/90" : "bg-red-600/90",
			)}
		>
			<span
				className={cn(
					"size-2 rounded-full bg-white",
					!isPaused && "animate-pulse",
				)}
			/>
			{formatTime(elapsedMs)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────
// Main RecordView component
// ─────────────────────────────────────────────────────────────

export function RecordView() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const [isSaving, setIsSaving] = useState(false);
	const t = useTranslations("Record");

	const {
		status,
		elapsedMs,
		error,
		attachPreview,
		requestPreview,
		startRecording,
		pauseRecording,
		resumeRecording,
		stopRecording,
		cancelPreview,
		mode,
		setMode,
		bgType,
		setBgType,
		bgColor,
		setBgColor,
		bgImage,
		setBgImage,
		pipPosition,
		setPipPosition,
		pipShape,
		setPipShape,
	} = useScreenRecorder({
		mode: "pip",
		onRecordingComplete: async ({ blob, mimeType }) => {
			if (!activeProject) {
				toast.error("No active project");
				return;
			}

			setIsSaving(true);
			try {
				const ext = mimeType.includes("mp4") ? "mp4" : "webm";
				const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
				const filename = `recording-${timestamp}.${ext}`;
				const file = new File([blob], filename, { type: mimeType });

				const processed = await processMediaAssets({ files: [file] });
				for (const asset of processed) {
					await editor.media.addMediaAsset({
						projectId: activeProject.metadata.id,
						asset,
					});
				}

				toast.success(t("savedTitle"), {
					description: t("savedDesc1") + "\n" + t("savedDesc2"),
				});
			} catch (err) {
				toast.error("Failed to save recording");
				console.error(err);
			} finally {
				setIsSaving(false);
			}
		},
	});

	const isIdle = status === "idle";
	const isPreviewing = status === "previewing";
	const isRecording = status === "recording";
	const isPaused = status === "paused";
	const isStopped = status === "stopped";
	const isActive = isRecording || isPaused;

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="border-b px-3.5 h-11 shrink-0 flex items-center">
				<span className="text-muted-foreground text-sm">{t("title")}</span>
			</div>

			<div className="flex-1 overflow-y-auto scrollbar-hidden p-3 flex flex-col gap-4">

				{/* ── Mode selector (only shown when idle) ── */}
				{isIdle && (
					<div>
						<p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
							{t("recordingMode")}
						</p>
						<div className="grid grid-cols-3 gap-2">
							<ModeCard
								mode="screen"
								activeMode={mode}
								icon={<HugeiconsIcon icon={ComputerIcon} size={18} />}
								label={t("screen")}
								description={t("shareScreen")}
								onClick={() => setMode("screen")}
							/>
							<ModeCard
								mode="camera"
								activeMode={mode}
								icon={<HugeiconsIcon icon={Camera02Icon} size={18} />}
								label={t("camera")}
								description={t("webcamOnly")}
								onClick={() => setMode("camera")}
							/>
							<ModeCard
								mode="pip"
								activeMode={mode}
								icon={<HugeiconsIcon icon={Layout01Icon} size={18} />}
								label={t("pip")}
								description={t("screenCam")}
								onClick={() => setMode("pip")}
							/>
						</div>
					</div>
				)}

				{/* ── Background & Layout (shown when idle or previewing) ── */}
				{(isIdle || isPreviewing) && (
					<>
						{/* Background selector for camera/pip modes */}
						{(mode === "camera" || mode === "pip") && (
							<div>
								<p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
									{t("cameraBackground")}
								</p>
								<div className="grid grid-cols-5 gap-2 mb-2">
									<Button
										variant="outline"
										size="sm"
										className={cn("h-16 flex-col gap-1.5", bgType === "none" && "bg-primary/10 border-primary")}
										onClick={() => setBgType("none")}
									>
										<HugeiconsIcon icon={Cancel01Icon} size={16} />
										<span className="text-[10px]">{t("none")}</span>
									</Button>
									<Button
										variant="outline"
										size="sm"
										className={cn("h-16 flex-col gap-1.5", bgType === "blur" && "bg-primary/10 border-primary")}
										onClick={() => setBgType("blur")}
									>
										<HugeiconsIcon icon={BlurIcon} size={16} />
										<span className="text-[10px]">{t("blur")}</span>
									</Button>
									<Button
										variant="outline"
										size="sm"
										className={cn("h-16 flex-col gap-1.5", bgType === "transparent" && "bg-primary/10 border-primary")}
										onClick={() => setBgType("transparent")}
									>
										<HugeiconsIcon icon={SquareIcon} size={16} />
										<span className="text-[10px]">{t("clear")}</span>
									</Button>
									<Button
										variant="outline"
										size="sm"
										className={cn("h-16 flex-col gap-1.5", bgType === "color" && "bg-primary/10 border-primary")}
										onClick={() => setBgType("color")}
									>
										<HugeiconsIcon icon={PaintBoardIcon} size={16} />
										<span className="text-[10px]">{t("color")}</span>
									</Button>
									<Button
										variant="outline"
										size="sm"
										className={cn("h-16 flex-col gap-1.5", bgType === "image" && "bg-primary/10 border-primary")}
										onClick={() => setBgType("image")}
									>
										<HugeiconsIcon icon={Image01Icon} size={16} />
										<span className="text-[10px]">{t("image")}</span>
									</Button>
								</div>

								{bgType === "color" && (
									<div className="flex items-center gap-2 mt-2 p-2 border rounded-md">
										<span className="text-xs text-muted-foreground">{t("pickColor")}</span>
										<input
											type="color"
											value={bgColor}
											onChange={(e) => setBgColor(e.target.value)}
											className="h-6 w-full cursor-pointer rounded-sm border-none bg-transparent"
										/>
									</div>
								)}

								{bgType === "image" && (
									<div className="flex flex-col gap-2 mt-2 p-2 border rounded-md">
										<span className="text-xs text-muted-foreground">{t("uploadBgImage")}</span>
										<input
											type="file"
											accept="image/*"
											onChange={(e) => {
												const file = e.target.files?.[0];
												if (file) {
													const url = URL.createObjectURL(file);
													setBgImage(url);
												}
											}}
											className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-sm file:border-0 file:text-xs file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
										/>
									</div>
								)}
							</div>
						)}

						{/* PiP Layout Options */}
						{mode === "pip" && (
							<div>
								<p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
									{t("cameraLayout")}
								</p>
								<div className="flex flex-col gap-3">
									<div className="flex items-center gap-2">
										<span className="text-xs text-muted-foreground w-16">{t("position")}</span>
										<select 
											className="h-8 flex-1 text-xs bg-background border rounded-md px-2"
											value={pipPosition}
											onChange={(e) => setPipPosition(e.target.value as any)}
										>
											<option value="bottom-right">{t("bottomRight")}</option>
											<option value="bottom-left">{t("bottomLeft")}</option>
											<option value="top-right">{t("topRight")}</option>
											<option value="top-left">{t("topLeft")}</option>
										</select>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-xs text-muted-foreground w-16">{t("shape")}</span>
										<select 
											className="h-8 flex-1 text-xs bg-background border rounded-md px-2"
											value={pipShape}
											onChange={(e) => setPipShape(e.target.value as any)}
										>
											<option value="rectangle">{t("rectangle")}</option>
											<option value="rounded">{t("rounded")}</option>
											<option value="circle">{t("circle")}</option>
										</select>
									</div>
								</div>
							</div>
						)}

						{/* Info tip */}
						<div className="flex items-start gap-2 rounded-md bg-muted/40 border px-3 py-2.5 text-xs text-muted-foreground">
							<HugeiconsIcon
								icon={InformationCircleIcon}
								size={14}
								className="mt-0.5 shrink-0 text-primary"
							/>
							<span>
								{mode === "screen" && t("infoScreen")}
								{mode === "camera" && t("infoCamera")}
								{mode === "pip" && t("infoPip")}
							</span>
						</div>

						{isIdle && (
							<Button
								onClick={requestPreview}
								className="w-full gap-2"
								size="lg"
							>
								{t("startPreview")}
							</Button>
						)}
					</>
				)}

				{/* ── Preview / Recording view ── */}
				{(isPreviewing || isActive) && (
					<div className="flex flex-col gap-3">
						{/* Video preview area */}
						<div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black border border-border shadow-md">
							<video
								ref={attachPreview}
								autoPlay
								muted
								playsInline
								className="w-full h-full object-contain"
							/>

							{/* Recording timer */}
							{isActive && (
								<TimerBadge elapsedMs={elapsedMs} isPaused={isPaused} />
							)}

							{/* "Previewing" label */}
							{isPreviewing && (
								<div className="absolute top-3 left-3 rounded-full bg-blue-600/80 px-2.5 py-1 text-xs font-bold text-white">
									{t("preview")}
								</div>
							)}
						</div>

						{/* Controls */}
						<div className="flex gap-2">
							{isPreviewing && (
								<Button
									size="lg"
									onClick={startRecording}
									className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
								>
									<span className="size-2.5 rounded-full bg-white animate-pulse" />
									{t("record")}
								</Button>
							)}

							{isActive && (
								<Button
									onClick={isRecording ? pauseRecording : resumeRecording}
									variant="outline"
									className="flex-1 gap-2"
									size="lg"
								>
									{isPaused ? (
										<>
											<HugeiconsIcon icon={RecordIcon} size={20} />
											<span>{t("resume")}</span>
										</>
									) : (
										<>
											<HugeiconsIcon icon={PauseIcon} size={20} />
											<span>{t("pause")}</span>
										</>
									)}
								</Button>
							)}

							{(isPreviewing || isActive) && (
								<Button
									size="lg"
									variant={isActive ? "destructive" : "outline"}
									onClick={isActive ? stopRecording : cancelPreview}
									className={cn("gap-2", isActive && "bg-foreground hover:bg-foreground/90 text-background")}
								>
									{isActive ? (
										<>
											<HugeiconsIcon icon={StopIcon} size={20} />
											<span>{t("stop")}</span>
										</>
									) : (
										t("cancel")
									)}
								</Button>
							)}
						</div>

						{/* Elapsed time display when recording */}
						{isActive && (
							<div className="mt-4 rounded-md border p-3 text-center text-sm text-muted-foreground">
								{isPaused ? t("paused") : t("recording")}
							</div>
						)}
					</div>
				)}

				{/* ── Processing / Saved states ── */}
				{isSaving && (
					<div className="flex flex-col items-center gap-3 py-8">
						<div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
						<p className="text-sm text-muted-foreground">
							{t("processing")}
						</p>
					</div>
				)}

				{isStopped && !isSaving && (
					<div className="flex flex-col items-center gap-3 py-6 text-center">
						<HugeiconsIcon
							icon={CheckmarkCircle01Icon}
							size={36}
							className="text-green-500"
						/>
						<div>
							<h3 className="font-semibold">{t("savedTitle")}</h3>
							<p className="text-sm text-muted-foreground mt-1 text-balance">
								{t("savedDesc1")}
								<br />
								{t("savedDesc2")}
							</p>
						</div>
						<Button
							className="w-full gap-2 mt-4"
							onClick={() => {
								cancelPreview();
								setMode("pip");
							}}
						>
							<HugeiconsIcon icon={RecordIcon} size={16} />
							{t("recordNew")}
						</Button>
					</div>
				)}

				{/* ── Error message ── */}
				{error && (
					<div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
						{error}
					</div>
				)}
			</div>
		</div>
	);
}

// Helper – status is stopped but not saving
function isSaved(status: string) {
	return false; // only used to suppress TSC unreachable warning
}
