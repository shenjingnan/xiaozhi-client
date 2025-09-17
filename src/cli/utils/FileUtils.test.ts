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

  describe("exists", () => {
    it("should return true when file exists", () => {
      mockedFs.existsSync.mockReturnValue(true);
      expect(FileUtils.exists(testFile)).toBe(true);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
    });

    it("should return false when file does not exist", () => {
      mockedFs.existsSync.mockReturnValue(false);
      expect(FileUtils.exists(testFile)).toBe(false);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
    });

    it("should return false when exception occurs", () => {
      mockedFs.existsSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });
      expect(FileUtils.exists(testFile)).toBe(false);
    });
  });

  describe("ensureDir", () => {
    it("should create directory when it does not exist", () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => undefined);

      FileUtils.ensureDir(testDir);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testDir);
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(testDir, {
        recursive: true,
      });
    });

    it("should not create directory when it already exists", () => {
      mockedFs.existsSync.mockReturnValue(true);

      FileUtils.ensureDir(testDir);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testDir);
      expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
    });

    it("should throw FileError when directory creation fails", () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      expect(() => FileUtils.ensureDir(testDir)).toThrow(FileError);
      expect(() => FileUtils.ensureDir(testDir)).toThrow("无法创建目录");
    });
  });

  describe("readFile", () => {
    it("should read file content successfully", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(testContent);

      const result = FileUtils.readFile(testFile);

      expect(result).toBe(testContent);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(testFile, "utf8");
    });

    it("should throw FileError when file does not exist", () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => FileUtils.readFile(testFile)).toThrow(FileError);
      expect(() => FileUtils.readFile(testFile)).toThrow("文件不存在");
    });

    it("should throw FileError when file read fails", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error("Read error");
      });

      expect(() => FileUtils.readFile(testFile)).toThrow(FileError);
      expect(() => FileUtils.readFile(testFile)).toThrow("无法读取文件");
    });

    it("should use custom encoding", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(testContent);

      FileUtils.readFile(testFile, "ascii");

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(testFile, "ascii");
    });
  });

  describe("writeFile", () => {
    beforeEach(() => {
      // Mock path.dirname to return correct directory for test file
      vi.spyOn(path, "dirname").mockImplementation((filePath) => {
        if (filePath === testFile) {
          return testDir;
        }
        return path.dirname(filePath);
      });
    });

    it("should write file successfully when overwrite is true", () => {
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

    it("should write file successfully when file does not exist", () => {
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

    it("should throw FileError when file exists and overwrite is false", () => {
      mockedFs.existsSync.mockReturnValue(true);

      expect(() => FileUtils.writeFile(testFile, testContent)).toThrow(
        FileError
      );
      expect(() => FileUtils.writeFile(testFile, testContent)).toThrow(
        "文件已存在"
      );
    });

    it("should throw FileError when write fails", () => {
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

    it("should use default overwrite option as false", () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.writeFileSync.mockImplementation(() => {});

      FileUtils.writeFile(testFile, testContent);

      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("copyFile", () => {
    const destFile = path.join(testDir, "copy.txt");

    beforeEach(() => {
      // Mock path.dirname
      vi.spyOn(path, "dirname").mockReturnValue(testDir);
    });

    it("should copy file successfully when overwrite is true", () => {
      // Configure mocks for copyFile execution
      mockedFs.existsSync.mockReturnValue(true); // All files and directories exist
      mockedFs.copyFileSync.mockImplementation(() => {});

      FileUtils.copyFile(testFile, destFile, { overwrite: true });

      // Check that the key operations happened
      expect(mockedFs.copyFileSync).toHaveBeenCalledWith(testFile, destFile);
    });

    it("should copy file successfully when destination does not exist", () => {
      mockedFs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.copyFileSync.mockImplementation(() => {});

      FileUtils.copyFile(testFile, destFile);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(destFile);
      expect(mockedFs.mkdirSync).toHaveBeenCalled();
      expect(mockedFs.copyFileSync).toHaveBeenCalledWith(testFile, destFile);
    });

    it("should throw FileError when source file does not exist", () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => FileUtils.copyFile(testFile, destFile)).toThrow(FileError);
      expect(() => FileUtils.copyFile(testFile, destFile)).toThrow(
        "文件不存在"
      );
    });

    it("should throw FileError when destination exists and overwrite is false", () => {
      mockedFs.existsSync.mockReturnValue(true);

      expect(() => FileUtils.copyFile(testFile, destFile)).toThrow(FileError);
      expect(() => FileUtils.copyFile(testFile, destFile)).toThrow(
        "文件已存在"
      );
    });

    it("should throw FileError when copy fails", () => {
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

  describe("deleteFile", () => {
    it("should delete file when it exists", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.unlinkSync.mockImplementation(() => {});

      FileUtils.deleteFile(testFile);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
      expect(mockedFs.unlinkSync).toHaveBeenCalledWith(testFile);
    });

    it("should not attempt to delete when file does not exist", () => {
      mockedFs.existsSync.mockReturnValue(false);

      FileUtils.deleteFile(testFile);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testFile);
      expect(mockedFs.unlinkSync).not.toHaveBeenCalled();
    });

    it("should throw FileError when deletion fails", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.unlinkSync.mockImplementation(() => {
        throw new Error("Delete error");
      });

      expect(() => FileUtils.deleteFile(testFile)).toThrow(FileError);
      expect(() => FileUtils.deleteFile(testFile)).toThrow("无法删除文件");
    });
  });

  describe("copyDirectory", () => {
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
      birthtime: new Date()
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

    it("should copy directory successfully", () => {
      // Configure mock calls for copyDirectory execution
      const sourceFile1 = path.join(srcDir, "file1.txt");
      const sourceFile2 = path.join(srcDir, "file2.txt");

      mockedFs.existsSync.mockImplementation((filePath) => {
        if (filePath === srcDir) return true; // Source directory exists
        if (filePath === destDir) return false; // Destination directory doesn't exist
        if (filePath === sourceFile1) return true; // Source file1 exists
        if (filePath === sourceFile2) return true; // Source file2 exists
        return false; // Destination files don't exist
      });
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.readdirSync.mockReturnValue(["file1.txt", "file2.txt"] as any);
      mockedFs.statSync.mockReturnValue(mockStats);
      mockedFs.copyFileSync.mockImplementation(() => {});

      FileUtils.copyDirectory(srcDir, destDir);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(srcDir);
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(destDir, {
        recursive: true,
      });
      expect(mockedFs.readdirSync).toHaveBeenCalledWith(srcDir);
      expect(mockedFs.copyFileSync).toHaveBeenCalledTimes(2);
    });

    it("should throw FileError when source directory does not exist", () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => FileUtils.copyDirectory(srcDir, destDir)).toThrow(FileError);
      expect(() => FileUtils.copyDirectory(srcDir, destDir)).toThrow(
        "文件不存在"
      );
    });

    it("should exclude files in exclude list", () => {
      const sourceFile1 = path.join(srcDir, "file1.txt");
      const sourceFile2 = path.join(srcDir, "file2.txt");

      mockedFs.existsSync.mockImplementation((filePath) => {
        if (filePath === srcDir) return true; // Source directory exists
        if (filePath === destDir) return false; // Destination directory doesn't exist
        if (filePath === sourceFile1) return true; // Source file1 exists
        if (filePath === sourceFile2) return true; // Source file2 exists
        return false; // Destination files don't exist
      });
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.readdirSync.mockReturnValue([
        "file1.txt",
        "node_modules",
        "file2.txt",
      ] as any);
      mockedFs.statSync.mockReturnValue(mockStats);
      mockedFs.copyFileSync.mockImplementation(() => {});

      FileUtils.copyDirectory(srcDir, destDir, { exclude: ["node_modules"] });

      expect(mockedFs.copyFileSync).toHaveBeenCalledTimes(2);
    });

    it("should handle recursive copying", () => {
      const subDir = path.join(srcDir, "subdir");
      const subDestDir = path.join(destDir, "subdir");
      const sourceFile = path.join(subDir, "file1.txt");

      mockedFs.existsSync.mockImplementation((filePath) => {
        if (filePath === srcDir) return true; // Source directory exists
        if (filePath === destDir) return false; // Destination directory doesn't exist
        if (filePath === subDir) return true; // Subdirectory exists
        if (filePath === subDestDir) return false; // Sub destination doesn't exist
        if (filePath === sourceFile) return true; // Source file exists
        return false; // Other files don't exist
      });
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.readdirSync
        .mockReturnValueOnce(["subdir"] as any)
        .mockReturnValueOnce(["file1.txt"] as any);
      mockedFs.statSync
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
          birthtime: new Date()
        })
        .mockReturnValueOnce(mockStats);
      mockedFs.copyFileSync.mockImplementation(() => {});

      FileUtils.copyDirectory(srcDir, destDir, { recursive: true });

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(subDestDir, {
        recursive: true,
      });
      expect(mockedFs.copyFileSync).toHaveBeenCalled();
    });

    it("should skip directories when recursive is false", () => {
      const sourceFile = path.join(srcDir, "file1.txt");

      mockedFs.existsSync.mockImplementation((filePath) => {
        if (filePath === srcDir) return true; // Source directory exists
        if (filePath === destDir) return false; // Destination directory doesn't exist
        if (filePath === sourceFile) return true; // Source file exists
        return false; // Other files don't exist
      });
      mockedFs.mkdirSync.mockImplementation(() => undefined);
      mockedFs.readdirSync.mockReturnValue(["subdir", "file1.txt"] as any);
      mockedFs.statSync
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
          birthtime: new Date()
        })
        .mockReturnValueOnce(mockStats);
      mockedFs.copyFileSync.mockImplementation(() => {});

      FileUtils.copyDirectory(srcDir, destDir, { recursive: false });

      expect(mockedFs.copyFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteDirectory", () => {
    it("should delete directory when it exists", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.rmSync.mockImplementation(() => {});

      FileUtils.deleteDirectory(testDir);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testDir);
      expect(mockedFs.rmSync).toHaveBeenCalledWith(testDir, {
        recursive: true,
        force: true,
      });
    });

    it("should not attempt to delete when directory does not exist", () => {
      mockedFs.existsSync.mockReturnValue(false);

      FileUtils.deleteDirectory(testDir);

      expect(mockedFs.existsSync).toHaveBeenCalledWith(testDir);
      expect(mockedFs.rmSync).not.toHaveBeenCalled();
    });

    it("should use custom recursive option", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.rmSync.mockImplementation(() => {});

      FileUtils.deleteDirectory(testDir, { recursive: false });

      expect(mockedFs.rmSync).toHaveBeenCalledWith(testDir, {
        recursive: false,
        force: true,
      });
    });

    it("should throw FileError when deletion fails", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.rmSync.mockImplementation(() => {
        throw new Error("Delete error");
      });

      expect(() => FileUtils.deleteDirectory(testDir)).toThrow(FileError);
      expect(() => FileUtils.deleteDirectory(testDir)).toThrow("无法删除目录");
    });
  });

  describe("getFileInfo", () => {
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
      birthtime: new Date()
    };

    it("should get file info successfully", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue(mockStats);

      const result = FileUtils.getFileInfo(testFile);

      expect(result).toEqual({
        size: 1024,
        isFile: true,
        isDirectory: false,
        mtime: mockStats.mtime,
        ctime: mockStats.ctime,
      });
    });

    it("should throw FileError when file does not exist", () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => FileUtils.getFileInfo(testFile)).toThrow(FileError);
      expect(() => FileUtils.getFileInfo(testFile)).toThrow("文件不存在");
    });

    it("should throw FileError when stat fails", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockImplementation(() => {
        throw new Error("Stat error");
      });

      expect(() => FileUtils.getFileInfo(testFile)).toThrow(FileError);
      expect(() => FileUtils.getFileInfo(testFile)).toThrow("无法获取文件信息");
    });
  });

  describe("listDirectory", () => {
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
      birthtime: new Date()
    };

    it("should list directory contents successfully", () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readdirSync.mockReturnValue(["file1.txt", "file2.txt"] as any);
      mockedFs.statSync.mockReturnValue(mockStats);

      const result = FileUtils.listDirectory(testDir);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(path.join(testDir, "file1.txt"));
      expect(result[1]).toBe(path.join(testDir, "file2.txt"));
    });

    it("should throw FileError when directory does not exist", () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(() => FileUtils.listDirectory(testDir)).toThrow(FileError);
      expect(() => FileUtils.listDirectory(testDir)).toThrow("文件不存在");
    });

    it("should skip hidden files by default", () => {
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

    it("should include hidden files when specified", () => {
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

    it("should handle recursive listing", () => {
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
          birthtime: new Date()
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
          birthtime: new Date()
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
          birthtime: new Date()
        });

      const result = FileUtils.listDirectory(testDir, { recursive: true });

      expect(result).toHaveLength(3);
      expect(result).toContain(subFile);
    });
  });

  describe("createTempFile", () => {
    beforeEach(() => {
      vi.stubEnv("TMPDIR", "/tmp");
      vi.stubEnv("TEMP", undefined);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should create temp file path with default values", () => {
      const result = FileUtils.createTempFile();

      expect(result).toMatch(/^\/tmp\/xiaozhi-\d+-[a-z0-9]+\.tmp$/);
    });

    it("should create temp file path with custom prefix and suffix", () => {
      const result = FileUtils.createTempFile("custom-", ".json");

      expect(result).toMatch(/^\/tmp\/custom-\d+-[a-z0-9]+\.json$/);
    });

    it("should use TEMP environment variable when TMPDIR is not set", () => {
      vi.stubEnv("TMPDIR", undefined);
      vi.stubEnv("TEMP", "/var/tmp");

      const result = FileUtils.createTempFile();

      expect(result).toMatch(/^\/var\/tmp\/xiaozhi-\d+-[a-z0-9]+\.tmp$/);
    });

    it("should fallback to /tmp when no temp environment variables are set", () => {
      vi.stubEnv("TMPDIR", undefined);
      vi.stubEnv("TEMP", undefined);

      const result = FileUtils.createTempFile();

      expect(result).toMatch(/^\/tmp\/xiaozhi-\d+-[a-z0-9]+\.tmp$/);
    });
  });

  describe("checkPermissions", () => {
    it("should return true when permissions are sufficient", () => {
      mockedFs.accessSync.mockImplementation(() => {});

      const result = FileUtils.checkPermissions(testFile);

      expect(result).toBe(true);
      expect(mockedFs.accessSync).toHaveBeenCalledWith(
        testFile,
        fs.constants.R_OK | fs.constants.W_OK
      );
    });

    it("should return false when permissions are insufficient", () => {
      mockedFs.accessSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = FileUtils.checkPermissions(testFile);

      expect(result).toBe(false);
    });

    it("should use custom permission mode", () => {
      mockedFs.accessSync.mockImplementation(() => {});

      FileUtils.checkPermissions(testFile, fs.constants.R_OK);

      expect(mockedFs.accessSync).toHaveBeenCalledWith(
        testFile,
        fs.constants.R_OK
      );
    });
  });

  describe("getExtension", () => {
    it("should return file extension in lowercase", () => {
      expect(FileUtils.getExtension("test.TXT")).toBe(".txt");
      expect(FileUtils.getExtension("archive.tar.gz")).toBe(".gz");
      expect(FileUtils.getExtension("filename")).toBe("");
      expect(FileUtils.getExtension("")).toBe("");
    });
  });

  describe("getBaseName", () => {
    it("should return filename without extension", () => {
      expect(FileUtils.getBaseName("test.txt")).toBe("test");
      expect(FileUtils.getBaseName("archive.tar.gz")).toBe("archive.tar");
      expect(FileUtils.getBaseName("filename")).toBe("filename");
      expect(FileUtils.getBaseName("/path/to/test.txt")).toBe("test");
    });
  });

  describe("normalizePath", () => {
    it("should normalize path correctly", () => {
      expect(FileUtils.normalizePath("/path//to/../file")).toBe("/path/file");
      expect(FileUtils.normalizePath("path\\to\\file")).toBe("path\\to\\file");
    });
  });

  describe("resolvePath", () => {
    it("should resolve relative path to absolute path", () => {
      const result = FileUtils.resolvePath("relative/path", "/base");

      expect(result).toBe(path.resolve("/base", "relative/path"));
    });

    it("should resolve path without base", () => {
      const result = FileUtils.resolvePath("relative/path");

      expect(result).toBe(path.resolve("relative/path"));
    });
  });
});
