#!/bin/bash
# DocumentConverter 启动脚本

cd /home/cuihf/AIPlayGround/myWebServices/DocumentConverter

# 检查 node 是否在 PATH 中
if ! command -v node &>/dev/null; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

PORT=${PORT:-3003}

echo "启动 DocumentConverter (端口 $PORT)..."
node server.js 2>&1 | tee server.log
