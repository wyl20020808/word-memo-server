@echo off
echo 配置Windows防火墙允许3000端口...

REM 添加入站规则允许3000端口
netsh advfirewall firewall add rule name="Node.js Server Port 3000" dir=in action=allow protocol=TCP localport=3000

REM 添加出站规则允许3000端口
netsh advfirewall firewall add rule name="Node.js Server Port 3000 Out" dir=out action=allow protocol=TCP localport=3000

echo 防火墙配置完成！
echo 已允许3000端口的TCP连接
pause