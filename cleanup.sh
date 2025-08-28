#!/bin/bash

# Xiaozhi Client 清理脚本
# 清理一键部署脚本产生的所有文件和缓存

echo "🧹 开始清理 Xiaozhi Client 相关文件..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 信息函数
info_msg() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success_msg() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning_msg() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. 清理脚本文件
info_msg "清理脚本文件..."
rm -f ~/quick-deploy.sh
rm -f ./quick-deploy.sh
rm -f /tmp/quick-deploy.sh
rm -f get-docker.sh
rm -f /tmp/get-docker.sh
success_msg "脚本文件已清理"

# 2. 清理项目目录
info_msg "清理项目目录..."
if [ -d ~/xiaozhi-client ]; then
    rm -rf ~/xiaozhi-client
    success_msg "已删除 ~/xiaozhi-client"
fi

if [ -d ~/xiaozhi-client-source ]; then
    rm -rf ~/xiaozhi-client-source  
    success_msg "已删除 ~/xiaozhi-client-source"
fi

# 清理当前目录下的项目文件
for dir in ./xiaozhi-client*; do
    if [ -d "$dir" ]; then
        rm -rf "$dir"
        success_msg "已删除 $dir"
    fi
done

# 3. 清理Docker资源
if command -v docker &> /dev/null; then
    info_msg "清理Docker资源..."
    
    # 停止并删除容器
    if docker ps -a --format '{{.Names}}' | grep -q '^xiaozhi-client$'; then
        docker stop xiaozhi-client 2>/dev/null || true
        docker rm xiaozhi-client 2>/dev/null || true
        success_msg "已删除Docker容器"
    fi
    
    # 询问是否删除镜像
    echo -e "${YELLOW}是否删除Docker镜像 shenjingnan/xiaozhi-client? (y/n)${NC}"
    read -r response
    if [[ "$response" == "y" || "$response" == "Y" ]]; then
        docker rmi shenjingnan/xiaozhi-client:latest 2>/dev/null || true
        success_msg "已删除Docker镜像"
    fi
    
    # 清理未使用的Docker资源
    echo -e "${YELLOW}是否清理未使用的Docker资源? (y/n)${NC}"
    read -r response
    if [[ "$response" == "y" || "$response" == "Y" ]]; then
        docker system prune -f
        success_msg "已清理未使用的Docker资源"
    fi
fi

# 4. 清理npm包
if command -v npm &> /dev/null; then
    info_msg "清理npm包..."
    
    # 检查是否安装了xiaozhi-client
    if npm list -g xiaozhi-client &>/dev/null; then
        echo -e "${YELLOW}是否卸载全局安装的xiaozhi-client? (y/n)${NC}"
        read -r response
        if [[ "$response" == "y" || "$response" == "Y" ]]; then
            npm uninstall -g xiaozhi-client
            success_msg "已卸载xiaozhi-client"
        fi
    fi
    
    # 清理npm缓存
    npm cache clean --force
    success_msg "已清理npm缓存"
fi

# 5. 清理pnpm
if command -v pnpm &> /dev/null; then
    info_msg "清理pnpm..."
    
    echo -e "${YELLOW}是否卸载pnpm? (y/n)${NC}"
    read -r response
    if [[ "$response" == "y" || "$response" == "Y" ]]; then
        npm uninstall -g pnpm 2>/dev/null || true
        success_msg "已卸载pnpm"
    else
        # 只清理pnpm存储
        pnpm store prune 2>/dev/null || true
        success_msg "已清理pnpm存储"
    fi
fi

# 6. 清理可能的日志文件
info_msg "清理日志文件..."
rm -f ~/xiaozhi.log
rm -f ./xiaozhi.log
rm -f /tmp/xiaozhi*.log
success_msg "已清理日志文件"

# 7. 清理可能的配置文件备份
info_msg "清理配置文件备份..."
rm -f ~/xiaozhi.config.json.backup*
rm -f ./xiaozhi.config.json.backup*
success_msg "已清理配置文件备份"

echo ""
echo -e "${GREEN}🎉 清理完成！${NC}"
echo ""
echo -e "${BLUE}已清理的内容:${NC}"
echo "  ✅ 脚本文件"
echo "  ✅ 项目目录"
echo "  ✅ Docker资源（根据选择）"
echo "  ✅ npm缓存和包（根据选择）"
echo "  ✅ pnpm存储（根据选择）"
echo "  ✅ 日志文件"
echo "  ✅ 配置备份文件"
echo ""
echo -e "${YELLOW}注意: 如果需要重新部署，请重新运行部署脚本${NC}"
