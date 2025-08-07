# Xiaozhi Client Docker 运行环境
# 基于 Node.js 20 的预配置容器，用于快速运行 xiaozhi-client

FROM node:20

# 安装必要的系统依赖
RUN apt-get update && apt-get install -y \
    dumb-init \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm xiaozhi-client \
    && groupadd -g 1001 xiaozhi \
    && useradd -r -u 1001 -g xiaozhi xiaozhi

# 设置工作目录
WORKDIR /workspaces

# 复制模板作为初始项目结构
COPY templates/docker/ ./

# 安装模板项目的依赖
RUN npm install

# 设置目录权限
RUN chown -R xiaozhi:xiaozhi /workspaces

# 切换到非 root 用户
USER xiaozhi

# 暴露端口
EXPOSE 9999 3000

# 设置环境变量
ENV NODE_ENV=production
ENV XIAOZHI_WORKSPACE=/workspaces
ENV XIAOZHI_CONTAINER=true
ENV XIAOZHI_CONFIG_DIR=/workspaces

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD xiaozhi --version || exit 1

# 使用 dumb-init 作为 PID 1 进程
ENTRYPOINT ["dumb-init", "--"]

# 默认命令 - 启动 xiaozhi-client
CMD ["xiaozhi", "start", "--ui"]
