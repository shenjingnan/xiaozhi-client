# Xiaozhi Client Docker 运行环境
# 基于 Node.js 20 的预配置容器，用于快速运行 xiaozhi-client

FROM node:20-alpine

# 安装必要的系统依赖
RUN apk add --no-cache \
    dumb-init \
    git \
    && addgroup -g 1001 -S xiaozhi \
    && adduser -S xiaozhi -u 1001 -G xiaozhi

# 全局安装 xiaozhi-client
RUN npm install -g xiaozhi-client

# 设置工作目录
WORKDIR /workspace

# 复制 hello-world 模板作为初始项目结构
COPY templates/hello-world/ ./

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
ENV NODE_ENV=production
ENV XIAOZHI_WORKSPACE=/workspace

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD xiaozhi --version || exit 1

# 使用 dumb-init 作为 PID 1 进程
ENTRYPOINT ["dumb-init", "--"]

# 默认命令 - 启动 xiaozhi-client
CMD ["xiaozhi", "start"]
