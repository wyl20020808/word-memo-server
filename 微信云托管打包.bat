@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo 📦 微信云托管代码打包工具
echo ==========================================
echo.

REM 检查当前目录
if not exist "package.json" (
    echo ❌ 错误：请在server目录下运行此脚本
    pause
    exit /b 1
)

echo ✅ 开始打包微信云托管代码...
echo.

REM 创建临时目录
if exist "wechat-cloud-build" rmdir /s /q "wechat-cloud-build"
mkdir "wechat-cloud-build"

REM 复制必要文件
echo 📁 复制文件...
copy "package.json" "wechat-cloud-build\"
copy "app.js" "wechat-cloud-build\"
copy "Dockerfile" "wechat-cloud-build\"
xcopy "config" "wechat-cloud-build\config\" /E /I /Q
xcopy "routes" "wechat-cloud-build\routes\" /E /I /Q
xcopy "middleware" "wechat-cloud-build\middleware\" /E /I /Q

REM 创建.dockerignore文件
(
echo node_modules
echo .env
echo *.log
echo .git
echo README.md
echo *.md
) > "wechat-cloud-build\.dockerignore"

REM 打包为zip文件
echo 📦 创建zip包...
powershell -command "Compress-Archive -Path 'wechat-cloud-build\*' -DestinationPath 'word-memo-wechat-cloud.zip' -Force"

REM 清理临时目录
rmdir /s /q "wechat-cloud-build"

echo.
echo ==========================================
echo 🎉 打包完成！
echo ==========================================
echo.
echo 📦 文件名：word-memo-wechat-cloud.zip
echo 📁 位置：当前目录
echo.
echo 📋 接下来请：
echo 1. 访问 https://cloud.weixin.qq.com/
echo 2. 创建环境和服务
echo 3. 上传 word-memo-wechat-cloud.zip
echo 4. 配置环境变量
echo 5. 部署服务
echo.
echo 💡 详细步骤请参考：微信云托管部署指南.md
echo ==========================================
echo.
pause