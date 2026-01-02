#!/bin/bash

echo "启动背单词服务器..."
echo

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "错误：未检测到Node.js，请先安装Node.js"
    echo "安装命令：curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖包..."
    npm install
    if [ $? -ne 0 ]; then
        echo "依赖安装失败，请检查网络连接"
        exit 1
    fi
fi

# 启动服务器
echo "正在启动服务器..."
echo "访问地址：http://localhost:3000"
echo "按 Ctrl+C 停止服务器"
echo
npm start