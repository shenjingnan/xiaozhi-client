# Xiaozhi Client Docker 运行环境
# 基于 Node.js 20 的预配置容器，用于快速运行 xiaozhi-client

FROM node:20

# 定义 xiaozhi-client 版本号
# 默认使用当前项目版本，可在构建时通过 --build-arg 覆盖
# 例如: docker build --build-arg XIAOZHI_VERSION=1.6.0 .
ARG XIAOZHI_VERSION=1.5.1

# 安装必要的系统依赖
RUN apt-get update && apt-get install -y \
    dumb-init \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm xiaozhi-client@${XIAOZHI_VERSION} \
    && groupadd -g 1001 xiaozhi \
    && useradd -r -u 1001 -g xiaozhi xiaozhi

# 设置工作目录
# 推荐挂载点: -v ~/xiaozhi-client:/workspaces
WORKDIR /workspaces

# 复制模板到备份目录（避免被卷挂载覆盖）
COPY templates/docker/ /templates-backup/

# 创建初始化脚本
RUN cat > /usr/local/bin/init-xiaozhi.sh << 'EOF'
#!/bin/bash
set -e

echo "检查工作目录初始化状态..."

# 检查关键配置文件是否存在
if [ ! -f "/workspaces/xiaozhi.config.json" ] || [ ! -f "/workspaces/package.json" ]; then
    echo "初始化工作目录..."
    echo "将模板文件复制到 ~/xiaozhi-client (挂载到 /workspaces)"

    # 确保目录存在
    mkdir -p /workspaces

    # 复制模板文件到工作目录
    cp -r /templates-backup/* /workspaces/

    # 设置正确的权限
    chown -R xiaozhi:xiaozhi /workspaces

    echo "工作目录初始化完成"
    echo "配置文件位置: ~/xiaozhi-client/xiaozhi.config.json"
else
    echo "工作目录已存在配置文件，跳过初始化"
fi

# 确保依赖已安装
cd /workspaces
if [ ! -d "node_modules" ]; then
    echo "安装项目依赖..."
    npm install
fi

echo "启动 xiaozhi-client..."
exec "$@"
EOF

# 设置脚本权限
RUN chmod +x /usr/local/bin/init-xiaozhi.sh

# 安装模板项目的依赖到备份目录（用于初始化时复制）
RUN cd /templates-backup && npm install

# 设置目录权限
RUN chown -R xiaozhi:xiaozhi /workspaces /templates-backup

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

# 使用 dumb-init 作为 PID 1 进程，并使用初始化脚本
ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/init-xiaozhi.sh"]

# 默认命令 - 启动 xiaozhi-client
CMD ["xiaozhi", "start", "--ui"]
