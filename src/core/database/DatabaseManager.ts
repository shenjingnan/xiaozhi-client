/**
 * SQLite 数据库管理器
 * 负责数据库初始化、连接管理和日志存储
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { type Logger, logger } from "../../Logger.js";
import type {
  DatabaseConfig,
  DatabaseInitResult,
  DatabaseStats,
  LogCategory,
  LogEntry,
  LogInsertResult,
  LogLevel,
  LogQueryOptions,
} from "./types.js";

/**
 * 数据库管理器类
 */
export class DatabaseManager {
  private db: Database.Database | null = null;
  private readonly config: DatabaseConfig;
  private readonly logger: Logger;

  /**
   * 构造函数
   * @param configDir 配置文件目录路径
   */
  constructor(configDir: string) {
    this.config = {
      dbPath: path.join(configDir, "xiaozhi.db"),
      foreignKeys: true,
      walMode: true,
    };
    this.logger = logger.child({ component: "DatabaseManager" });
  }

  /**
   * 初始化数据库连接和表结构
   * @returns 初始化结果
   */
  initialize(): DatabaseInitResult {
    const startTime = Date.now();

    try {
      // 确保数据库目录存在
      const dbDir = path.dirname(this.config.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // 创建数据库连接
      this.db = new Database(this.config.dbPath);

      // 配置数据库选项
      this.configureDatabase();

      // 创建表和索引
      const tablesCreated = this.createTables();

      const duration = Date.now() - startTime;
      this.logger.info("数据库初始化成功", {
        dbPath: this.config.dbPath,
        duration: `${duration}ms`,
        tablesCreated,
      });

      return {
        success: true,
        tablesCreated,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error("数据库初始化失败", {
        error: errorMessage,
        dbPath: this.config.dbPath,
      });

      // 清理可能已创建的数据库连接
      this.close();

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 配置数据库选项
   */
  private configureDatabase(): void {
    if (!this.db) return;

    // 启用外键约束
    if (this.config.foreignKeys) {
      this.db.pragma("foreign_keys = ON");
    }

    // 启用 WAL 模式
    if (this.config.walMode) {
      this.db.pragma("journal_mode = WAL");
    }

    // 设置同步模式为 NORMAL（性能和安全的平衡）
    this.db.pragma("synchronous = NORMAL");

    // 设置缓存大小
    this.db.pragma("cache_size = 10000");
  }

  /**
   * 创建日志表和索引
   * @returns 创建的表名称列表
   */
  private createTables(): string[] {
    if (!this.db) throw new Error("数据库连接未初始化");

    const tablesCreated: string[] = [];

    // 创建日志表
    const createLogsTable = `
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        session_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.exec(createLogsTable);
    tablesCreated.push("logs");

    // 创建索引以提升查询性能
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)",
      "CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)",
      "CREATE INDEX IF NOT EXISTS idx_logs_category ON logs(category)",
      "CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type)",
      "CREATE INDEX IF NOT EXISTS idx_logs_session ON logs(session_id)",
      "CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at)",
    ];

    for (const indexSql of indexes) {
      try {
        this.db!.exec(indexSql);
      } catch (error) {
        this.logger.warn("创建索引失败", {
          indexSql,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return tablesCreated;
  }

  /**
   * 插入日志记录
   * @param entry 日志条目
   * @returns 插入结果
   */
  insertLog(entry: LogEntry): LogInsertResult {
    if (!this.db) {
      return { success: false, error: "数据库连接未初始化" };
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO logs (level, category, type, message, metadata, session_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        entry.level,
        entry.category,
        entry.type,
        entry.message,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.sessionId || null
      );

      this.logger.debug("日志插入成功", {
        logId: result.lastInsertRowid,
        level: entry.level,
        category: entry.category,
        type: entry.type,
      });

      return {
        success: true,
        logId: Number(result.lastInsertRowid),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error("日志插入失败", {
        error: errorMessage,
        entry: {
          level: entry.level,
          category: entry.category,
          type: entry.type,
          message: entry.message,
        },
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 查询日志记录
   * @param options 查询选项
   * @returns 日志记录数组
   */
  queryLogs(options: LogQueryOptions = {}): LogEntry[] {
    if (!this.db) {
      this.logger.warn("数据库连接未初始化，无法查询日志");
      return [];
    }

    try {
      let query = `
        SELECT id, timestamp, level, category, type, message, metadata, session_id
        FROM logs
        WHERE 1=1
      `;

      const params: any[] = [];

      // 添加过滤条件
      if (options.level) {
        query += " AND level = ?";
        params.push(options.level);
      }

      if (options.category) {
        query += " AND category = ?";
        params.push(options.category);
      }

      if (options.type) {
        query += " AND type = ?";
        params.push(options.type);
      }

      if (options.sessionId) {
        query += " AND session_id = ?";
        params.push(options.sessionId);
      }

      if (options.startTime) {
        query += " AND timestamp >= ?";
        params.push(options.startTime.toISOString());
      }

      if (options.endTime) {
        query += " AND timestamp <= ?";
        params.push(options.endTime.toISOString());
      }

      // 添加排序
      const orderBy = options.orderBy || "DESC";
      query += ` ORDER BY timestamp ${orderBy}`;

      // 添加分页
      if (options.limit) {
        query += " LIMIT ?";
        params.push(options.limit);

        if (options.offset) {
          query += " OFFSET ?";
          params.push(options.offset);
        }
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];

      return rows.map(this.mapRowToLogEntry);
    } catch (error) {
      this.logger.error("查询日志失败", {
        error: error instanceof Error ? error.message : String(error),
        options,
      });
      return [];
    }
  }

  /**
   * 获取数据库统计信息
   * @returns 统计信息
   */
  getStats(): DatabaseStats {
    if (!this.db) {
      return {
        totalLogs: 0,
        logsByLevel: { debug: 0, info: 0, warn: 0, error: 0 },
        logsByCategory: {} as Record<LogCategory, number>,
      };
    }

    try {
      // 总日志数
      const totalResult = this.db
        .prepare("SELECT COUNT(*) as count FROM logs")
        .get() as { count: number };
      const totalLogs = totalResult.count;

      // 按级别统计
      const levelStats = this.db
        .prepare(`
        SELECT level, COUNT(*) as count
        FROM logs
        GROUP BY level
      `)
        .all() as { level: LogLevel; count: number }[];

      const logsByLevel: Record<LogLevel, number> = {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
      };

      for (const { level, count } of levelStats) {
        logsByLevel[level] = count;
      }

      // 按分类统计
      const categoryStats = this.db
        .prepare(`
        SELECT category, COUNT(*) as count
        FROM logs
        GROUP BY category
      `)
        .all() as { category: LogCategory; count: number }[];

      const logsByCategory: Record<string, number> = {};
      for (const { category, count } of categoryStats) {
        logsByCategory[category] = count;
      }

      // 时间范围
      const timeRange = this.db
        .prepare(`
        SELECT
          MIN(timestamp) as oldest,
          MAX(timestamp) as newest
        FROM logs
      `)
        .get() as { oldest?: string; newest?: string };

      return {
        totalLogs,
        logsByLevel,
        logsByCategory: logsByCategory as Record<LogCategory, number>,
        oldestLog: timeRange.oldest ? new Date(timeRange.oldest) : undefined,
        newestLog: timeRange.newest ? new Date(timeRange.newest) : undefined,
      };
    } catch (error) {
      this.logger.error("获取统计信息失败", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        totalLogs: 0,
        logsByLevel: { debug: 0, info: 0, warn: 0, error: 0 },
        logsByCategory: {} as Record<LogCategory, number>,
      };
    }
  }

  /**
   * 清理旧日志记录
   * @param beforeDate 清理此日期之前的日志
   * @returns 清理的记录数
   */
  cleanupOldLogs(beforeDate: Date): number {
    if (!this.db) {
      this.logger.warn("数据库连接未初始化，无法清理日志");
      return 0;
    }

    try {
      const stmt = this.db.prepare("DELETE FROM logs WHERE timestamp < ?");
      const result = stmt.run(beforeDate.toISOString());

      const deletedCount = result.changes;
      this.logger.info("清理旧日志完成", {
        beforeDate: beforeDate.toISOString(),
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error("清理旧日志失败", {
        error: error instanceof Error ? error.message : String(error),
        beforeDate: beforeDate.toISOString(),
      });
      return 0;
    }
  }

  /**
   * 检查数据库是否可用
   * @returns 是否可用
   */
  isAvailable(): boolean {
    return this.db !== null;
  }

  /**
   * 安全关闭数据库连接
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
        this.logger.info("数据库连接已关闭");
      } catch (error) {
        this.logger.error("关闭数据库连接失败", {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.db = null;
      }
    }
  }

  /**
   * 获取数据库路径
   * @returns 数据库文件路径
   */
  getDbPath(): string {
    return this.config.dbPath;
  }

  /**
   * 将数据库行映射为日志条目
   * @param row 数据库行
   * @returns 日志条目
   */
  private mapRowToLogEntry(row: any): LogEntry {
    return {
      level: row.level as LogLevel,
      category: row.category as LogCategory,
      type: row.type,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      sessionId: row.session_id,
    };
  }
}
