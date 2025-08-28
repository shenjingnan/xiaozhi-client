export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    expiresIn: number;
  };
  message?: string;
}

export interface AuthUser {
  username: string;
  role: 'admin';
}

export interface AuthStatus {
  enabled: boolean;
  message: string;
}

export interface TokenVerifyResponse {
  success: boolean;
  data: {
    valid: boolean;
    user?: AuthUser;
    message: string;
  };
}

/**
 * 认证服务
 * 处理前端的认证逻辑，包括登录、token管理等
 */
export class AuthService {
  private static readonly TOKEN_KEY = 'xiaozhi_auth_token';
  private static readonly API_BASE = '/api/auth';

  /**
   * 获取存储的token
   */
  public static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * 存储token
   */
  public static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * 清除token
   */
  public static clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  /**
   * 检查是否已登录
   */
  public static isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /**
   * 获取认证状态
   */
  public static async getAuthStatus(): Promise<AuthStatus> {
    try {
      const response = await fetch(`${this.API_BASE}/status`);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      }
      
      return { enabled: false, message: '获取认证状态失败' };
    } catch (error) {
      console.error('获取认证状态失败:', error);
      return { enabled: false, message: '网络错误' };
    }
  }

  /**
   * 用户登录
   */
  public static async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();
      
      if (result.success && result.data?.token) {
        // 存储token
        this.setToken(result.data.token);
        return {
          success: true,
          data: result.data,
          message: result.message,
        };
      }
      
      return {
        success: false,
        message: result.error?.message || '登录失败',
      };
    } catch (error) {
      console.error('登录失败:', error);
      return {
        success: false,
        message: '网络错误，请稍后重试',
      };
    }
  }

  /**
   * 用户登出
   */
  public static async logout(): Promise<void> {
    try {
      const token = this.getToken();
      if (token) {
        await fetch(`${this.API_BASE}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('登出请求失败:', error);
    } finally {
      // 无论请求是否成功，都清除本地token
      this.clearToken();
    }
  }

  /**
   * 验证token是否有效
   */
  public static async verifyToken(): Promise<boolean> {
    try {
      const token = this.getToken();
      if (!token) {
        return false;
      }

      const response = await fetch(`${this.API_BASE}/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result: TokenVerifyResponse = await response.json();
      
      if (result.success && result.data.valid) {
        return true;
      } else {
        // token无效，清除本地存储
        this.clearToken();
        return false;
      }
    } catch (error) {
      console.error('Token验证失败:', error);
      this.clearToken();
      return false;
    }
  }

  /**
   * 刷新token
   */
  public static async refreshToken(): Promise<boolean> {
    try {
      const token = this.getToken();
      if (!token) {
        return false;
      }

      const response = await fetch(`${this.API_BASE}/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      
      if (result.success && result.data?.token) {
        this.setToken(result.data.token);
        return true;
      } else {
        this.clearToken();
        return false;
      }
    } catch (error) {
      console.error('Token刷新失败:', error);
      this.clearToken();
      return false;
    }
  }

  /**
   * 获取带有认证头的fetch配置
   */
  public static getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  /**
   * 带认证的fetch请求
   */
  public static async authenticatedFetch(
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }
}
