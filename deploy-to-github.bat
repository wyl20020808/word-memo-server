@echo off
echo 🚀 准备部署到Railway...
echo.

REM 检查是否在server目录
if not exist "package.json" (
    echo ❌ 请在server目录下运行此脚本
    pause
    exit /b 1
)

REM 初始化Git仓库
if not exist ".git" (
    echo 📝 初始化Git仓库...
    git init
    git branch -M main
)

REM 创建.gitignore文件
echo node_modules/ > .gitignore
echo .env >> .gitignore
echo *.log >> .gitignore

REM 添加所有文件
echo 📦 添加文件到Git...
git add .

REM 提交代码
echo 💾 提交代码...
git commit -m "Initial commit for Railway deployment"

echo.
echo ✅ 代码准备完成！
echo.
echo 📋 接下来请按以下步骤操作：
echo.
echo 1. 访问 https://github.com/new 创建新仓库
echo 2. 仓库名建议：word-memo-server
echo 3. 设为公开仓库（Public）
echo 4. 不要添加README、.gitignore或LICENSE
echo 5. 创建后复制仓库URL
echo.
echo 6. 然后运行以下命令（替换为你的仓库URL）：
echo    git remote add origin https://github.com/你的用户名/word-memo-server.git
echo    git push -u origin main
echo.
pause