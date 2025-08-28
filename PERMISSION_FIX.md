# Xiaozhi Client 脚本权限修复指南

## 问题
在Linux/Unix系统中运行一键部署脚本时遇到权限错误：
```bash
-bash: ./quick-deploy.sh: Permission denied
```

## 解决方案

### 方法一：添加执行权限（推荐）
```bash
# 为脚本添加执行权限
chmod +x quick-deploy.sh

# 然后运行脚本
./quick-deploy.sh
```

### 方法二：使用bash直接执行
```bash
# 不需要执行权限，直接用bash运行
bash quick-deploy.sh
```

### 方法三：通过curl直接运行（如果文件在GitHub上）
```bash
# 直接从GitHub下载并运行
curl -fsSL https://raw.githubusercontent.com/cfy114514/xiaozhi-client/main/quick-deploy.sh | bash
```

## 验证权限
检查文件权限：
```bash
ls -la quick-deploy.sh
```

应该看到类似的输出：
```
-rwxr-xr-x 1 user user 12345 Aug 28 10:00 quick-deploy.sh
```
其中 `x` 表示有执行权限。

## 常用参数示例

### 本地部署
```bash
./quick-deploy.sh
# 或
./quick-deploy.sh local
```

### Docker部署
```bash
./quick-deploy.sh docker
```

### 自定义配置
```bash
# 指定端口和接入点
./quick-deploy.sh local --port 8080 --endpoint "wss://api.xiaozhi.me/mcp/your-endpoint"

# 禁用认证
./quick-deploy.sh docker --no-auth

# 自定义管理员账号
./quick-deploy.sh --admin-user myuser --admin-pass mypassword
```

### 查看帮助
```bash
./quick-deploy.sh --help
```

## 如果仍有问题

1. **检查系统**：确认是Linux/Unix系统
2. **检查用户权限**：确保有文件修改权限
3. **检查文件完整性**：重新下载脚本文件
4. **使用sudo**（如需要）：`sudo chmod +x quick-deploy.sh`

## 快速修复命令

如果你在服务器上已经有了文件，直接执行：
```bash
chmod +x quick-deploy.sh && ./quick-deploy.sh
```
