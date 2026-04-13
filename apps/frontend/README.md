# 小智客户端 Web UI

这是小智客户端的 Web 配置界面，提供了一个现代化、直观的界面来管理 MCP 服务配置。

## 功能特性

- 🎨 **现代化设计**：基于 shadcn/ui 组件库，提供优雅的用户界面
- 🔧 **可视化配置**：无需手动编辑 JSON 文件，通过界面即可完成所有配置
- 🚀 **实时状态监控**：实时显示与小智服务器的连接状态
- 📦 **MCP 服务管理**：支持添加、编辑、删除 MCP 服务，支持本地和 SSE 类型
- ⚙️ **灵活的配置选项**：可调整心跳间隔、超时时间等连接参数
- 🎯 **优秀的用户体验**：Toast 通知、确认对话框、平滑动画等

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **UI 组件**: shadcn/ui
- **状态管理**: React Hooks
- **通知系统**: Sonner
- **图标**: Lucide React
- **代码质量**: Biome (代码格式化和 linting)
- **测试**: Vitest + React Testing Library

## 开发指南

### 安装依赖

```bash
pnpm install
```

### 开发命令

```bash
# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 预览生产构建
pnpm preview

# 运行测试
pnpm test

# 运行测试（watch 模式）
pnpm test:watch

# 生成测试覆盖率报告
pnpm test:coverage

# 代码检查和格式化
pnpm lint

# 类型检查
pnpm typecheck

# 运行所有检查并修复
pnpm check:fix
```

### 项目结构

```
web/
├── src/
│   ├── components/
│   │   ├── ui/          # shadcn/ui 组件
│   │   ├── ConfigEditor.tsx    # 配置编辑器
│   │   ├── MCPServerList.tsx   # MCP 服务列表
│   │   └── StatusCard.tsx      # 状态卡片
│   ├── hooks/           # 自定义 React Hooks
│   │   └── useWebSocket.ts     # WebSocket 连接管理
│   ├── pages/           # 页面组件
│   │   └── Dashboard.tsx       # 主控制台页面
│   ├── types/           # TypeScript 类型定义
│   ├── utils/           # 工具函数
│   ├── App.tsx          # 应用主组件
│   ├── main.tsx         # 应用入口
│   └── index.css        # 全局样式
├── public/              # 静态资源
├── tests/               # 测试文件
└── package.json         # 项目配置
```

### UI 组件说明

#### StatusCard
显示与小智服务器的连接状态，包括：
- 连接状态指示器（连接中/已连接/已断开）
- 最后活动时间
- 重连按钮

#### ConfigEditor
配置编辑器，用于：
- 编辑 MCP 接入点 URL
- 调整连接参数（心跳间隔、超时时间等）
- 管理 ModelScope API Key

#### MCPServerList
MCP 服务管理界面，支持：
- 查看所有已配置的 MCP 服务
- 添加新服务（支持 JSON 批量导入）
- 编辑现有服务配置
- 删除服务（带确认对话框）

### 样式定制

项目使用 Tailwind CSS 和 CSS 变量进行样式管理。主题颜色定义在 `src/index.css` 中：

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  /* ... 其他颜色变量 */
}
```

### 添加新的 UI 组件

如果需要添加新的 shadcn/ui 组件：

```bash
# 查看可用组件
npx shadcn@latest add

# 添加特定组件（例如 dialog）
npx shadcn@latest add dialog
```

### 测试

项目使用 Vitest 进行单元测试：

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test ConfigEditor

# 生成覆盖率报告
pnpm test:coverage
```

### 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: 添加某个很棒的功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

提交前请确保：
- 所有测试通过 (`pnpm test`)
- 代码通过格式检查 (`pnpm check:fix`)
- 类型检查通过 (`pnpm typecheck`)

## 许可证

MIT License