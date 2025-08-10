# Xiaozhi Client Docker 运行环境
# 基于 Node.js 20 的预配置容器，用于快速运行 xiaozhi-client
# 针对中国国内网络环境优化，包含 Python3 支持

FROM node:20

# 定义 xiaozhi-client 版本号
# 默认使用当前项目版本，可在构建时通过 --build-arg 覆盖
# 例如: docker build --build-arg XIAOZHI_VERSION=1.6.0 .
ARG XIAOZHI_VERSION=1.5.1

# 配置国内镜像源以提升下载速度
# 配置 Debian 镜像源为阿里云镜像
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's/security.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources

# 配置 npm 和 pnpm 使用国内镜像源
# 设置 npm 注册表镜像
RUN npm config set registry https://registry.npmmirror.com

# 设置 node-gyp 相关的环境变量用于二进制文件下载镜像
ENV npm_config_dist_url=https://npmmirror.com/dist \
    npm_config_electron_mirror=https://npmmirror.com/mirrors/electron/ \
    npm_config_sass_binary_site=https://npmmirror.com/mirrors/node-sass/ \
    npm_config_phantomjs_cdnurl=https://npmmirror.com/mirrors/phantomjs/

# 安装必要的系统依赖和 Python3
RUN apt-get update && apt-get install -y \
    dumb-init \
    git \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    && pip3 config set global.trusted-host pypi.tuna.tsinghua.edu.cn \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && ln -sf /usr/bin/pip3 /usr/bin/pip \
    && pip3 install --break-system-packages uv \
    && npm install -g pnpm xiaozhi-client@${XIAOZHI_VERSION} \
    && pnpm config set registry https://registry.npmmirror.com

# 验证工具可用性
RUN npx --version && echo "✓ npx is available" \
    && uv --version && echo "✓ uv is available" \
    && uvx --version && echo "✓ uvx is available"

# 设置工作目录
# 推荐挂载点: -v ~/xiaozhi-client:/workspaces
WORKDIR /workspaces

# 复制模板到备份目录（避免被卷挂载覆盖）
COPY templates/docker/ /templates-backup/

# 复制初始化脚本并设置权限
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# 安装模板项目的依赖到备份目录（用于初始化时复制）
# 使用国内镜像源安装依赖
RUN cd /templates-backup && npm install --registry=https://registry.npmmirror.com

# 设置脚本权限
RUN chmod +x /usr/local/bin/docker-entrypoint.sh


# 暴露端口
EXPOSE 9999 3000

# 设置环境变量
ENV NODE_ENV=production
ENV XIAOZHI_WORKSPACE=/workspaces
ENV XIAOZHI_CONTAINER=true
ENV XIAOZHI_CONFIG_DIR=/workspaces

# 健康检查 - 检查 xiaozhi 服务是否正常运行
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD xiaozhi --version > /dev/null 2>&1 || exit 1

# 使用 dumb-init 作为 PID 1 进程，并使用初始化脚本
ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]

# 默认命令 - 启动 xiaozhi-client
CMD ["xiaozhi", "start", "--ui"]
