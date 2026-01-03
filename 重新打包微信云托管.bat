@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo 🔧 修复版微信云托管代码打包工具
echo ==========================================
echo.

REM 检查当前目录
if not exist "package.json" (
    echo ❌ 错误：请在server目录下运行此脚本
    pause
    exit /b 1
)

echo ✅ 开始重新打包微信云托管代码...
echo.

REM 删除旧的打包文件
if exist "word-memo-wechat-cloud.zip" del "word-memo-wechat-cloud.zip"
if exist "wechat-cloud-build" rmdir /s /q "wechat-cloud-build"

REM 创建临时目录
mkdir "wechat-cloud-build"

REM 复制必要文件
echo 📁 复制核心文件...
copy "package.json" "wechat-cloud-build\"
copy "app.js" "wechat-cloud-build\"
copy "Dockerfile" "wechat-cloud-build\"
copy ".dockerignore" "wechat-cloud-build\"

REM 复制目录
echo 📁 复制目录...
xcopy "config" "wechat-cloud-build\config\" /E /I /Q
xcopy "routes" "wechat-cloud-build\routes\" /E /I /Q
xcopy "middleware" "wechat-cloud-build\middleware\" /E /I /Q

REM 创建简化的package.json
echo 📝 优化package.json...
(
echo {
echo   "name": "word-memo-server",
echo   "version": "1.0.0",
echo   "main": "app.js",
echo   "scripts": {
echo     "start": "node app.js"
echo   },
echo   "dependencies": {
echo     "express": "^4.18.2",
echo     "mysql2": "^3.6.5",
echo     "cors": "^2.8.5",
echo     "dotenv": "^16.3.1",
echo     "bcryptjs": "^2.4.3",
echo     "jsonwebtoken": "^9.0.2"
echo   }
echo }
) > "wechat-cloud-build\package.json"

REM 打包为zip文件
echo 📦 创建优化的zip包...
powershell -command "Compress-Archive -Path 'wechat-cloud-build\*' -DestinationPath 'word-memo-wechat-cloud-fixed.zip' -Force"

REM 清理临时目录
rmdir /s /q "wechat-cloud-build"

echo.
echo ==========================================
echo 🎉 修复版打包完成！
echo ==========================================
echo.
echo 📦 文件名：word-memo-wechat-cloud-fixed.zip
echo 📁 位置：当前目录
echo 🔧 修复内容：
echo    - 优化了Dockerfile
echo    - 添加了.dockerignore
echo    - 简化了package.json
echo    - 使用国内npm镜像
echo.
echo 📋 现在可以：
echo 1. 重新上传这个zip文件到微信云托管
echo 2. 或者使用GitHub仓库部署（推荐）
echo.
pause