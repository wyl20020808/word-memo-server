@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo 🚀 背单词服务器一键部署到Railway
echo ==========================================
echo.

REM 检查当前目录
if not exist "package.json" (
    echo ❌ 错误：请在server目录下运行此脚本
    echo 📁 当前目录应包含package.json文件
    pause
    exit /b 1
)

REM 检查Git是否安装
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：未检测到Git，请先安装Git
    echo 📥 下载地址：https://git-scm.com/download/win
    pause
    exit /b 1
)

echo ✅ 环境检查通过
echo.

REM 步骤1：初始化Git仓库
echo 📝 步骤1：初始化Git仓库...
if not exist ".git" (
    git init
    git branch -M main
    echo ✅ Git仓库初始化完成
) else (
    echo ℹ️  Git仓库已存在
)

REM 步骤2：创建.gitignore
echo 📝 步骤2：创建.gitignore文件...
(
echo node_modules/
echo .env
echo *.log
echo .DS_Store
echo Thumbs.db
) > .gitignore
echo ✅ .gitignore文件创建完成

REM 步骤3：添加文件到Git
echo 📝 步骤3：添加文件到Git...
git add .
git commit -m "Initial commit for Railway deployment" >nul 2>&1
echo ✅ 代码提交完成

echo.
echo ==========================================
echo 📋 接下来请按以下步骤操作：
echo ==========================================
echo.
echo 🌐 1. 创建GitHub仓库：
echo    访问：https://github.com/new
echo    仓库名：word-memo-server
echo    设为公开仓库（Public）
echo    不要添加任何初始化文件
echo.
echo 📤 2. 上传代码到GitHub：
echo    创建仓库后，复制并运行GitHub给出的命令，类似：
echo    git remote add origin https://github.com/你的用户名/word-memo-server.git
echo    git push -u origin main
echo.
echo 🚀 3. 部署到Railway：
echo    访问：https://railway.app/
echo    用GitHub账号登录
echo    点击"New Project" → "Deploy from GitHub repo"
echo    选择word-memo-server仓库
echo    等待部署完成（约2-3分钟）
echo.
echo ⚙️  4. 配置环境变量：
echo    在Railway项目面板点击"Variables"
echo    添加：NODE_ENV=production
echo    添加：JWT_SECRET=your_random_secret_key
echo.
echo 🔗 5. 获取域名：
echo    部署完成后复制Railway提供的域名
echo    类似：https://xxx.up.railway.app
echo.
echo 📱 6. 修改小程序API地址：
echo    在utils/api.js中更新railway域名
echo.
echo ==========================================
echo 💡 提示：
echo - 整个过程大约5-10分钟
echo - Railway免费提供500小时/月
echo - 获得自动HTTPS域名
echo - 无需购买任何服务
echo ==========================================
echo.
pause