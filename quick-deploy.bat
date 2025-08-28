@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

REM Xiaozhi Client Windows 一键部署脚本
REM 支持本地部署和Docker部署，自动安装依赖和配置

set "SCRIPT_VERSION=1.0.0"
set "PROJECT_NAME=xiaozhi-client"
set "DEFAULT_PORT=9999"
set "DEFAULT_ADMIN_USER=admin"
set "DEFAULT_ADMIN_PASS=xiaozhi123"

REM 默认值
set "DEPLOY_MODE=local"
set "WEB_PORT=%DEFAULT_PORT%"
set "ADMIN_USER=%DEFAULT_ADMIN_USER%"
set "ADMIN_PASS=%DEFAULT_ADMIN_PASS%"
set "AUTH_ENABLED=true"
set "ENDPOINT_URL="

REM 解析命令行参数
:parse_args
if "%~1"=="" goto start_deploy
if "%~1"=="--help" goto show_help
if "%~1"=="-h" goto show_help
if "%~1"=="local" (
    set "DEPLOY_MODE=local"
    shift
    goto parse_args
)
if "%~1"=="docker" (
    set "DEPLOY_MODE=docker"
    shift
    goto parse_args
)
if "%~1"=="source" (
    set "DEPLOY_MODE=source"
    shift
    goto parse_args
)
if "%~1"=="--port" (
    set "WEB_PORT=%~2"
    shift
    shift
    goto parse_args
)
if "%~1"=="--endpoint" (
    set "ENDPOINT_URL=%~2"
    shift
    shift
    goto parse_args
)
if "%~1"=="--admin-user" (
    set "ADMIN_USER=%~2"
    shift
    shift
    goto parse_args
)
if "%~1"=="--admin-pass" (
    set "ADMIN_PASS=%~2"
    shift
    shift
    goto parse_args
)
if "%~1"=="--no-auth" (
    set "AUTH_ENABLED=false"
    shift
    goto parse_args
)
echo 错误: 未知选项 %~1
exit /b 1

:show_help
echo.
echo ================================================================
echo           Xiaozhi Client Windows 一键部署脚本 v%SCRIPT_VERSION%
echo ================================================================
echo.
echo 使用方法:
echo   %~nx0 [模式] [选项]
echo.
echo 部署模式:
echo   local         本地部署 (默认)
echo   docker        Docker容器部署
echo   source        从源码构建部署
echo.
echo 选项:
echo   --port        Web UI端口 (默认: 9999)
echo   --endpoint    小智接入点地址
echo   --admin-user  管理员用户名 (默认: admin)
echo   --admin-pass  管理员密码 (默认: xiaozhi123)
echo   --no-auth     禁用认证
echo   --help        显示此帮助信息
echo.
echo 使用示例:
echo   %~nx0                                           # 本地部署
echo   %~nx0 docker                                    # Docker部署
echo   %~nx0 local --port 8080 --endpoint "ws://..."  # 自定义配置
echo   %~nx0 docker --no-auth                         # Docker部署且禁用认证
echo.
echo 注意: 首次运行前请确保已从 xiaozhi.me 获取接入点地址
echo.
pause
exit /b 0

:start_deploy
echo.
echo ================================================================
echo           Xiaozhi Client Windows 一键部署脚本 v%SCRIPT_VERSION%
echo ================================================================
echo.

REM 根据模式执行部署
if "%DEPLOY_MODE%"=="local" goto deploy_local
if "%DEPLOY_MODE%"=="docker" goto deploy_docker
if "%DEPLOY_MODE%"=="source" goto deploy_source

echo 错误: 未知部署模式 %DEPLOY_MODE%
exit /b 1

:deploy_local
echo ✅ 开始本地部署...
echo.

REM 检查 Node.js
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Node.js 未安装，请从 https://nodejs.org/ 下载并安装
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%v in ('node --version 2^>nul') do set "NODE_VERSION=%%v"
echo ✅ Node.js 已安装 (版本: v%NODE_VERSION%)

REM 检查 pnpm
where pnpm >nul 2>&1
if !errorlevel! neq 0 (
    echo ℹ️  正在安装 pnpm...
    npm config set registry https://registry.npmmirror.com
    npm install -g pnpm
    if !errorlevel! neq 0 (
        echo ❌ pnpm 安装失败
        pause
        exit /b 1
    )
    pnpm config set registry https://registry.npmmirror.com
)
echo ✅ pnpm 已安装

REM 创建工作目录
set "WORK_DIR=%USERPROFILE%\%PROJECT_NAME%"
echo ℹ️  创建工作目录: %WORK_DIR%
if not exist "%WORK_DIR%" mkdir "%WORK_DIR%"

REM 全局安装xiaozhi-client
echo ℹ️  安装 xiaozhi-client...
npm install -g xiaozhi-client
if !errorlevel! neq 0 (
    echo ❌ xiaozhi-client 安装失败
    pause
    exit /b 1
)

REM 切换到工作目录
cd /d "%WORK_DIR%"

REM 初始化配置
if not exist "xiaozhi.config.json" (
    echo ℹ️  初始化配置文件...
    xiaozhi config init
    if !errorlevel! neq 0 (
        echo ❌ 配置初始化失败
        pause
        exit /b 1
    )
) else (
    echo ✅ 配置文件已存在
)

REM 生成配置文件
call :generate_config "%WORK_DIR%\xiaozhi.config.json"

echo.
echo 🎉 本地部署成功！
echo.
echo 使用说明:
echo 1. 配置文件位置: %WORK_DIR%\xiaozhi.config.json
echo 2. 编辑配置文件，设置你的小智接入点地址
echo 3. 启动服务: cd /d "%WORK_DIR%" && xiaozhi start
echo.
echo Web管理界面: http://localhost:%WEB_PORT%
if "%AUTH_ENABLED%"=="true" (
    echo 管理员账号: %ADMIN_USER%
    echo 管理员密码: %ADMIN_PASS%
)
echo.
echo 常用命令:
echo   xiaozhi start -d        # 后台运行
echo   xiaozhi status          # 查看状态
echo   xiaozhi stop            # 停止服务
echo   xiaozhi ui              # 启动Web界面
echo.
pause
exit /b 0

:deploy_docker
echo ✅ 开始Docker部署...
echo.

REM 检查 Docker
where docker >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Docker 未安装，请从 https://docs.docker.com/desktop/windows/install/ 下载并安装 Docker Desktop
    pause
    exit /b 1
)
echo ✅ Docker 已安装

REM 创建工作目录
set "WORK_DIR=%USERPROFILE%\%PROJECT_NAME%"
echo ℹ️  创建工作目录: %WORK_DIR%
if not exist "%WORK_DIR%" mkdir "%WORK_DIR%"

REM 生成配置文件
call :generate_config "%WORK_DIR%\xiaozhi.config.json"

REM 停止并删除已存在的容器
docker ps -a --filter "name=%PROJECT_NAME%" --format "{{.Names}}" | findstr /x "%PROJECT_NAME%" >nul 2>&1
if !errorlevel! equ 0 (
    echo ℹ️  停止并删除已存在的容器...
    docker stop %PROJECT_NAME% >nul 2>&1
    docker rm %PROJECT_NAME% >nul 2>&1
)

REM 拉取并运行容器
echo ℹ️  拉取Docker镜像...
docker pull shenjingnan/%PROJECT_NAME%:latest
if !errorlevel! neq 0 (
    echo ❌ Docker镜像拉取失败
    pause
    exit /b 1
)

echo ℹ️  启动Docker容器...
docker run -d --name %PROJECT_NAME% -p %WEB_PORT%:9999 -p 3000:3000 -v "%WORK_DIR%:/workspaces" --restart unless-stopped shenjingnan/%PROJECT_NAME%:latest
if !errorlevel! neq 0 (
    echo ❌ Docker容器启动失败
    pause
    exit /b 1
)

echo ℹ️  等待容器启动...
timeout /t 5 /nobreak >nul

echo.
echo 🎉 Docker部署成功！
echo.
echo Web管理界面: http://localhost:%WEB_PORT%
if "%AUTH_ENABLED%"=="true" (
    echo 管理员账号: %ADMIN_USER%
    echo 管理员密码: %ADMIN_PASS%
)
echo.
echo Docker常用命令:
echo   docker logs -f %PROJECT_NAME%     # 查看日志
echo   docker restart %PROJECT_NAME%     # 重启容器
echo   docker stop %PROJECT_NAME%        # 停止容器
echo   docker start %PROJECT_NAME%       # 启动容器
echo.
echo 配置文件: %WORK_DIR%\xiaozhi.config.json
echo 修改配置后请重启容器使其生效
echo.
pause
exit /b 0

:deploy_source
echo ✅ 开始从源码部署...
echo.

REM 检查依赖
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Node.js 未安装，请从 https://nodejs.org/ 下载并安装
    pause
    exit /b 1
)

where git >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Git 未安装，请先安装 Git
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if !errorlevel! neq 0 (
    echo ℹ️  正在安装 pnpm...
    npm config set registry https://registry.npmmirror.com
    npm install -g pnpm
    pnpm config set registry https://registry.npmmirror.com
)

set "WORK_DIR=%USERPROFILE%\%PROJECT_NAME%-source"

REM 克隆或更新仓库
if not exist "%WORK_DIR%" (
    echo ℹ️  克隆项目仓库...
    git clone https://github.com/cfy114514/xiaozhi-client.git "%WORK_DIR%"
    if !errorlevel! neq 0 (
        echo ❌ 项目克隆失败
        pause
        exit /b 1
    )
) else (
    echo ℹ️  更新项目仓库...
    cd /d "%WORK_DIR%"
    git pull
)

cd /d "%WORK_DIR%"

REM 安装依赖
echo ℹ️  安装项目依赖...
pnpm install
if !errorlevel! neq 0 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1
)

REM 构建项目
echo ℹ️  构建项目...
pnpm build
if !errorlevel! neq 0 (
    echo ❌ 项目构建失败
    pause
    exit /b 1
)

REM 生成配置
call :generate_config "%WORK_DIR%\xiaozhi.config.json"

echo.
echo 🎉 源码部署成功！
echo.
echo 项目目录: %WORK_DIR%
echo 配置文件: %WORK_DIR%\xiaozhi.config.json
echo 启动服务: cd /d "%WORK_DIR%" && node dist\cli.js start
echo.
echo Web管理界面: http://localhost:%WEB_PORT%
if "%AUTH_ENABLED%"=="true" (
    echo 管理员账号: %ADMIN_USER%
    echo 管理员密码: %ADMIN_PASS%
)
echo.
pause
exit /b 0

:generate_config
set "CONFIG_FILE=%~1"
echo ℹ️  生成配置文件: %CONFIG_FILE%

REM 创建配置文件
(
echo {
echo   "mcpEndpoint": "%ENDPOINT_URL%",
echo   "mcpServers": {
echo     "calculator": {
echo       "command": "node",
echo       "args": ["./mcpServers/calculator.js"]
echo     },
echo     "datetime": {
echo       "command": "node",
echo       "args": ["./mcpServers/datetime.js"]
echo     }
echo   },
echo   "modelscope": {
echo     "apiKey": "<你的API密钥>"
echo   },
echo   "connection": {
echo     "heartbeatInterval": 30000,
echo     "heartbeatTimeout": 10000,
echo     "reconnectInterval": 5000
echo   },
echo   "webUI": {
echo     "port": %WEB_PORT%,
echo     "auth": {
echo       "enabled": %AUTH_ENABLED%,
echo       "admin": {
echo         "username": "%ADMIN_USER%",
echo         "password": "%ADMIN_PASS%"
echo       },
echo       "jwtSecret": "your-super-secret-jwt-key-change-this-in-production",
echo       "sessionTimeout": 86400
echo     }
echo   }
echo }
) > "%CONFIG_FILE%"

if "%ENDPOINT_URL%"=="" (
    echo ⚠️  请编辑配置文件设置小智接入点地址
)

echo ✅ 配置文件已生成
goto :eof
