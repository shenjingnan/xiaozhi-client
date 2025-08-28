import type { Context } from 'hono';
import { authService, type LoginRequest } from '../services/AuthService.js';
import { configManager } from '../configManager.js';
import { logger } from '../Logger.js';

/**
 * 认证API处理器
 * 处理登录、登出、token刷新等认证相关的API请求
 */
export class AuthApiHandler {
  /**
   * 用户登录
   */
  public async login(c: Context): Promise<Response> {
    try {
      // 检查是否启用认证
      if (!authService.isAuthEnabled()) {
        return c.json({
          error: {
            code: 'AUTH_DISABLED',
            message: '认证功能未启用'
          }
        }, 400);
      }

      const loginRequest: LoginRequest = await c.req.json();
      const result = await authService.login(loginRequest);

      if (result.success) {
        return c.json({
          success: true,
          data: {
            token: result.token,
            expiresIn: result.expiresIn
          },
          message: result.message
        });
      } else {
        return c.json({
          error: {
            code: 'LOGIN_FAILED',
            message: result.message || '登录失败'
          }
        }, 401);
      }

    } catch (error) {
      logger.error('登录API错误:', error);
      return c.json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '系统错误，请稍后重试'
        }
      }, 500);
    }
  }

  /**
   * 刷新token
   */
  public async refreshToken(c: Context): Promise<Response> {
    try {
      // 检查是否启用认证
      if (!authService.isAuthEnabled()) {
        return c.json({
          error: {
            code: 'AUTH_DISABLED',
            message: '认证功能未启用'
          }
        }, 400);
      }

      // 从请求头获取当前token
      const authHeader = c.req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({
          error: {
            code: 'UNAUTHORIZED',
            message: '未提供有效的认证token'
          }
        }, 401);
      }

      const currentToken = authHeader.substring(7);
      const newToken = authService.refreshToken(currentToken);

      if (!newToken) {
        return c.json({
          error: {
            code: 'TOKEN_REFRESH_FAILED',
            message: 'Token刷新失败，请重新登录'
          }
        }, 401);
      }

      return c.json({
        success: true,
        data: {
          token: newToken,
          expiresIn: authService.isAuthEnabled() ? 
            configManager.getSessionTimeout() : 86400
        },
        message: 'Token刷新成功'
      });

    } catch (error) {
      logger.error('Token刷新API错误:', error);
      return c.json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '系统错误，请稍后重试'
        }
      }, 500);
    }
  }

  /**
   * 验证token状态
   */
  public async verifyToken(c: Context): Promise<Response> {
    try {
      // 检查是否启用认证
      if (!authService.isAuthEnabled()) {
        return c.json({
          success: true,
          data: {
            valid: true,
            message: '认证功能未启用'
          }
        });
      }

      // 从请求头获取token
      const authHeader = c.req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({
          success: true,
          data: {
            valid: false,
            message: '未提供认证token'
          }
        });
      }

      const token = authHeader.substring(7);
      const user = authService.verifyToken(token);

      return c.json({
        success: true,
        data: {
          valid: !!user,
          user: user ? { username: user.username, role: user.role } : null,
          message: user ? 'Token有效' : 'Token无效或已过期'
        }
      });

    } catch (error) {
      logger.error('Token验证API错误:', error);
      return c.json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '系统错误，请稍后重试'
        }
      }, 500);
    }
  }

  /**
   * 获取认证状态
   */
  public async getAuthStatus(c: Context): Promise<Response> {
    try {
      const isEnabled = authService.isAuthEnabled();
      
      return c.json({
        success: true,
        data: {
          enabled: isEnabled,
          message: isEnabled ? '认证功能已启用' : '认证功能未启用'
        }
      });

    } catch (error) {
      logger.error('获取认证状态API错误:', error);
      return c.json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '系统错误，请稍后重试'
        }
      }, 500);
    }
  }

  /**
   * 用户登出（客户端处理，服务端只返回成功）
   */
  public async logout(c: Context): Promise<Response> {
    try {
      return c.json({
        success: true,
        message: '登出成功'
      });

    } catch (error) {
      logger.error('登出API错误:', error);
      return c.json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '系统错误，请稍后重试'
        }
      }, 500);
    }
  }
}
