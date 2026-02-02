#!/usr/bin/env bash

###############################################################################
# 自动创建 Pull Request 脚本
#
# 功能：
# - 检测当前分支与主分支的差异
# - 判断是否应该创建 PR
# - 使用 gh cli 创建 Pull Request
#
# 使用方式：
#   ./scripts/create-pr.sh
#
# 环境变量：
#   GITHUB_TOKEN - GitHub token (必需，由 GitHub Actions 自动提供)
###############################################################################

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 gh cli 是否安装
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        log_error "gh cli 未安装"
        log_info "请访问 https://cli.github.com/ 安装 GitHub CLI"
        exit 1
    fi
}

# 检查是否已登录 GitHub
check_github_auth() {
    if ! gh auth status &> /dev/null; then
        log_error "未登录 GitHub"
        log_info "请运行: gh auth login"
        exit 1
    fi
}

# 获取当前分支名称
get_current_branch() {
    git branch --show-current
}

# 获取默认分支名称
get_default_branch() {
    git remote show origin | grep 'HEAD branch' | awk '{print $NF}'
}

# 检查是否需要创建 PR
should_create_pr() {
    local current_branch="$1"
    local default_branch="$2"

    # 检查是否在默认分支上
    if [[ "$current_branch" == "$default_branch" ]]; then
        log_warn "当前在默认分支 ($default_branch) 上，不需要创建 PR"
        return 1
    fi

    # 检查是否已存在 PR
    if gh pr list --head "$current_branch" --json number --jq '. | length' | grep -q "^[1-9]"; then
        log_warn "分支 $current_branch 已存在 PR"
        gh pr list --head "$current_branch" --json number,title,url --jq '.[] | "  - #\(.number): \(.title) (\(.url))"'
        return 1
    fi

    # 检查是否有未推送的提交
    if [[ -n "$(git log origin/$current_branch..HEAD 2>/dev/null || git log @{u}..HEAD 2>/dev/null || true)" ]]; then
        log_info "发现未推送的提交"
        return 0
    fi

    # 检查是否有与主分支的差异
    if [[ -n "$(git diff $default_branch...HEAD --name-only)" ]]; then
        log_info "发现与主分支的差异"
        return 0
    fi

    log_warn "没有发现需要创建 PR 的改动"
    return 1
}

# 推送当前分支到远程
push_branch() {
    local branch="$1"

    log_info "推送分支 $branch 到远程..."

    # 尝试推送分支，设置上游跟踪
    if git push -u origin "$branch" 2>/dev/null; then
        log_success "分支推送成功"
    else
        # 如果上游已存在，直接推送
        if git push origin "$branch" 2>/dev/null; then
            log_success "分支推送成功"
        else
            log_error "分支推送失败"
            return 1
        fi
    fi
}

# 生成 PR 标题
generate_pr_title() {
    local default_branch="$1"

    # 获取最近的 commit 信息
    local commit_msg
    commit_msg=$(git log $default_branch..HEAD --format=%s -1 2>/dev/null || git log -1 --format=%s)

    # 清理 commit message，移除 Co-authored-by 等信息
    commit_msg=$(echo "$commit_msg" | sed 's/Co-authored-by:.*//g' | sed 's/Co-Authored-By:.*//g' | tr -d '\n' | xargs)

    if [[ -z "$commit_msg" ]]; then
        echo "feat: 新功能"
    else
        echo "$commit_msg"
    fi
}

# 生成 PR 描述
generate_pr_body() {
    local default_branch="$1"
    local current_branch="$2"

    cat <<EOF
## 改动说明

### 为什么改
$(git log $default_branch..HEAD --format=%s -1 2>/dev/null || echo "请描述改动动机")

### 改了什么
$(git diff $default_branch...HEAD --stat | tail -1)

### 影响范围
$(git diff $default_branch...HEAD --name-only | head -10 | sed 's/^/- /' | tr '\n' '\n' | xargs -I {} echo "{}")

### 验证方式
- [ ] 代码变更已实现
- [ ] 相关测试已通过
- [ ] 代码检查已通过 (\`pnpm check:all\`)

---

Generated with [Claude Code](https://claude.ai/code)
EOF
}

# 创建 PR
create_pr() {
    local default_branch="$1"
    local current_branch="$2"

    log_info "生成 PR 信息..."

    local title
    title=$(generate_pr_title "$default_branch")

    local body
    body=$(generate_pr_body "$default_branch" "$current_branch")

    log_info "创建 PR: $title"
    log_info "目标分支: $default_branch"

    # 使用 gh cli 创建 PR
    local pr_output
    if pr_output=$(gh pr create \
        --base "$default_branch" \
        --head "$current_branch" \
        --title "$title" \
        --body "$body" \
        2>&1); then
        log_success "PR 创建成功!"

        # 提取 PR URL
        local pr_url
        pr_url=$(echo "$pr_output" | grep -oE 'https://github.com/[^ ]+' | head -1)

        echo ""
        echo "==================================="
        echo "  PR URL: $pr_url"
        echo "==================================="

        # 设置 GitHub Actions 输出（如果在 CI 环境中）
        if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
            echo "pr_url=$pr_url" >> "$GITHUB_OUTPUT"
            echo "pr_number=$(echo "$pr_url" | grep -oE '[0-9]+' | tail -1)" >> "$GITHUB_OUTPUT"
        fi

        return 0
    else
        log_error "PR 创建失败: $pr_output"
        return 1
    fi
}

# 主函数
main() {
    echo "==================================="
    echo "   自动创建 Pull Request 工具"
    echo "==================================="
    echo ""

    # 检查环境
    check_gh_cli
    check_github_auth

    # 获取分支信息
    current_branch=$(get_current_branch)
    default_branch=$(get_default_branch)

    log_info "当前分支: $current_branch"
    log_info "默认分支: $default_branch"

    # 检查是否需要创建 PR
    if ! should_create_pr "$current_branch" "$default_branch"; then
        log_info "不需要创建 PR，退出"
        exit 0
    fi

    # 推送分支
    if ! push_branch "$current_branch"; then
        log_error "无法推送分支，PR 创建中止"
        exit 1
    fi

    # 创建 PR
    if create_pr "$default_branch" "$current_branch"; then
        log_success "所有步骤完成!"
        exit 0
    else
        log_error "PR 创建失败"
        exit 1
    fi
}

# 执行主函数
main "$@"
