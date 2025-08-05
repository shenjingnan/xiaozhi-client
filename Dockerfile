# 多阶段构建 Dockerfile for xiaozhi-client
# Stage 1: 构建阶段
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 package.json 和 lock 文件以利用 Docker 缓存
COPY package.json pnpm-lock.yaml ./
COPY web/package.json web/pnpm-lock.yaml ./web/

# 安装根目录依赖
RUN pnpm install --frozen-lockfile

# 安装 web 目录依赖
WORKDIR /app/web
RUN pnpm install --frozen-lockfile

# 回到根目录
WORKDIR /app

# 复制源代码和配置文件
COPY . .

# 构建项目（先构建 web，再构建主项目）
RUN pnpm run build

# Stage 2: 生产阶段
FROM node:20-alpine AS production

# 安装必要的系统依赖
RUN apk add --no-cache \
    dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S xiaozhi -u 1001

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制 package.json 用于生产依赖安装
COPY package.json pnpm-lock.yaml ./

# 只安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 从构建阶段复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web/dist ./web/dist
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/xiaozhi.config.default.json ./
COPY --from=builder /app/README.md ./
COPY --from=builder /app/LICENSE ./

# 创建配置目录和日志目录
RUN mkdir -p /app/config /app/logs \
    && chown -R xiaozhi:nodejs /app

# 切换到非 root 用户
USER xiaozhi

# 暴露端口（如果应用有 web 服务）
EXPOSE 3000 8080

# 设置环境变量
ENV NODE_ENV=production
ENV XIAOZHI_CONFIG_DIR=/app/config
ENV XIAOZHI_LOG_DIR=/app/logs

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node dist/cli.js --version || exit 1

# 使用 dumb-init 作为 PID 1 进程
ENTRYPOINT ["dumb-init", "--"]

# 默认命令
CMD ["node", "dist/cli.js", "start"]
