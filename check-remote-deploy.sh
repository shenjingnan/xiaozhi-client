#!/bin/bash

# 远程部署认证功能修复脚本
# 用于确保部署的版本包含认证功能

echo "🔍 检查当前部署状态..."

# 检查Docker容器
if docker ps | grep -q xiaozhi-client; then
    echo "✅ 发现Docker容器正在运行"
    
    # 检查容器版本
    echo "📋 检查容器信息:"
    docker ps | grep xiaozhi-client
    
    # 检查容器中的认证API
    echo "🔍 测试认证API:"
    curl -s "http://localhost:9999/api/auth/status" || echo "❌ 认证API不可用"
    
    echo ""
    echo "🔧 解决方案："
    echo "1. 停止当前容器并使用源码部署"
    echo "2. 或者等待官方Docker镜像更新"
    echo ""
    echo "是否要切换到源码部署？(y/n)"
    read -r response
    
    if [[ "$response" == "y" || "$response" == "Y" ]]; then
        echo "🛑 停止Docker容器..."
        docker stop xiaozhi-client
        docker rm xiaozhi-client
        
        echo "🚀 开始源码部署..."
        # 运行源码部署
        ./quick-deploy.sh source
    fi
else
    echo "❌ 未发现Docker容器"
    
    # 检查是否有本地部署
    if command -v xiaozhi &> /dev/null; then
        echo "✅ 发现本地安装"
        xiaozhi --version
        
        # 检查认证API
        echo "🔍 测试认证API:"
        curl -s "http://localhost:9999/api/auth/status" || echo "❌ 认证API不可用"
    else
        echo "❌ 未发现任何xiaozhi-client安装"
    fi
fi

echo ""
echo "💡 建议操作："
echo "1. 使用源码部署确保获得最新功能: ./quick-deploy.sh source"
echo "2. 或手动从GitHub克隆最新代码"
