/**
 * Opus 音频提取脚本
 *
 * 功能：
 * 1. 使用 FFmpeg 将音频重采样到 16000Hz（确保小智硬件兼容性）
 * 2. 从 Ogg 容器中提取纯 Opus 数据
 * 3. 保存为二进制文件
 *
 * 使用方法：
 *   tsx scripts/extract-opus-audio.ts
 *   tsx scripts/extract-opus-audio.ts --input <input> --output <output>
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 命令行参数
 */
interface ExtractOptions {
  /** 输入文件路径 */
  input: string;
  /** 输出文件路径 */
  output: string;
  /** 目标采样率（默认 16000Hz） */
  sampleRate: number;
}

/**
 * Ogg页头结构（用于解析Ogg容器）
 */
interface OggPageHeader {
  /** 捕获模式 */
  capturePattern: string;
  /** 版本 */
  version: number;
  /** 头类型标志 */
  headerType: number;
  /** 绝对颗粒位置 */
  absoluteGranulePosition: bigint;
  /** 位流序列号 */
  streamSerialNumber: number;
  /** 页序列号 */
  pageSequenceNumber: number;
  /** 校验和 */
  checksum: number;
  /** 段数 */
  pageSegments: number;
  /** 段表 */
  segmentTable: number[];
}

/**
 * 检查 FFmpeg 是否可用
 */
async function checkFFmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", ["-version"], { stdio: "pipe" });
    ffmpeg.on("error", () => resolve(false));
    ffmpeg.on("exit", (code) => resolve(code === 0));
  });
}

/**
 * 使用 FFmpeg 重采样音频到指定采样率
 *
 * @param inputPath - 输入文件路径
 * @param outputPath - 输出文件路径
 * @param sampleRate - 目标采样率
 */
async function resampleWithFFmpeg(
  inputPath: string,
  outputPath: string,
  sampleRate: number
): Promise<void> {
  console.log(`[FFmpeg] 重采样音频: ${inputPath} -> ${outputPath}`);
  console.log(`[FFmpeg] 目标采样率: ${sampleRate}Hz`);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-y", // 覆盖输出文件
        "-i",
        inputPath, // 输入文件
        "-ar",
        String(sampleRate), // 采样率
        "-ac",
        "1", // 单声道
        "-c:a",
        "libopus", // Opus 编码
        "-b:a",
        "64k", // 比特率
        "-vbr",
        "on", // 可变比特率
        outputPath,
      ],
      { stdio: "inherit" }
    );

    ffmpeg.on("error", (error) => {
      console.error("[FFmpeg] 启动失败:", error);
      reject(error);
    });

    ffmpeg.on("exit", (code, signal) => {
      if (code === 0) {
        console.log(`[FFmpeg] 重采样完成: ${outputPath}`);
        resolve();
      } else {
        console.error(`[FFmpeg] 退出异常: code=${code}, signal=${signal}`);
        reject(new Error(`FFmpeg 退出码: ${code}`));
      }
    });
  });
}

/**
 * 检查是否为Ogg格式文件
 */
function checkOggFormat(data: Uint8Array): boolean {
  if (data.length < 4) {
    return false;
  }
  // Ogg文件以 "OggS" 开头
  const header = String.fromCharCode(
    data[0],
    data[1],
    data[2],
    data[3]
  );
  return header === "OggS";
}

/**
 * 解析Ogg页头
 */
function parseOggPageHeader(
  data: Uint8Array,
  offset: number
): OggPageHeader | null {
  try {
    const view = new DataView(data.buffer, offset);

    // 读取捕获模式 (4字节)
    const capturePattern = String.fromCharCode(
      data[offset],
      data[offset + 1],
      data[offset + 2],
      data[offset + 3]
    );

    // 读取版本 (1字节)
    const version = view.getUint8(4);

    // 读取头类型 (1字节)
    const headerType = view.getUint8(5);

    // 读取绝对颗粒位置 (8字节)
    const absoluteGranulePosition = view.getBigUint64(6, true);

    // 读取位流序列号 (4字节)
    const streamSerialNumber = view.getUint32(14, true);

    // 读取页序列号 (4字节)
    const pageSequenceNumber = view.getUint32(18, true);

    // 读取校验和 (4字节)
    const checksum = view.getUint32(22, true);

    // 读取段数 (1字节)
    const pageSegments = view.getUint8(26);

    // 读取段表
    const segmentTable: number[] = [];
    for (let i = 0; i < pageSegments; i++) {
      segmentTable.push(view.getUint8(27 + i));
    }

    return {
      capturePattern,
      version,
      headerType,
      absoluteGranulePosition,
      streamSerialNumber,
      pageSequenceNumber,
      checksum,
      pageSegments,
      segmentTable,
    };
  } catch {
    return null;
  }
}

/**
 * 计算Ogg页总大小
 */
function calculatePageSize(header: OggPageHeader): number {
  const dataTotal = header.segmentTable.reduce((sum, size) => sum + size, 0);
  return 27 + header.pageSegments + dataTotal;
}

/**
 * 计算页数据大小
 */
function calculatePageDataSize(header: OggPageHeader): number {
  return header.segmentTable.reduce((sum, size) => sum + size, 0);
}

/**
 * 解封装Ogg文件，提取纯Opus数据
 */
function demuxOggToOpus(oggData: Uint8Array): Uint8Array {
  console.log("[解封装] 开始解封装Ogg文件...");

  const opusFrames: Uint8Array[] = [];
  let offset = 0;
  let pageCount = 0;

  while (offset < oggData.length) {
    // 检查Ogg页头
    if (offset + 4 > oggData.length) {
      console.warn("[解封装] 到达文件末尾");
      break;
    }

    const capturePattern = String.fromCharCode(
      oggData[offset],
      oggData[offset + 1],
      oggData[offset + 2],
      oggData[offset + 3]
    );

    if (capturePattern !== "OggS") {
      console.warn(
        `[解封装] 无效的Ogg页头: offset=${offset}, pattern="${capturePattern}"`
      );
      break;
    }

    // 解析Ogg页头
    const header = parseOggPageHeader(oggData, offset);
    if (!header) {
      console.error(`[解封装] 解析Ogg页头失败: offset=${offset}`);
      break;
    }

    pageCount++;
    console.debug(
      `[解封装] 页 ${pageCount}: seq=${header.pageSequenceNumber}, segments=${header.pageSegments}`
    );

    // 跳过Ogg头页（包含ID头和Comment）
    // Opus音频数据通常从第3页开始
    if (pageCount <= 2) {
      const pageSize = calculatePageSize(header);
      offset += pageSize;
      console.debug(`[解封装] 跳过头页 ${pageCount}: size=${pageSize}`);
      continue;
    }

    // 提取Opus数据（跳过Ogg页头）
    const headerSize = 27 + header.pageSegments;
    const dataSize = calculatePageDataSize(header);
    const pageData = oggData.slice(
      offset + headerSize,
      offset + headerSize + dataSize
    );

    // 将页数据添加到Opus帧列表
    opusFrames.push(pageData);
    console.debug(
      `[解封装] 提取Opus数据: 页=${pageCount}, size=${dataSize}`
    );

    // 移动到下一页
    const pageSize = calculatePageSize(header);
    offset += pageSize;
  }

  // 合并所有Opus帧
  const totalSize = opusFrames.reduce((sum, frame) => sum + frame.length, 0);
  const combinedOpus = new Uint8Array(totalSize);
  let writeOffset = 0;
  for (const frame of opusFrames) {
    combinedOpus.set(frame, writeOffset);
    writeOffset += frame.length;
  }

  console.log(
    `[解封装] 解封装完成: 总页数=${pageCount}, Opus帧=${opusFrames.length}, 总大小=${combinedOpus.length}`
  );

  return combinedOpus;
}

/**
 * 提取 Opus 音频数据
 */
async function extractOpusAudio(options: ExtractOptions): Promise<void> {
  const { input, output, sampleRate } = options;

  console.log("========================================");
  console.log("Opus 音频提取脚本");
  console.log("========================================");
  console.log(`输入文件: ${input}`);
  console.log(`输出文件: ${output}`);
  console.log(`目标采样率: ${sampleRate}Hz`);
  console.log();

  // 1. 检查 FFmpeg 是否可用
  console.log("[步骤 1/4] 检查 FFmpeg...");
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) {
    console.error("错误: 未找到 FFmpeg");
    console.error();
    console.error("请安装 FFmpeg:");
    console.error("  macOS:   brew install ffmpeg");
    console.error("  Ubuntu:  sudo apt-get install ffmpeg");
    console.error("  Windows: choco install ffmpeg");
    process.exit(1);
  }
  console.log("✓ FFmpeg 可用");
  console.log();

  // 2. 检查输入文件
  console.log("[步骤 2/4] 检查输入文件...");
  try {
    await fs.access(input);
    console.log(`✓ 输入文件存在: ${input}`);
  } catch {
    console.error(`错误: 输入文件不存在: ${input}`);
    process.exit(1);
  }
  console.log();

  // 3. 使用 FFmpeg 重采样
  console.log("[步骤 3/4] 使用 FFmpeg 重采样音频...");
  const tempFile = join(
    dirname(output),
    `.temp_${Date.now()}_${basename(output)}.ogg`
  );
  await resampleWithFFmpeg(input, tempFile, sampleRate);
  console.log();

  // 4. 提取纯 Opus 数据
  console.log("[步骤 4/4] 从 Ogg 容器提取纯 Opus 数据...");
  const resampledBuffer = await fs.readFile(tempFile);
  const resampledData = new Uint8Array(resampledBuffer);

  // 检查是否为Ogg文件
  const isOgg = checkOggFormat(resampledData);
  if (!isOgg) {
    console.warn("警告: 重采样后的文件不是 Ogg 格式");
  }

  // 解封装提取纯 Opus 数据
  const opusData = demuxOggToOpus(resampledData);

  // 保存到输出文件
  await fs.mkdir(dirname(output), { recursive: true });
  await fs.writeFile(output, opusData);

  // 清理临时文件
  await fs.unlink(tempFile);

  console.log();
  console.log("========================================");
  console.log("✓ 提取完成!");
  console.log("========================================");
  console.log(`输出文件: ${output}`);
  console.log(`文件大小: ${opusData.length} 字节`);
  console.log(`采样率: ${sampleRate}Hz`);
  console.log();
}

/**
 * 获取文件的基本名称（不含扩展名）
 */
function basename(filePath: string): string {
  const name = filePath.split("/").pop() ?? "";
  return name.includes(".") ? name.split(".")[0] ?? name : name;
}

/**
 * 解析命令行参数
 */
function parseArgs(): ExtractOptions {
  const args = process.argv.slice(2);

  const defaults: ExtractOptions = {
    input: join(__dirname, "../apps/backend/services/test.ogg"),
    output: join(__dirname, "../apps/backend/assets/audio/test.opus"),
    sampleRate: 16000,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--input":
      case "-i":
        defaults.input = args[++i];
        break;
      case "--output":
      case "-o":
        defaults.output = args[++i];
        break;
      case "--sample-rate":
      case "-r":
        defaults.sampleRate = Number.parseInt(args[++i], 10);
        break;
      case "--help":
      case "-h":
        console.log("Opus 音频提取脚本");
        console.log();
        console.log("使用方法:");
        console.log("  tsx scripts/extract-opus-audio.ts [选项]");
        console.log();
        console.log("选项:");
        console.log("  -i, --input <path>      输入文件路径 (默认: apps/backend/services/test.ogg)");
        console.log("  -o, --output <path>     输出文件路径 (默认: apps/backend/assets/audio/test.opus)");
        console.log("  -r, --sample-rate <hz>  目标采样率 (默认: 16000)");
        console.log("  -h, --help              显示帮助信息");
        console.log();
        console.log("示例:");
        console.log("  tsx scripts/extract-opus-audio.ts");
        console.log("  tsx scripts/extract-opus-audio.ts -i input.ogg -o output.opus -r 24000");
        process.exit(0);
    }
  }

  return defaults;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const options = parseArgs();
  await extractOpusAudio(options);
}

main().catch((error) => {
  console.error("错误:", error);
  process.exit(1);
});
