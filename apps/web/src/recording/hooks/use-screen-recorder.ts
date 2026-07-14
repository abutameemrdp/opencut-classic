import { useState, useCallback, useRef, useEffect } from "react";

import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

export type RecordingMode = "screen" | "camera" | "pip";
export type BackgroundType = "none" | "transparent" | "blur" | "color" | "image";
export type PipPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";
export type PipShape = "rectangle" | "circle" | "rounded";
export type RecorderStatus =
	| "idle"
	| "requesting"
	| "previewing"
	| "recording"
	| "paused"
	| "stopped";

export interface RecordingResult {
	blob: Blob;
	durationMs: number;
	mimeType: string;
}

interface UseScreenRecorderOptions {
	mode: RecordingMode;
	onRecordingComplete?: (result: RecordingResult) => void;
}

export function useScreenRecorder({
	mode: initialMode,
	onRecordingComplete,
}: UseScreenRecorderOptions) {
	const [status, setStatus] = useState<RecorderStatus>("idle");
	const [mode, setMode] = useState<RecordingMode>(initialMode);
	const [bgType, setBgType] = useState<BackgroundType>("none");
	const [bgColor, setBgColor] = useState<string>("#000000");
	const [bgImage, setBgImage] = useState<string | null>(null);
	const [pipPosition, setPipPosition] = useState<PipPosition>("bottom-right");
	const [pipShape, setPipShape] = useState<PipShape>("rounded");
	const [elapsedMs, setElapsedMs] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const bgTypeRef = useRef(bgType);
	useEffect(() => { bgTypeRef.current = bgType; }, [bgType]);

	const bgColorRef = useRef(bgColor);
	useEffect(() => { bgColorRef.current = bgColor; }, [bgColor]);

	const pipPositionRef = useRef(pipPosition);
	useEffect(() => { pipPositionRef.current = pipPosition; }, [pipPosition]);

	const pipShapeRef = useRef(pipShape);
	useEffect(() => { pipShapeRef.current = pipShape; }, [pipShape]);

	// Refs that persist across renders without causing re-renders
	const screenStreamRef = useRef<MediaStream | null>(null);
	const cameraStreamRef = useRef<MediaStream | null>(null);
	const combinedStreamRef = useRef<MediaStream | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const startTimeRef = useRef<number>(0);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const animFrameRef = useRef<number | null>(null);

	// Video element refs for preview
	const screenVideoRef = useRef<HTMLVideoElement | null>(null);
	const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
	const previewVideoRef = useRef<HTMLVideoElement | null>(null);
	const bgImageElementRef = useRef<HTMLImageElement | null>(null);

	const segmenterRef = useRef<ImageSegmenter | null>(null);
	const processedCameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

	// Load background image
	useEffect(() => {
		if (bgType === "image" && bgImage) {
			const img = new Image();
			img.src = bgImage;
			img.onload = () => {
				bgImageElementRef.current = img;
			};
		}
	}, [bgType, bgImage]);

	// Initialize MediaPipe segmenter
	useEffect(() => {
		let isMounted = true;
		if (bgType !== "none" && !segmenterRef.current) {
			(async () => {
				const vision = await FilesetResolver.forVisionTasks(
					"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
				);
				const segmenter = await ImageSegmenter.createFromOptions(vision, {
					baseOptions: {
						modelAssetPath:
							"https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
						delegate: "GPU",
					},
					runningMode: "VIDEO",
					outputCategoryMask: true,
					outputConfidenceMasks: false,
				});
				if (isMounted) segmenterRef.current = segmenter;
			})();
		}
		return () => {
			isMounted = false;
		};
	}, [bgType]);

	const stopTimer = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const startTimer = useCallback(() => {
		startTimeRef.current = Date.now() - elapsedMs;
		timerRef.current = setInterval(() => {
			setElapsedMs(Date.now() - startTimeRef.current);
		}, 100);
	}, [elapsedMs]);

	const stopAllStreams = useCallback(() => {
		if (animFrameRef.current) {
			cancelAnimationFrame(animFrameRef.current);
			animFrameRef.current = null;
		}
		screenStreamRef.current?.getTracks().forEach((t) => t.stop());
		cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
		screenStreamRef.current = null;
		cameraStreamRef.current = null;
		combinedStreamRef.current = null;
	}, []);

	// Process camera frame with background effects
	const processCameraFrame = useCallback(async (video: HTMLVideoElement) => {
		if (bgTypeRef.current === "none" || !segmenterRef.current) return video;

		const w = video.videoWidth;
		const h = video.videoHeight;

		if (!processedCameraCanvasRef.current) {
			processedCameraCanvasRef.current = document.createElement("canvas");
		}
		if (!maskCanvasRef.current) {
			maskCanvasRef.current = document.createElement("canvas");
		}

		const pCanvas = processedCameraCanvasRef.current;
		const mCanvas = maskCanvasRef.current;

		if (pCanvas.width !== w) {
			pCanvas.width = w;
			pCanvas.height = h;
			mCanvas.width = w;
			mCanvas.height = h;
		}

		const pCtx = pCanvas.getContext("2d");
		const mCtx = mCanvas.getContext("2d");
		if (!pCtx || !mCtx) return video;

		return new Promise<HTMLCanvasElement>((resolve) => {
			segmenterRef.current!.segmentForVideo(video, performance.now(), (result) => {
				if (!result.categoryMask) {
					resolve(pCanvas);
					return;
				}

				// We'll set alpha to 255 where the person is.
				const maskArray = result.categoryMask.getAsUint8Array();
				const maskImgData = new ImageData(w, h);
				const data = maskImgData.data;
				
				for (let i = 0; i < maskArray.length; i++) {
					// Invert the mask: 0 represents the person in this model's output
					const isPerson = maskArray[i] === 0; 
					data[i * 4] = 0;
					data[i * 4 + 1] = 0;
					data[i * 4 + 2] = 0;
					data[i * 4 + 3] = isPerson ? 255 : 0;
				}
				mCtx.putImageData(maskImgData, 0, 0);

				pCtx.save();
				pCtx.clearRect(0, 0, w, h);

				if (bgTypeRef.current === "blur") {
					// Draw sharp video
					pCtx.drawImage(video, 0, 0, w, h);
					
					// Destination-in with the mask (keeps the sharp person, erases background)
					pCtx.globalCompositeOperation = "destination-in";
					pCtx.drawImage(mCanvas, 0, 0, w, h);
					
					// Draw blurred video behind the person
					pCtx.globalCompositeOperation = "destination-over";
					pCtx.filter = "blur(10px)";
					pCtx.drawImage(video, 0, 0, w, h);
					pCtx.filter = "none";
				} else {
					// Draw sharp video
					pCtx.drawImage(video, 0, 0, w, h);
					
					// Keep only the person
					pCtx.globalCompositeOperation = "destination-in";
					pCtx.drawImage(mCanvas, 0, 0, w, h);

					// Draw background behind the person
					pCtx.globalCompositeOperation = "destination-over";
					if (bgTypeRef.current === "color") {
						pCtx.fillStyle = bgColorRef.current;
						pCtx.fillRect(0, 0, w, h);
					} else if (bgTypeRef.current === "image" && bgImageElementRef.current) {
						pCtx.drawImage(bgImageElementRef.current, 0, 0, w, h);
					}
				}

				pCtx.restore();
				resolve(pCanvas);
			});
		});
	}, []);

	// Camera only: Draw processed camera on canvas
	const startCameraCanvas = useCallback(
		(canvas: HTMLCanvasElement, cameraVideo: HTMLVideoElement) => {
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			const draw = async () => {
				if (!cameraVideo.videoWidth) {
					animFrameRef.current = requestAnimationFrame(draw);
					return;
				}

				if (canvas.width !== cameraVideo.videoWidth) {
					canvas.width = cameraVideo.videoWidth;
					canvas.height = cameraVideo.videoHeight;
				}

				const processedCamera = await processCameraFrame(cameraVideo);
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(processedCamera, 0, 0, canvas.width, canvas.height);

				animFrameRef.current = requestAnimationFrame(draw);
			};

			draw();
		},
		[processCameraFrame],
	);

	// PiP: Draw screen + camera overlay on a canvas
	const startCanvasMerge = useCallback(
		(canvas: HTMLCanvasElement, screenVideo: HTMLVideoElement, cameraVideo: HTMLVideoElement) => {
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			const draw = async () => {
				if (!screenVideo.videoWidth || !cameraVideo.videoWidth) {
					animFrameRef.current = requestAnimationFrame(draw);
					return;
				}

				// Set canvas size to screen stream dimensions
				if (canvas.width !== screenVideo.videoWidth) {
					canvas.width = screenVideo.videoWidth;
					canvas.height = screenVideo.videoHeight;
				}

				// Draw screen
				ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

				// Process camera frame
				const processedCamera = await processCameraFrame(cameraVideo);

				// Calculate camera dimensions and position
				const currentPipShape = pipShapeRef.current;
				const currentPipPosition = pipPositionRef.current;
				
				const camW = currentPipShape === "circle" ? Math.floor(canvas.width * 0.20) : Math.floor(canvas.width * 0.25);
				let camH = Math.floor(camW * (cameraVideo.videoHeight / cameraVideo.videoWidth));
				if (currentPipShape === "circle") {
					camH = camW; // Force 1:1 aspect ratio for circle
				}

				let camX = 20;
				let camY = 20;
				
				if (currentPipPosition.includes("right")) camX = canvas.width - camW - 20;
				if (currentPipPosition.includes("bottom")) camY = canvas.height - camH - 20;

				// Clipping shape for camera
				ctx.save();
				ctx.beginPath();
				if (currentPipShape === "circle") {
					ctx.arc(camX + camW / 2, camY + camH / 2, camW / 2, 0, Math.PI * 2);
				} else if (currentPipShape === "rounded") {
					ctx.roundRect(camX, camY, camW, camH, 12);
				} else {
					ctx.rect(camX, camY, camW, camH);
				}
				ctx.clip();
				
				// Calculate source crop for 1:1 circle from 16:9 camera feed
				if (currentPipShape === "circle") {
					const srcSize = Math.min(cameraVideo.videoWidth, cameraVideo.videoHeight);
					const srcX = (cameraVideo.videoWidth - srcSize) / 2;
					const srcY = (cameraVideo.videoHeight - srcSize) / 2;
					ctx.drawImage(processedCamera, srcX, srcY, srcSize, srcSize, camX, camY, camW, camH);
				} else {
					ctx.drawImage(processedCamera, camX, camY, camW, camH);
				}
				ctx.restore();

				// Border around camera
				if (bgTypeRef.current !== "transparent") {
					ctx.save();
					ctx.lineWidth = 4;
					ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
					ctx.beginPath();
					if (currentPipShape === "circle") {
						ctx.arc(camX + camW / 2, camY + camH / 2, camW / 2, 0, Math.PI * 2);
					} else if (currentPipShape === "rounded") {
						ctx.roundRect(camX, camY, camW, camH, 12);
					} else {
						ctx.rect(camX, camY, camW, camH);
					}
					ctx.stroke();
					ctx.restore();
				}

				animFrameRef.current = requestAnimationFrame(draw);
			};

			draw();
		},
		[processCameraFrame],
	);

	const requestPreview = useCallback(async () => {
		setError(null);
		setStatus("requesting");

		try {
			let stream: MediaStream;

			if (mode === "screen") {
				const screenStream = await navigator.mediaDevices.getDisplayMedia({
					video: { frameRate: 30 },
					audio: true,
				});
				screenStreamRef.current = screenStream;
				stream = screenStream;
			} else if (mode === "camera") {
				const cameraStream = await navigator.mediaDevices.getUserMedia({
					video: { width: 1280, height: 720, frameRate: 30 },
					audio: true,
				});
				cameraStreamRef.current = cameraStream;
				
				if (bgType !== "none") {
					const camVid = document.createElement("video");
					camVid.srcObject = cameraStream;
					camVid.muted = true;
					camVid.play();
					cameraVideoRef.current = camVid;

					const canvas = document.createElement("canvas");
					canvas.width = 1280;
					canvas.height = 720;
					canvasRef.current = canvas;

					await new Promise<void>((resolve) => {
						camVid.onloadedmetadata = () => resolve();
					});

					startCameraCanvas(canvas, camVid);

					const canvasStream = canvas.captureStream(30);
					cameraStream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
					combinedStreamRef.current = canvasStream;
					stream = canvasStream;
				} else {
					stream = cameraStream;
				}
			} else {
				// PiP: screen + camera
				const [screenStream, cameraStream] = await Promise.all([
					navigator.mediaDevices.getDisplayMedia({
						video: { frameRate: 30 },
						audio: true,
					}),
					navigator.mediaDevices.getUserMedia({
						video: { width: 320, height: 240, frameRate: 30 },
						audio: true, // Request microphone
					}),
				]);
				screenStreamRef.current = screenStream;
				cameraStreamRef.current = cameraStream;

				// Set up hidden video elements to drive the canvas
				const screenVid = document.createElement("video");
				screenVid.srcObject = screenStream;
				screenVid.muted = true;
				screenVid.play();
				screenVideoRef.current = screenVid;

				const camVid = document.createElement("video");
				camVid.srcObject = cameraStream;
				camVid.muted = true;
				camVid.play();
				cameraVideoRef.current = camVid;

				// Create canvas for merged output
				const canvas = document.createElement("canvas");
				canvas.width = 1920;
				canvas.height = 1080;
				canvasRef.current = canvas;

				// Wait for metadata then start drawing
				await new Promise<void>((resolve) => {
					screenVid.onloadedmetadata = () => resolve();
				});

				startCanvasMerge(canvas, screenVid, camVid);

				// Create combined stream from canvas + mixed audio
				const canvasStream = canvas.captureStream(30);
				
				// Mix audio from screen and microphone
				const audioCtx = new AudioContext();
				const dest = audioCtx.createMediaStreamDestination();
				let hasAudio = false;

				if (screenStream.getAudioTracks().length > 0) {
					const screenSource = audioCtx.createMediaStreamSource(screenStream);
					screenSource.connect(dest);
					hasAudio = true;
				}
				if (cameraStream.getAudioTracks().length > 0) {
					const cameraSource = audioCtx.createMediaStreamSource(cameraStream);
					cameraSource.connect(dest);
					hasAudio = true;
				}

				if (hasAudio) {
					dest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
				}
				
				combinedStreamRef.current = canvasStream;
				stream = canvasStream;
			}

			// Update the preview video
			if (previewVideoRef.current) {
				if (mode === "pip") {
					// For PiP, preview shows the canvas stream
					previewVideoRef.current.srcObject = combinedStreamRef.current;
				} else {
					previewVideoRef.current.srcObject = stream;
				}
				previewVideoRef.current.muted = true;
				await previewVideoRef.current.play();
			}

			// Listen for stream ending (user clicked "Stop sharing")
			const primaryStream = screenStreamRef.current ?? cameraStreamRef.current;
			primaryStream?.getVideoTracks()[0]?.addEventListener("ended", () => {
				stopRecording();
			});

			setStatus("previewing");
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to access media devices";
			setError(message);
			setStatus("idle");
			stopAllStreams();
		}
	}, [mode, startCanvasMerge, stopAllStreams, bgType, processCameraFrame]);

	const startRecording = useCallback(() => {
		const stream =
			combinedStreamRef.current ??
			screenStreamRef.current ??
			cameraStreamRef.current;

		if (!stream) {
			setError("No stream available. Please start preview first.");
			return;
		}

		chunksRef.current = [];
		const mimeType = getSupportedMimeType();
		const recorder = new MediaRecorder(stream, { mimeType });

		recorder.ondataavailable = (e) => {
			if (e.data.size > 0) chunksRef.current.push(e.data);
		};

		recorder.onstop = () => {
			stopTimer();
			const blob = new Blob(chunksRef.current, { type: mimeType });
			onRecordingComplete?.({ blob, durationMs: elapsedMs, mimeType });
			setStatus("stopped");
			stopAllStreams();
		};

		recorder.start(1000); // collect data every second
		mediaRecorderRef.current = recorder;
		setElapsedMs(0);
		startTimer();
		setStatus("recording");
	}, [elapsedMs, startTimer, stopTimer, stopAllStreams, onRecordingComplete]);

	const pauseRecording = useCallback(() => {
		if (mediaRecorderRef.current?.state === "recording") {
			mediaRecorderRef.current.pause();
			stopTimer();
			setStatus("paused");
		}
	}, [stopTimer]);

	const resumeRecording = useCallback(() => {
		if (mediaRecorderRef.current?.state === "paused") {
			mediaRecorderRef.current.resume();
			startTimer();
			setStatus("recording");
		}
	}, [startTimer]);

	const stopRecording = useCallback(() => {
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state !== "inactive"
		) {
			mediaRecorderRef.current.stop();
		} else {
			// If not recording yet, just cancel the preview
			stopAllStreams();
			setStatus("idle");
			setElapsedMs(0);
		}
		stopTimer();
	}, [stopTimer, stopAllStreams]);

	const cancelPreview = useCallback(() => {
		stopAllStreams();
		setStatus("idle");
		setElapsedMs(0);
		setError(null);
		if (previewVideoRef.current) {
			previewVideoRef.current.srcObject = null;
		}
	}, [stopAllStreams]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stopTimer();
			stopAllStreams();
		};
	}, [stopTimer, stopAllStreams]);

	const attachPreview = useCallback((node: HTMLVideoElement | null) => {
		previewVideoRef.current = node;
		if (node) {
			const stream = mode === "pip" ? combinedStreamRef.current : (screenStreamRef.current ?? cameraStreamRef.current);
			if (stream && node.srcObject !== stream) {
				node.srcObject = stream;
				node.muted = true;
				node.play().catch(console.error);
			}
		}
	}, [mode]);

	return {
		status,
		elapsedMs,
		error,
		cameraVideoRef,
		canvasRef,
		requestPreview,
		startRecording,
		pauseRecording,
		resumeRecording,
		stopRecording,
		cancelPreview,
		attachPreview,
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
		status,
	};
}

export function getSupportedMimeType(): string {
	const types = [
		"video/webm;codecs=vp9,opus",
		"video/webm;codecs=vp8,opus",
		"video/webm",
		"video/mp4",
	];
	for (const type of types) {
		if (MediaRecorder.isTypeSupported(type)) return type;
	}
	return "";
}

