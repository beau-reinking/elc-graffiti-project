const MIN_SIGNAL = 10 ** (-55 / 20);
const WINDOW_SECONDS = 0.05;

export function rms(samples, start = 0, end = samples.length) {
  let sum = 0;
  for (let index = start; index < end; index++) sum += samples[index] ** 2;
  return Math.sqrt(sum / (end - start));
}

export function audibleSeconds(levels, secondsCovered) {
  if (!levels.length || !Number.isFinite(secondsCovered) || secondsCovered <= 0) return undefined;
  const sorted = levels.slice().sort((a, b) => a - b);
  const quiet = sorted[Math.floor((sorted.length - 1) * 0.15)];
  const loud = sorted[Math.floor((sorted.length - 1) * 0.95)];
  // Limit the noise estimate relative to the signal so a continuous take still counts.
  const threshold = Math.max(MIN_SIGNAL, Math.min(quiet * 3, loud * 0.5));
  const active = levels.filter(level => level > threshold).length;
  return Math.round(100 * secondsCovered * active / levels.length) / 100;
}

export function measureAudioBuffer(buffer) {
  const framesPerWindow = Math.max(1, Math.round(buffer.sampleRate * WINDOW_SECONDS));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  if (!channels.length) return undefined;
  const levels = [];
  for (let start = 0; start < buffer.length; start += framesPerWindow) {
    const end = Math.min(start + framesPerWindow, buffer.length);
    levels.push(Math.max(...channels.map(samples => rms(samples, start, end))));
  }
  return audibleSeconds(levels, buffer.duration);
}

export async function estimateUploadActivity(file) {
  if (!globalThis.AudioContext) return undefined;
  let context;
  let timeout;
  try {
    context = new AudioContext();
    const buffer = await Promise.race([
      file.arrayBuffer().then(bytes => context.decodeAudioData(bytes)),
      new Promise(resolve => { timeout = setTimeout(resolve, 5000); }),
    ]);
    return buffer ? measureAudioBuffer(buffer) : undefined;
  } catch {
    // A playable video container may still be unsupported by the browser's audio decoder.
    return undefined;
  } finally {
    clearTimeout(timeout);
    context?.close().catch(() => {});
  }
}
