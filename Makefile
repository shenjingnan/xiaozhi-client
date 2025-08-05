# Xiaozhi Client Docker Makefile
# 简化 Docker 操作的 Makefile

.PHONY: help build build-dev build-prod start start-dev stop restart logs status shell clean

# 默认目标
.DEFAULT_GOAL := help

# 颜色定义
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m

# 项目信息
PROJECT_NAME := xiaozhi-client
COMPOSE_FILE := docker-compose.yml
COMPOSE_DEV_FILE := docker-compose.dev.yml

help: ## 显示帮助信息
	@echo "$(BLUE)Xiaozhi Client Docker 管理命令$(NC)"
	@echo ""
	@echo "$(GREEN)构建命令:$(NC)"
	@echo "  make build      - 构建生产环境镜像"
	@echo "  make build-dev  - 构建开发环境镜像"
	@echo "  make build-all  - 构建所有环境镜像"
	@echo ""
	@echo "$(GREEN)运行命令:$(NC)"
	@echo "  make start      - 启动生产环境服务"
	@echo "  make start-dev  - 启动开发环境服务"
	@echo "  make stop       - 停止生产环境服务"
	@echo "  make stop-dev   - 停止开发环境服务"
	@echo "  make restart    - 重启生产环境服务"
	@echo "  make restart-dev- 重启开发环境服务"
	@echo ""
	@echo "$(GREEN)监控命令:$(NC)"
	@echo "  make logs       - 查看生产环境日志"
	@echo "  make logs-dev   - 查看开发环境日志"
	@echo "  make status     - 查看生产环境状态"
	@echo "  make status-dev - 查看开发环境状态"
	@echo "  make shell      - 进入生产环境容器"
	@echo "  make shell-dev  - 进入开发环境容器"
	@echo ""
	@echo "$(GREEN)维护命令:$(NC)"
	@echo "  make clean      - 清理未使用的镜像和容器"
	@echo "  make clean-all  - 清理所有相关镜像和容器"
	@echo "  make update     - 更新并重新部署"
	@echo ""
	@echo "$(GREEN)发布命令:$(NC)"
	@echo "  make publish DOCKER_USER=username     - 发布到 Docker Hub"
	@echo "  make publish DOCKER_USER=username VERSION=v1.0.0  - 发布指定版本"

# 构建命令
build: ## 构建生产环境镜像
	@echo "$(BLUE)构建生产环境镜像...$(NC)"
	@docker build --target production -t $(PROJECT_NAME):latest .
	@echo "$(GREEN)生产环境镜像构建完成$(NC)"

build-dev: ## 构建开发环境镜像
	@echo "$(BLUE)构建开发环境镜像...$(NC)"
	@docker build --target dev -t $(PROJECT_NAME):dev .
	@echo "$(GREEN)开发环境镜像构建完成$(NC)"

build-all: build build-dev ## 构建所有环境镜像

# 运行命令
start: ## 启动生产环境服务
	@echo "$(BLUE)启动生产环境服务...$(NC)"
	@mkdir -p logs workspace mcpServers
	@if [ ! -f "xiaozhi.config.json" ]; then \
		echo "$(YELLOW)创建配置文件模板...$(NC)"; \
		cp xiaozhi.config.example.json xiaozhi.config.json; \
		echo "$(RED)请编辑 xiaozhi.config.json 文件，填入你的接入点地址$(NC)"; \
		echo "$(YELLOW)获取接入点地址：https://xiaozhi.me$(NC)"; \
	fi
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)生产环境服务已启动$(NC)"
	@echo "$(YELLOW)Web 界面: http://localhost:9999$(NC)"

start-dev: ## 启动开发环境服务
	@echo "$(BLUE)启动开发环境服务...$(NC)"
	@mkdir -p logs workspace mcpServers
	@if [ ! -f "xiaozhi.config.json" ]; then \
		echo "$(YELLOW)创建配置文件模板...$(NC)"; \
		cp xiaozhi.config.example.json xiaozhi.config.json; \
		echo "$(RED)请编辑 xiaozhi.config.json 文件，填入你的接入点地址$(NC)"; \
		echo "$(YELLOW)获取接入点地址：https://xiaozhi.me$(NC)"; \
	fi
	@docker-compose -f $(COMPOSE_DEV_FILE) up -d
	@echo "$(GREEN)开发环境服务已启动$(NC)"
	@echo "$(YELLOW)Web 界面: http://localhost:9999$(NC)"

stop: ## 停止生产环境服务
	@echo "$(BLUE)停止生产环境服务...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)生产环境服务已停止$(NC)"

stop-dev: ## 停止开发环境服务
	@echo "$(BLUE)停止开发环境服务...$(NC)"
	@docker-compose -f $(COMPOSE_DEV_FILE) down
	@echo "$(GREEN)开发环境服务已停止$(NC)"

restart: stop start ## 重启生产环境服务

restart-dev: stop-dev start-dev ## 重启开发环境服务

# 监控命令
logs: ## 查看生产环境日志
	@docker-compose -f $(COMPOSE_FILE) logs -f --tail=100

logs-dev: ## 查看开发环境日志
	@docker-compose -f $(COMPOSE_DEV_FILE) logs -f --tail=100

status: ## 查看生产环境状态
	@echo "$(BLUE)生产环境服务状态:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) ps
	@echo ""
	@echo "$(BLUE)资源使用情况:$(NC)"
	@docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep $(PROJECT_NAME) || echo "未找到运行中的容器"

status-dev: ## 查看开发环境状态
	@echo "$(BLUE)开发环境服务状态:$(NC)"
	@docker-compose -f $(COMPOSE_DEV_FILE) ps
	@echo ""
	@echo "$(BLUE)资源使用情况:$(NC)"
	@docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep $(PROJECT_NAME) || echo "未找到运行中的容器"

shell: ## 进入生产环境容器
	@docker-compose -f $(COMPOSE_FILE) exec $(PROJECT_NAME) sh

shell-dev: ## 进入开发环境容器
	@docker-compose -f $(COMPOSE_DEV_FILE) exec $(PROJECT_NAME)-dev sh

# 维护命令
clean: ## 清理未使用的镜像和容器
	@echo "$(BLUE)清理未使用的镜像和容器...$(NC)"
	@docker system prune -f
	@docker image prune -f
	@echo "$(GREEN)清理完成$(NC)"

clean-all: ## 清理所有相关镜像和容器
	@echo "$(BLUE)清理所有相关镜像和容器...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down --rmi all --volumes --remove-orphans 2>/dev/null || true
	@docker-compose -f $(COMPOSE_DEV_FILE) down --rmi all --volumes --remove-orphans 2>/dev/null || true
	@docker rmi $(PROJECT_NAME):latest $(PROJECT_NAME):dev 2>/dev/null || true
	@docker system prune -f
	@echo "$(GREEN)清理完成$(NC)"

update: ## 更新并重新部署
	@echo "$(BLUE)更新并重新部署...$(NC)"
	@git pull
	@make stop
	@make build
	@make start
	@echo "$(GREEN)更新部署完成$(NC)"

# 发布命令
publish: ## 发布到 Docker Hub (需要设置 DOCKER_USER 变量)
	@if [ -z "$(DOCKER_USER)" ]; then \
		echo "$(RED)错误: 请设置 DOCKER_USER 变量$(NC)"; \
		echo "$(YELLOW)用法: make publish DOCKER_USER=your-username$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)发布到 Docker Hub...$(NC)"
	@./scripts/docker-publish.sh $(DOCKER_USER) $(VERSION)

# 快捷命令
up: start ## 启动生产环境服务 (start 的别名)
down: stop ## 停止生产环境服务 (stop 的别名)
ps: status ## 查看生产环境状态 (status 的别名)
