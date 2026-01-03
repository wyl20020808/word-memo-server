@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo 📤 上传Dockerfile到GitHub
echo ==========================================
echo.

REM 检查当前目录
if not exist "package.json" (
    echo ❌ 错误：请在server目录下运行此脚本
    pause
    exit /b 1
)

REM 检查Git仓库
if not exist ".git" (
    echo ❌ 错误：当前目录不是Git仓库
    echo 请先运行 git init 初始化仓库
    pause
    exit /b 1
)

echo ✅ 开始上传文件到GitHub...
echo.

REM 添加所有文件
echo 📁 添加文件到Git...
git add .

REM 提交更改
echo 💾 提交更改...
git commit -m "Add Dockerfile and config files for WeChat Cloud"

REM 推送到GitHub
echo 📤 推送到GitHub...
git push origin main

if errorlevel 1 (
    echo.
    echo ❌ 推送失败，可能需要先设置远程仓库
    echo.
    echo 📋 请手动运行以下命令：
    echo git remote add origin https://github.com/你的用户名/word-memo-server.git
    echo git push -u origin main
    echo.
) else (
    echo.
    echo ✅ 上传成功！
    echo.
    echo 📋 现在GitHub仓库包含：
    echo - ✅ Dockerfile
    echo - ✅ package.json  
    echo - ✅ app.js
    echo - ✅ 所有配置文件
    echo.
    echo 🎉 现在可以在微信云托管重新部署了！
)

echo.
pause