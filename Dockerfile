# Xiaozhi Client Docker 运行环境
# 基于 Node.js 20 的预配置容器，用于快速运行 xiaozhi-client

# ================================
# 基础阶段 - 共享的系统设置
# ================================
FROM node:20-alpine AS base

# 安装必要的系统依赖
RUN apk add --no-cache \
    dumb-init \
    git \
    && npm install -g pnpm \
    && addgroup -g 1001 -S xiaozhi \
    && adduser -S xiaozhi -u 1001 -G xiaozhi

# ================================
# 开发阶段 - 使用本地代码构建
# ================================
FROM base AS development

# 设置构建工作目录
WORKDIR /build

# 复制依赖文件（利用 Docker 缓存）
COPY package.json pnpm-lock.yaml ./

# 安装依赖（包括 devDependencies）
RUN pnpm install --frozen-lockfile

# 复制源码和配置文件
COPY . .

# 构建项目
RUN pnpm run build

# 全局安装本地构建的包
RUN npm install -g .

# ================================
# 生产阶段 - 使用 npm 正式版本
# ================================
FROM base AS production

# 全局安装 xiaozhi-client 正式版本
RUN npm install -g xiaozhi-client

# ================================
# 运行时阶段 - 共享的运行时设置
# ================================
FROM base AS runtime

# 设置工作目录
WORKDIR /workspace

# 复制模板作为初始项目结构
COPY templates/docker/ ./

# 安装模板项目的依赖
RUN npm install

# 创建配置和日志目录
RUN mkdir -p /workspace/config /workspace/logs

# 设置目录权限
RUN chown -R xiaozhi:xiaozhi /workspace

# 切换到非 root 用户
USER xiaozhi

# 暴露端口
EXPOSE 9999 3000

# 设置环境变量
ENV XIAOZHI_WORKSPACE=/workspace
ENV XIAOZHI_CONTAINER=true
ENV XIAOZHI_CONFIG_DIR=/workspace

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD xiaozhi --version || exit 1

# 使用 dumb-init 作为 PID 1 进程
ENTRYPOINT ["dumb-init", "--"]

# 默认命令 - 启动 xiaozhi-client
CMD ["xiaozhi", "start", "--ui"]

# ================================
# 开发环境最终阶段
# ================================
FROM development AS dev
# 继承 runtime 阶段的设置，但先安装开发版本
USER root
WORKDIR /workspace
COPY templates/docker/ ./
RUN npm install
RUN mkdir -p /workspace/config /workspace/logs
RUN chown -R xiaozhi:xiaozhi /workspace
USER xiaozhi
ENV NODE_ENV=development
ENV XIAOZHI_WORKSPACE=/workspace
ENV XIAOZHI_CONTAINER=true
ENV XIAOZHI_CONFIG_DIR=/workspace
EXPOSE 9999 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD xiaozhi --version || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["xiaozhi", "start", "--ui"]

# ================================
# 生产环境最终阶段（默认）
# ================================
FROM production
# 继承 runtime 阶段的设置
WORKDIR /workspace
COPY templates/docker/ ./
RUN npm install
RUN mkdir -p /workspace/config /workspace/logs
RUN chown -R xiaozhi:xiaozhi /workspace
USER xiaozhi
ENV NODE_ENV=production
ENV XIAOZHI_WORKSPACE=/workspace
ENV XIAOZHI_CONTAINER=true
ENV XIAOZHI_CONFIG_DIR=/workspace
EXPOSE 9999 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD xiaozhi --version || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["xiaozhi", "start", "--ui"]
