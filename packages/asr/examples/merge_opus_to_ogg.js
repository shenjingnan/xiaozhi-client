const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const OpusScript = require('opusscript');

const sourceDir = './v2-opus-stream';
const outputFile = './v2-opus-stream-merged.ogg';
const tempDir = path.join(sourceDir, 'temp_pcm');

// BinaryProtocol2 格式定义（16字节头部）
// | version(2) | type(2) | reserved(4) | timestamp(4) | payload_size(4) | payload(N) |
const PROTOCOL_HEADER_SIZE = 16;

// 音频参数（来自协议文档）
const SAMPLE_RATE = 16000;
const CHANNELS = 1;

/**
 * 解析 BinaryProtocol2 格式的音频文件，返回纯 opus 数据
 */
function parseProtocol2(filePath) {
  const buffer = fs.readFileSync(filePath);

  if (buffer.length < PROTOCOL_HEADER_SIZE) {
    throw new Error(`File too small: ${buffer.length} bytes`);
  }

  // 读取头部字段（使用大端序）
  const version = buffer.readUInt16BE(0);
  const type = buffer.readUInt16BE(2);
  const payloadSize = buffer.readUInt32BE(12);

  // 验证版本
  if (version !== 2) {
    throw new Error(`Invalid version: ${version}, expected 2`);
  }

  // 验证类型（0 = Opus音频）
  if (type !== 0) {
    throw new Error(`Invalid type: ${type}, expected 0 (Opus audio)`);
  }

  // 验证 payload 大小
  const expectedSize = buffer.length - PROTOCOL_HEADER_SIZE;
  if (payloadSize !== expectedSize) {
    console.warn(`Warning: payload_size mismatch - header: ${payloadSize}, actual: ${expectedSize}`);
  }

  // 提取 payload（纯 opus 数据）
  return buffer.slice(PROTOCOL_HEADER_SIZE);
}

// 初始化 Opus 解码器
const opusDecoder = new OpusScript(SAMPLE_RATE, CHANNELS);

// 生成 1-100 的文件名列表
const fileNumbers = Array.from({ length: 100 }, (_, i) => i + 1);
const files = fileNumbers.map(n => `${n}.opus`);

console.log(`Processing ${files.length} opus files (1-100) with BinaryProtocol2 format...`);

// 创建临时目录
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 第一步：解析 BinaryProtocol2 格式并解码为 PCM
console.log('Step 1: Parsing BinaryProtocol2 format and decoding to PCM...');

const allPcmData = [];

files.forEach((file, index) => {
  const inputPath = path.join(sourceDir, file);

  if (!fs.existsSync(inputPath)) {
    console.log(`Skipping ${file} (not found)`);
    return;
  }

  try {
    // 解析 BinaryProtocol2 格式，提取 opus 数据
    const opusData = parseProtocol2(inputPath);

    // 使用 @discordjs/opus 解码为 PCM
    const pcmData = opusDecoder.decode(opusData);
    allPcmData.push(pcmData);

    console.log(`Decoded ${file} -> ${pcmData.length} samples`);
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log(`\nTotal PCM samples: ${allPcmData.reduce((a, b) => a + b.length, 0)}`);

// 第二步：合并所有 PCM 数据
console.log('\nStep 2: Merging PCM data...');

const mergedPcm = Buffer.concat(allPcmData);
const mergedPcmPath = path.join(tempDir, 'merged.pcm');
fs.writeFileSync(mergedPcmPath, mergedPcm);
console.log(`Merged PCM saved to: ${mergedPcmPath} (${mergedPcm.length} bytes)`);

// 第三步：使用 ffmpeg 将 PCM 转换为 OGG
console.log('\nStep 3: Converting PCM to OGG...');

try {
  // 使用 ffmpeg 将原始 PCM 转换为 OGG (Opus 编码)
  // -f s16le: 输入格式为 16 位有符号小端序 PCM
  // -ar 16000: 采样率 16000 Hz
  // -ac 1: 单声道
  // -c:a libopus: 使用 Opus 编码器
  // -b:a 48k: 设置比特率为 48kbps（可选，适合语音）
  // -application voip: 优化为语音通话场景（可选）
  execSync(
    `ffmpeg -f s16le -ar ${SAMPLE_RATE} -ac ${CHANNELS} -i "${mergedPcmPath}" ` +
    `-c:a libopus -b:a 48k -application voip "${outputFile}"`,
    { stdio: 'inherit' }
  );

  console.log(`\nSuccess! Output: ${outputFile}`);
} catch (error) {
  console.error('Error during conversion:', error.message);
}

// 清理临时文件
console.log('\nCleaning up temporary files...');
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('Done!');
