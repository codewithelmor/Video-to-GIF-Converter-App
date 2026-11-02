// Ambient types shared by main, preload and renderer (no imports/exports on purpose,
// so the renderer stays a plain browser script).

/** A video that was probed (see backend/core.py probe). */
interface VideoInfo {
  error?: undefined;
  name: string;
  path: string;
  /** Seconds; null when the container does not say. */
  duration: number | null;
  width: number;
  height: number;
  /** Frames per second; null when unknown. */
  fps: number | null;
  /** Size in bytes. */
  size: number;
}

type ProbeResult = VideoInfo | { error: string };

interface ConvertOptions {
  /** Whole frames per second. */
  fps: number;
  /** Output width in pixels; null keeps the original. */
  width: number | null;
  loop: boolean;
}

interface ConvertRequest {
  file: string;
  options: ConvertOptions;
}

type ConvertResult =
  | { output: string; size: number }
  | { cancelled: true }
  | { error: string };

/** Events the Python backend writes as JSON lines (see backend/backend.py). */
type BackendEvent =
  | ({ event: 'probe' } & Omit<VideoInfo, 'error'>)
  | { event: 'progress'; percent: number }
  | { event: 'convert'; output: string; size: number }
  | { event: 'cancelled' }
  | { event: 'error'; message: string };

interface Settings {
  /** Folder the last video was picked from. */
  folder: string;
}

/** What preload.ts exposes to the renderer as `window.api`. */
interface Api {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  /** Opens a file dialog; null when cancelled. */
  pickVideo(current: string): Promise<string | null>;
  /** Absolute path of a file dropped onto the window. */
  pathForFile(file: File): string;
  probe(file: string): Promise<ProbeResult>;
  /** Asks where to save, then converts. Progress arrives through onProgress. */
  convert(request: ConvertRequest): Promise<ConvertResult>;
  cancel(): Promise<void>;
  /** Subscribes to conversion progress (0-100); returns an unsubscribe function. */
  onProgress(callback: (percent: number) => void): () => void;
  showInFolder(path: string): Promise<void>;
}

interface Window {
  api: Api;
}
