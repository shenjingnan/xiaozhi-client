/**
 * 文件操作工具单元测试
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileError } from "../errors/index.js";
import { FileUtils } from "./FileUtils.js";

// Mock fs module
vi.mock("node:fs");
const mockedFs = vi.mocked(fs);

describe("FileUtils", () => {
  const testDir = "/tmp/test";
  const testFile = path.join(testDir, "test.txt");
  const testContent = "Hello, World!";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("文件存在性检查", () => {
    it("当文件存在时应返回 true", () => {
      mockedFs.existsSync.mockReturnValue(true);
      expect(FileUtils.exists(testFile)).toBe(true);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
    });

    it("当文件不存在时应返回 false", () => {
      mockedFs.existsSync.mockReturnValue(false);
      expect(FileUtils.exists(testFile)).toBe(false);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
    });

    it("发生异常时应返回 false", () => {
      mockedFs.existsSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });
      expect(FileUtils.exists(testFile)).toBe(false);
    });
  });

  describe("确保目录存在", () => {
    it("当目录不存在时应创建目录", () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => undefined);

      FileUtils.ensureDir(testDir);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testDir);
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(testDir, {
        recursive: true,
      });
    });

    it("当目录已存在时不应创建目录", () => {
      mockedFs.existsSync.mockReturnValue(true);

      FileUtils.ensureDir(testDir);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testDir);
      expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
    });

    it("目录创建失败时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      expect(() => FileUtils.ensureDir(testDir)).toThrow(FileError);
      expect(() => FileUtils.ensureDir(testDir)).toThrow("无法创建目录");
    });
  });

  describe("读取文件", () => {
    it("应成功读取文件内容", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(testContent);

      const result = FileUtils.readFile(testFile);

      expect(result).toBe(testContent);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(testFile, "utf8");
    });

    it("文件不存在时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => FileUtils.readFile(testFile)).toThrow(FileError);
      expect(() => FileUtils.readFile(testFile)).toThrow("文件不存在");
    });

    it("文件读取失败时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error("Read error");
      });

      expect(() => FileUtils.readFile(testFile)).toThrow(FileError);
      expect(() => FileUtils.readFile(testFile)).toThrow("无法读取文件");
    });

    it("应使用自定义编码", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(testContent);

      FileUtils.readFile(testFile, "ascii");

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(testFile, "ascii");
    });
  });

  describe("写入文件", () => {
    beforeEach(() => {
      // Mock path.dirname to return correct directory for test file
      vi.spyOn(path, "dirname").mockImplementation((filePath) => {
        if (filePath === testFile) {
          return testDir;
        }
        return path.dirname(filePath);
      });
    });

    it("当覆盖为 true 时应成功写入文件", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.writeFileSync.mockImplementation(() => {});

      FileUtils.writeFile(testFile, testContent, { overwrite: true });

      // The key thing is that the file gets written successfully
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        testFile,
        testContent,
        "utf8"
      );
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        testFile,
        testContent,
        "utf8"
      );
    });

    it("文件不存在时应成功写入文件", () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.writeFileSync.mockImplementation(() => {});

      FileUtils.writeFile(testFile, testContent);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
      expect(mockedFs.mkdirSync).toHaveBeenCalled();
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        testFile,
        testContent,
        "utf8"
      );
    });

    it("当文件存在且覆盖为 false 时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(true);

      expect(() => FileUtils.writeFile(testFile, testContent)).toThrow(
        FileError
      );
      expect(() => FileUtils.writeFile(testFile, testContent)).toThrow(
        "文件已存在"
      );
    });

    it("写入失败时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error("Write error");
      });

      expect(() => FileUtils.writeFile(testFile, testContent)).toThrow(
        FileError
      );
      expect(() => FileUtils.writeFile(testFile, testContent)).toThrow(
        "无法写入文件"
      );
    });

    it("应使用默认覆盖选项 false", () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.writeFileSync.mockImplementation(() => {});

      FileUtils.writeFile(testFile, testContent);

      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("复制文件", () => {
    const destFile = path.join(testDir, "copy.txt");

    beforeEach(() => {
      // Mock path.dirname
      vi.spyOn(path, "dirname").mockReturnValue(testDir);
    });

    it("当覆盖为 true 时应成功复制文件", () => {
      // Configure mocks for copyFile execution
      mockedFs.existsSync.mockReturnValue(true); // All files and directories exist
      mockedFs.copyFileSync.mockImplementation(() => {});

      FileUtils.copyFile(testFile, destFile, { overwrite: true });

      // Check that the key operations happened
      expect(mockedFs.copyFileSync).toHaveBeenCalledWith(testFile, destFile);
    });

    it("目标文件不存在时应成功复制文件", () => {
      mockedFs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.copyFileSync.mockImplementation(() => {});

      FileUtils.copyFile(testFile, destFile);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(destFile);
      expect(mockedFs.mkdirSync).toHaveBeenCalled();
      expect(mockedFs.copyFileSync).toHaveBeenCalledWith(testFile, destFile);
    });

    it("源文件不存在时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => FileUtils.copyFile(testFile, destFile)).toThrow(FileError);
      expect(() => FileUtils.copyFile(testFile, destFile)).toThrow(
        "文件不存在"
      );
    });

    it("目标文件存在且覆盖为 false 时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(true);

      expect(() => FileUtils.copyFile(testFile, destFile)).toThrow(FileError);
      expect(() => FileUtils.copyFile(testFile, destFile)).toThrow(
        "文件已存在"
      );
    });

    it("复制失败时应抛出文件错误", () => {
      mockedFs.existsSync.mockImplementation((filePath) => {
        if (filePath === testFile) return true; // Source file exists
        if (filePath === destFile) return false; // Destination doesn't exist
        return false; // Other files don't exist
      });
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.copyFileSync.mockImplementation(() => {
        throw new Error("Copy error");
      });

      expect(() => FileUtils.copyFile(testFile, destFile)).toThrow(FileError);
      expect(() => FileUtils.copyFile(testFile, destFile)).toThrow(
        "无法复制文件"
      );
    });
  });

  describe("删除文件", () => {
    it("文件存在时应删除文件", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.unlinkSync.mockImplementation(() => {});

      FileUtils.deleteFile(testFile);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
      expect(mockedFs.unlinkSync).toHaveBeenCalledWith(testFile);
    });

    it("文件不存在时不应尝试删除", () => {
      mockedFs.existsSync.mockReturnValue(false);

      FileUtils.deleteFile(testFile);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
      expect(mockedFs.unlinkSync).not.toHaveBeenCalled();
    });

    it("文件删除失败时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.unlinkSync.mockImplementation(() => {
        throw new Error("Delete error");
      });

      expect(() => FileUtils.deleteFile(testFile)).toThrow(FileError);
      expect(() => FileUtils.deleteFile(testFile)).toThrow("无法删除文件");
    });
  });

  describe("复制目录", () => {
    const srcDir = "/tmp/source";
    const destDir = "/tmp/destination";
    const mockStats = {
      isDirectory: () => false,
      isFile: () => true,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isSymbolicLink: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      dev: 0n,
      ino: 0n,
      mode: 0n,
      nlink: 0n,
      uid: 0n,
      gid: 0n,
      rdev: 0n,
      size: 0n,
      blksize: 0n,
      blocks: 0n,
      atimeMs: 0n,
      mtimeMs: 0n,
      ctimeMs: 0n,
      birthtimeMs: 0n,
      atimeNs: 0n,
      mtimeNs: 0n,
      ctimeNs: 0n,
      birthtimeNs: 0n,
      atime: new Date(),
      mtime: new Date(),
      ctime: new Date(),
      birthtime: new Date(),
    };

    beforeEach(() => {
      // Mock path.dirname to return correct directory for each file
      vi.spyOn(path, "dirname").mockImplementation((filePath) => {
        if (filePath.includes(destDir)) {
          return destDir;
        }
        return path.dirname(filePath);
      });
    });

    it("源目录不存在时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => FileUtils.copyDirectory(srcDir, destDir)).toThrow(FileError);
      expect(() => FileUtils.copyDirectory(srcDir, destDir)).toThrow(
        "文件不存在"
      );
    });
  });

  describe("删除目录", () => {
    it("目录存在时应删除目录", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.rmSync.mockImplementation(() => {});

      FileUtils.deleteDirectory(testDir);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testDir);
      expect(mockedFs.rmSync).toHaveBeenCalledWith(testDir, {
        recursive: true,
        force: true,
      });
    });

    it("目录不存在时不应尝试删除", () => {
      mockedFs.existsSync.mockReturnValue(false);

      FileUtils.deleteDirectory(testDir);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testDir);
      expect(mockedFs.rmSync).not.toHaveBeenCalled();
    });

    it("应使用自定义递归选项", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.rmSync.mockImplementation(() => {});

      FileUtils.deleteDirectory(testDir, { recursive: false });

      expect(mockedFs.rmSync).toHaveBeenCalledWith(testDir, {
        recursive: false,
        force: true,
      });
    });

    it("目录删除失败时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.rmSync.mockImplementation(() => {
        throw new Error("Delete error");
      });

      expect(() => FileUtils.deleteDirectory(testDir)).toThrow(FileError);
      expect(() => FileUtils.deleteDirectory(testDir)).toThrow("无法删除目录");
    });
  });

  describe("获取文件信息", () => {
    const mockStats = {
      size: 1024n,
      isFile: () => true,
      isDirectory: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isSymbolicLink: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      mtime: new Date("2023-01-01"),
      ctime: new Date("2023-01-01"),
      dev: 0n,
      ino: 0n,
      mode: 0n,
      nlink: 0n,
      uid: 0n,
      gid: 0n,
      rdev: 0n,
      blksize: 0n,
      blocks: 0n,
      atimeMs: 0n,
      mtimeMs: 0n,
      ctimeMs: 0n,
      birthtimeMs: 0n,
      atimeNs: 0n,
      mtimeNs: 0n,
      ctimeNs: 0n,
      birthtimeNs: 0n,
      atime: new Date(),
      birthtime: new Date(),
    };

    it("应成功获取文件信息", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue(mockStats);

      const result = FileUtils.getFileInfo(testFile);

      expect(result).toEqual({
        size: 1024n,
        isFile: true,
        isDirectory: false,
        mtime: mockStats.mtime,
        ctime: mockStats.ctime,
      });
    });

    it("文件不存在时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => FileUtils.getFileInfo(testFile)).toThrow(FileError);
      expect(() => FileUtils.getFileInfo(testFile)).toThrow("文件不存在");
    });

    it("获取状态失败时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockImplementation(() => {
        throw new Error("Stat error");
      });

      expect(() => FileUtils.getFileInfo(testFile)).toThrow(FileError);
      expect(() => FileUtils.getFileInfo(testFile)).toThrow("无法获取文件信息");
    });
  });

  describe("列出目录内容", () => {
    const mockStats = {
      isDirectory: () => false,
      isFile: () => true,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isSymbolicLink: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      dev: 0n,
      ino: 0n,
      mode: 0n,
      nlink: 0n,
      uid: 0n,
      gid: 0n,
      rdev: 0n,
      size: 0n,
      blksize: 0n,
      blocks: 0n,
      atimeMs: 0n,
      mtimeMs: 0n,
      ctimeMs: 0n,
      birthtimeMs: 0n,
      atimeNs: 0n,
      mtimeNs: 0n,
      ctimeNs: 0n,
      birthtimeNs: 0n,
      atime: new Date(),
      mtime: new Date(),
      ctime: new Date(),
      birthtime: new Date(),
    };

    it("应成功列出目录内容", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue(["file1.txt", "file2.txt"] as any);
      mockedFs.statSync.mockReturnValue(mockStats);

      const result = FileUtils.listDirectory(testDir);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(path.join(testDir, "file1.txt"));
      expect(result[1]).toBe(path.join(testDir, "file2.txt"));
    });

    it("目录不存在时应抛出文件错误", () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => FileUtils.listDirectory(testDir)).toThrow(FileError);
      expect(() => FileUtils.listDirectory(testDir)).toThrow("文件不存在");
    });

    it("默认情况下应跳过隐藏文件", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([
        "file1.txt",
        ".hidden",
        "file2.txt",
      ] as any);
      mockedFs.statSync.mockReturnValue(mockStats);

      const result = FileUtils.listDirectory(testDir);

      expect(result).toHaveLength(2);
      expect(result.some((item) => item.includes(".hidden"))).toBe(false);
    });

    it("指定时应包含隐藏文件", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue([
        "file1.txt",
        ".hidden",
        "file2.txt",
      ] as any);
      mockedFs.statSync.mockReturnValue(mockStats);

      const result = FileUtils.listDirectory(testDir, { includeHidden: true });

      expect(result).toHaveLength(3);
      expect(result.some((item) => item.includes(".hidden"))).toBe(true);
    });

    it("应处理递归列出", () => {
      const subDir = path.join(testDir, "subdir");
      const subFile = path.join(subDir, "subfile.txt");

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync
        .mockReturnValueOnce(["file1.txt", "subdir"] as any)
        .mockReturnValueOnce(["subfile.txt"] as any);
      mockedFs.statSync
        .mockReturnValueOnce({
          isDirectory: () => false,
          isFile: () => true,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          dev: 0n,
          ino: 0n,
          mode: 0n,
          nlink: 0n,
          uid: 0n,
          gid: 0n,
          rdev: 0n,
          size: 0n,
          blksize: 0n,
          blocks: 0n,
          atimeMs: 0n,
          mtimeMs: 0n,
          ctimeMs: 0n,
          birthtimeMs: 0n,
          atimeNs: 0n,
          mtimeNs: 0n,
          ctimeNs: 0n,
          birthtimeNs: 0n,
          atime: new Date(),
          mtime: new Date(),
          ctime: new Date(),
          birthtime: new Date(),
        })
        .mockReturnValueOnce({
          isDirectory: () => true,
          isFile: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          dev: 0n,
          ino: 0n,
          mode: 0n,
          nlink: 0n,
          uid: 0n,
          gid: 0n,
          rdev: 0n,
          size: 0n,
          blksize: 0n,
          blocks: 0n,
          atimeMs: 0n,
          mtimeMs: 0n,
          ctimeMs: 0n,
          birthtimeMs: 0n,
          atimeNs: 0n,
          mtimeNs: 0n,
          ctimeNs: 0n,
          birthtimeNs: 0n,
          atime: new Date(),
          mtime: new Date(),
          ctime: new Date(),
          birthtime: new Date(),
        })
        .mockReturnValueOnce({
          isDirectory: () => false,
          isFile: () => true,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          dev: 0n,
          ino: 0n,
          mode: 0n,
          nlink: 0n,
          uid: 0n,
          gid: 0n,
          rdev: 0n,
          size: 0n,
          blksize: 0n,
          blocks: 0n,
          atimeMs: 0n,
          mtimeMs: 0n,
          ctimeMs: 0n,
          birthtimeMs: 0n,
          atimeNs: 0n,
          mtimeNs: 0n,
          ctimeNs: 0n,
          birthtimeNs: 0n,
          atime: new Date(),
          mtime: new Date(),
          ctime: new Date(),
          birthtime: new Date(),
        });

      const result = FileUtils.listDirectory(testDir, { recursive: true });

      expect(result).toHaveLength(3);
      expect(result).toContain(subFile);
    });
  });

  describe("检查权限", () => {
    it("权限足够时应返回 true", () => {
      mockedFs.accessSync.mockImplementation(() => {});

      const result = FileUtils.checkPermissions(testFile);

      expect(result).toBe(true);
      expect(mockedFs.accessSync).toHaveBeenCalledWith(
        testFile,
        fs.constants.R_OK | fs.constants.W_OK
      );
    });

    it("权限不足时应返回 false", () => {
      mockedFs.accessSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = FileUtils.checkPermissions(testFile);

      expect(result).toBe(false);
    });

    it("应使用自定义权限模式", () => {
      mockedFs.accessSync.mockImplementation(() => {});

      FileUtils.checkPermissions(testFile, fs.constants.R_OK);

      expect(mockedFs.accessSync).toHaveBeenCalledWith(
        testFile,
        fs.constants.R_OK
      );
    });
  });

  describe("获取文件扩展名", () => {
    it("应返回小写的文件扩展名", () => {
      expect(FileUtils.getExtension("test.TXT")).toBe(".txt");
      expect(FileUtils.getExtension("archive.tar.gz")).toBe(".gz");
      expect(FileUtils.getExtension("filename")).toBe("");
      expect(FileUtils.getExtension("")).toBe("");
    });
  });

  describe("获取文件基本名称", () => {
    it("应返回不带扩展名的文件名", () => {
      expect(FileUtils.getBaseName("test.txt")).toBe("test");
      expect(FileUtils.getBaseName("archive.tar.gz")).toBe("archive.tar");
      expect(FileUtils.getBaseName("filename")).toBe("filename");
      expect(FileUtils.getBaseName("/path/to/test.txt")).toBe("test");
    });
  });

  describe("解析路径", () => {
    it("应将相对路径解析为绝对路径", () => {
      const result = FileUtils.resolvePath("relative/path", "/base");

      expect(result).toBe(path.resolve("/base", "relative/path"));
    });

    it("应解析不带基路径的路径", () => {
      const result = FileUtils.resolvePath("relative/path");

      expect(result).toBe(path.resolve("relative/path"));
    });
  });
});
