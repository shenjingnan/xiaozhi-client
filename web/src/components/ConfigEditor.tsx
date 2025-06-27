import { useEffect, useState } from "react";
import type { AppConfig } from "../types";

interface ConfigEditorProps {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
}

function ConfigEditor({ config, onChange }: ConfigEditorProps) {
  const [localConfig, setLocalConfig] = useState(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (field: string, value: any) => {
    const newConfig = { ...localConfig };

    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      (newConfig as any)[parent] = {
        ...(newConfig as any)[parent],
        [child]: value,
      };
    } else {
      (newConfig as any)[field] = value;
    }

    setLocalConfig(newConfig);
  };

  const handleSave = () => {
    onChange(localConfig);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="mcpEndpoint"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            MCP 接入点
          </label>
          <input
            id="mcpEndpoint"
            type="text"
            value={localConfig.mcpEndpoint}
            onChange={(e) => handleChange("mcpEndpoint", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="wss://api.xiaozhi.me/mcp/?token=..."
          />
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">连接配置</h4>
          <div className="space-y-2 pl-4">
            <div>
              <label
                htmlFor="heartbeatInterval"
                className="block text-xs text-gray-600"
              >
                心跳间隔 (毫秒)
              </label>
              <input
                id="heartbeatInterval"
                type="number"
                value={localConfig.connection?.heartbeatInterval || 30000}
                onChange={(e) =>
                  handleChange(
                    "connection.heartbeatInterval",
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="heartbeatTimeout"
                className="block text-xs text-gray-600"
              >
                心跳超时 (毫秒)
              </label>
              <input
                id="heartbeatTimeout"
                type="number"
                value={localConfig.connection?.heartbeatTimeout || 10000}
                onChange={(e) =>
                  handleChange(
                    "connection.heartbeatTimeout",
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="reconnectInterval"
                className="block text-xs text-gray-600"
              >
                重连间隔 (毫秒)
              </label>
              <input
                id="reconnectInterval"
                type="number"
                value={localConfig.connection?.reconnectInterval || 5000}
                onChange={(e) =>
                  handleChange(
                    "connection.reconnectInterval",
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        {localConfig.modelscope && (
          <div>
            <label
              htmlFor="modelScopeApiKey"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              ModelScope API Key
            </label>
            <input
              id="modelScopeApiKey"
              type="password"
              value={localConfig.modelscope.apiKey || ""}
              onChange={(e) =>
                handleChange("modelscope.apiKey", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入您的 API 密钥"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          保存配置
        </button>
      </div>
    </div>
  );
}

export default ConfigEditor;
