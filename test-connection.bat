@echo off
echo 测试服务器连接...
echo.

echo 1. 测试本地连接...
curl -s http://localhost:3000/health
if errorlevel 1 (
    echo ❌ 本地连接失败，请检查服务器是否启动
) else (
    echo ✅ 本地连接正常
)

echo.
echo 2. 测试外网连接...
curl -s http://183.220.117.142:3000/health
if errorlevel 1 (
    echo ❌ 外网连接失败，请检查：
    echo    - 路由器端口转发是否配置
    echo    - 防火墙是否允许3000端口
    echo    - 网络运营商是否封禁端口
) else (
    echo ✅ 外网连接正常
)

echo.
echo 3. 检查端口占用...
netstat -an | findstr :3000
if errorlevel 1 (
    echo ❌ 3000端口未被占用，服务器可能未启动
) else (
    echo ✅ 3000端口正在监听
)

pause