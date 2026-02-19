/**
 * OGG to WAV/PCM converter using ffmpeg
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Convert OGG file to WAV format using ffmpeg
 * @param oggPath Path to OGG file
 * @param outputPath Optional output path (if not provided, uses temp file)
 * @returns Path to converted WAV file
 */
export function convertOggToWav(oggPath: string, outputPath?: string): string {
  const targetPath = outputPath || join(tmpdir(), `${randomUUID()}.wav`);

  const args = [
    "-i",
    oggPath,
    "-ar",
    "16000",
    "-ac",
    "1",
    "-acodec",
    "pcm_s16le",
    "-y",
    targetPath,
  ];

  try {
    execFileSync("ffmpeg", args, { stdio: "pipe" });
    return targetPath;
  } catch (error) {
    throw new Error(
      `Failed to convert OGG to WAV: ${(error as Error).message}`
    );
  }
}

/**
 * Convert OGG file to raw PCM data
 * @param oggPath Path to OGG file
 * @returns PCM data buffer
 */
export function convertOggToPcm(oggPath: string): Buffer {
  const args = [
    "-i",
    oggPath,
    "-ar",
    "16000",
    "-ac",
    "1",
    "-acodec",
    "pcm_s16le",
    "-f",
    "s16le",
    "-",
  ];

  try {
    const result = execFileSync("ffmpeg", args, { stdio: "pipe" });
    return Buffer.from(result);
  } catch (error) {
    throw new Error(
      `Failed to convert OGG to PCM: ${(error as Error).message}`
    );
  }
}

/**
 * Convert MP3 file to WAV format using ffmpeg
 * @param mp3Path Path to MP3 file
 * @param outputPath Optional output path (if not provided, uses temp file)
 * @returns Path to converted WAV file
 */
export function convertMp3ToWav(mp3Path: string, outputPath?: string): string {
  const targetPath = outputPath || join(tmpdir(), `${randomUUID()}.wav`);

  const args = [
    "-i",
    mp3Path,
    "-ar",
    "16000",
    "-ac",
    "1",
    "-acodec",
    "pcm_s16le",
    "-y",
    targetPath,
  ];

  try {
    execFileSync("ffmpeg", args, { stdio: "pipe" });
    return targetPath;
  } catch (error) {
    throw new Error(
      `Failed to convert MP3 to WAV: ${(error as Error).message}`
    );
  }
}

/**
 * Convert audio file to WAV format using ffmpeg
 * @param inputPath Path to input audio file
 * @param outputPath Optional output path
 * @param targetSampleRate Target sample rate (default: 16000)
 * @param targetChannels Target channel count (default: 1)
 * @returns Path to converted WAV file
 */
export function convertAudioToWav(
  inputPath: string,
  outputPath?: string,
  targetSampleRate = 16000,
  targetChannels = 1
): string {
  const targetPath = outputPath || join(tmpdir(), `${randomUUID()}.wav`);

  const args = [
    "-i",
    inputPath,
    "-ar",
    String(targetSampleRate),
    "-ac",
    String(targetChannels),
    "-acodec",
    "pcm_s16le",
    "-y",
    targetPath,
  ];

  try {
    execFileSync("ffmpeg", args, { stdio: "pipe" });
    return targetPath;
  } catch (error) {
    throw new Error(
      `Failed to convert audio to WAV: ${(error as Error).message}`
    );
  }
}
