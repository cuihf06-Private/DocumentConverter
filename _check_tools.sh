#!/bin/bash
# 检查 DocumentConverter 所需的系统工具

cd /home/cuihf/AIPlayGround/myWebServices/DocumentConverter

echo "=== DocumentConverter 环境检查 ==="

OK=true

# Node.js
if command -v node &>/dev/null; then
    echo "✓ Node.js $(node --version)"
else
    echo "✗ Node.js 未安装"
    OK=false
fi

# Python3
if command -v python3 &>/dev/null; then
    echo "✓ Python3 $(python3 --version 2>&1 | awk '{print $2}')"
else
    echo "✗ Python3 未安装"
    OK=false
fi

# Pandoc
if command -v pandoc &>/dev/null; then
    echo "✓ Pandoc $(pandoc --version | head -1 | awk '{print $2}')"
else
    echo "⚠ Pandoc 未安装（DOCX 功能不可用）"
fi

# Python 依赖
echo ""
echo "--- Python 依赖 ---"
for pkg in markdown weasyprint Pygments fonttools; do
    if python3 -c "import $pkg" 2>/dev/null; then
        echo "✓ $pkg"
    else
        echo "✗ $pkg 未安装"
        OK=false
    fi
done

# 字体文件
echo ""
echo "--- 字体文件 ---"
for f in fonts/notosans-sc.ttf fonts/notosans-sc-bold.otf; do
    if [ -f "$f" ]; then
        size=$(du -h "$f" | cut -f1)
        echo "✓ $f ($size)"
    else
        echo "✗ $f 缺失"
        OK=false
    fi
done

echo ""
if $OK; then
    echo "环境检查通过 ✓"
else
    echo "部分依赖缺失，请安装后重试"
    exit 1
fi
