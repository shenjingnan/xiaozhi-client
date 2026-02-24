import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Tool {
  name: string;
  serverName: string;
  toolName: string;
  description?: string;
  inputSchema?: any;
}

interface ToolInfoCardProps {
  tool: Tool;
}

/**
 * 工具信息卡片组件
 *
 * @description 显示工具的基本信息，包括服务器名称、工具名称和描述。
 */
export function ToolInfoCard({ tool }: ToolInfoCardProps) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Badge variant="secondary">{tool.serverName}</Badge>
          {tool.toolName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tool.description && (
          <p className="text-sm text-muted-foreground mt-2">
            {tool.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
