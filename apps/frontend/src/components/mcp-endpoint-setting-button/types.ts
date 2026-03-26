/**
 * 接入点状态接口
 */
export interface EndpointState {
  /** 是否已连接 */
  connected: boolean;
  /** 是否正在操作中 */
  isOperating: boolean;
  /** 最后一次操作信息 */
  lastOperation: {
    type: "connect" | "disconnect" | "reconnect" | null;
    success: boolean;
    message: string;
    timestamp: number;
  };
}

/**
 * 接入点操作回调接口
 */
export interface EndpointOperationCallbacks {
  /** 连接接入点 */
  onConnect: (endpoint: string) => void;
  /** 断开接入点 */
  onDisconnect: (endpoint: string) => void;
  /** 复制接入点地址 */
  onCopy: (endpoint: string) => void;
  /** 删除接入点 */
  onDelete: (endpoint: string) => void;
}

/**
 * 接入点项属性接口
 */
export interface EndpointItemProps {
  /** 接入点地址 */
  endpoint: string;
  /** 接入点状态 */
  state?: EndpointState;
  /** 操作回调 */
  callbacks: EndpointOperationCallbacks;
}
