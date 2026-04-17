/**
 * MCP 服务器表格对话框组件
 *
 * 在对话框中展示 MCP 服务器列表，提供搜索、排序和分页功能。
 */

"use client";

import { McpServerTable } from "@/components/mcp-server/mcp-server-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Server } from "lucide-react";
import { useState } from "react";

/**
 * MCP 服务器表格对话框组件
 */
export function McpServerTableDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="size-8"
          aria-label="MCP服务列表"
          title="MCP服务列表"
        >
          <Server className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>MCP 服务器列表</DialogTitle>
        </DialogHeader>
        <McpServerTable />
      </DialogContent>
    </Dialog>
  );
}
