import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { configManager } from '../configManager.js';
import { logger } from '../Logger.js';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  message?: string;
  expiresIn?: number;
}

export interface AuthUser {
  username: string;
  role: 'admin';
}

/**
 * 认证服务
 * 处理用户登录、token验证等认证相关功能
 */
export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 检查是否启用了认证
   */
  public isAuthEnabled(): boolean {
    return configManager.isAuthEnabled();
  }

  /**
   * 用户登录
   */
  public async login(loginRequest: LoginRequest): Promise<LoginResponse> {
    try {
      // 检查是否启用认证
      if (!this.isAuthEnabled()) {
        return {
          success: false,
          message: '认证功能未启用'
        };
      }

      const { username, password } = loginRequest;

      // 验证输入
      if (!username || !password) {
        return {
          success: false,
          message: '用户名和密码不能为空'
        };
      }

      // 获取管理员凭据
      const adminCredentials = configManager.getAdminCredentials();
      if (!adminCredentials) {
        logger.error('管理员凭据未配置');
        return {
          success: false,
          message: '系统配置错误'
        };
      }

      // 验证用户名
      if (username !== adminCredentials.username) {
        logger.warn(`登录失败：用户名错误 - ${username}`);
        return {
          success: false,
          message: '用户名或密码错误'
        };
      }

      // 验证密码（支持明文和bcrypt加密两种方式）
      const isPasswordValid = await this.verifyPassword(password, adminCredentials.password);
      if (!isPasswordValid) {
        logger.warn(`登录失败：密码错误 - ${username}`);
        return {
          success: false,
          message: '用户名或密码错误'
        };
      }

      // 生成JWT token
      const token = this.generateToken({ username, role: 'admin' });
      const expiresIn = configManager.getSessionTimeout();

      logger.info(`用户登录成功 - ${username}`);

      return {
        success: true,
        token,
        expiresIn,
        message: '登录成功'
      };

    } catch (error) {
      logger.error('登录过程中发生错误:', error);
      return {
        success: false,
        message: '系统错误，请稍后重试'
      };
    }
  }

  /**
   * 验证密码
   * 支持明文密码和bcrypt加密密码
   */
  private async verifyPassword(inputPassword: string, storedPassword: string): Promise<boolean> {
    try {
      // 检查是否为bcrypt加密的密码（bcrypt hash通常以$2a$、$2b$或$2y$开头）
      if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
        // 使用bcrypt验证
        return await bcrypt.compare(inputPassword, storedPassword);
      } else {
        // 明文密码比较
        return inputPassword === storedPassword;
      }
    } catch (error) {
      logger.error('密码验证失败:', error);
      return false;
    }
  }

  /**
   * 生成JWT token
   */
  public generateToken(user: AuthUser): string {
    const jwtSecret = configManager.getJwtSecret();
    const expiresIn = configManager.getSessionTimeout();

    return jwt.sign(
      {
        username: user.username,
        role: user.role,
        iat: Math.floor(Date.now() / 1000)
      },
      jwtSecret,
      {
        expiresIn: `${expiresIn}s`
      }
    );
  }

  /**
   * 验证JWT token
   */
  public verifyToken(token: string): AuthUser | null {
    try {
      const jwtSecret = configManager.getJwtSecret();
      const decoded = jwt.verify(token, jwtSecret) as any;

      if (decoded && decoded.username && decoded.role) {
        return {
          username: decoded.username,
          role: decoded.role
        };
      }

      return null;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('Token已过期');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.debug('Token格式无效');
      } else {
        logger.error('Token验证失败:', error);
      }
      return null;
    }
  }

  /**
   * 刷新token
   */
  public refreshToken(token: string): string | null {
    const user = this.verifyToken(token);
    if (!user) {
      return null;
    }

    return this.generateToken(user);
  }

  /**
   * 生成bcrypt加密密码（用于配置文件中存储密码）
   */
  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }
}

// 导出单例实例
export const authService = AuthService.getInstance();
