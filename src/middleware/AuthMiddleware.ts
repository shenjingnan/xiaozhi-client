import type { Context, Next } from 'hono';
import { authService } from '../services/AuthService.js';
import { logger } from '../Logger.js';

/**
 * 认证中间件
 * 检查请求是否包含有效的JWT token
 */
export const authMiddleware = async (c: Context, next: Next): Promise<Response | void> => {
  try {
    // 如果认证未启用，直接通过
    if (!authService.isAuthEnabled()) {
      await next();
      return;
    }

    // 从请求头获取token
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.debug('请求缺少Authorization头或格式错误');
      return c.json({
        error: {
          code: 'UNAUTHORIZED',
          message: '未提供有效的认证token'
        }
      }, 401);
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀
    const user = authService.verifyToken(token);

    if (!user) {
      logger.debug('Token验证失败');
      return c.json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token无效或已过期'
        }
      }, 401);
    }

    // 将用户信息添加到上下文中
    c.set('user', user);
    await next();

  } catch (error) {
    logger.error('认证中间件错误:', error);
    return c.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: '认证验证失败'
      }
    }, 500);
  }
};

/**
 * 可选认证中间件
 * 如果提供了token则验证，但不强制要求认证
 */
export const optionalAuthMiddleware = async (c: Context, next: Next): Promise<void> => {
  try {
    // 如果认证未启用，直接通过
    if (!authService.isAuthEnabled()) {
      await next();
      return;
    }

    // 从请求头获取token
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = authService.verifyToken(token);
      
      if (user) {
        // 将用户信息添加到上下文中
        c.set('user', user);
      }
    }

    await next();

  } catch (error) {
    logger.error('可选认证中间件错误:', error);
    // 即使认证失败也继续执行，因为这是可选的
    await next();
  }
};
