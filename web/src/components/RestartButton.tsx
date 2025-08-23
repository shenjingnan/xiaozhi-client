import { Button } from "@/components/ui/button";
import { useWebSocketContext } from "@/providers/WebSocketProvider";
import { WebSocketState } from "@/services/WebSocketManager";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * 独立的重启按钮组件
 * 基于 ConfigEditor.tsx 中的重启服务功能实现
 */
export function RestartButton() {
  const [isRestarting, setIsRestarting] = useState(false);
  const { websocket } = useWebSocketContext();

  const checkStatus = () => {
    setTimeout(() => {
      if (websocket.getState() === WebSocketState.CONNECTED) {
        setIsRestarting(false);
        toast.success("重启服务成功");
        return;
      }
      checkStatus();
    }, 1000);
  };

  const handleRestart = async () => {
    if (isRestarting) {
      return;
    }
    websocket.sendRestartService();
    setIsRestarting(true);
    checkStatus();
  };

  return (
    <Button
      type="button"
      onClick={handleRestart}
      variant="outline"
      disabled={isRestarting}
      className="flex items-center gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isRestarting ? "animate-spin" : ""}`} />
      {isRestarting ? "重启中..." : "重启服务"}
    </Button>
  );
}
