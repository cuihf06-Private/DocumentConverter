#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DocumentConverter 转换脚本
输入：Markdown 文件
输出：DOCX (Pandoc) + PDF (WeasyPrint)

通信协议：
- stdout: 输出一行 JSON {"docx": "...", "pdf": "..."}
- stderr: 日志/警告
- exit 0: 成功；非 0: 失败
"""
import argparse
import json
import os
import sys
import subprocess
from pathlib import Path

# 抑制 weasyprint 启动时的某些 stderr 噪声（保留 ERROR 级）
import logging
logging.getLogger('weasyprint').setLevel(logging.ERROR)


def log(msg: str) -> None:
    """输出日志到 stderr，不影响 stdout 上的 JSON 协议"""
    print(f"[convert.py] {msg}", file=sys.stderr, flush=True)


def md_to_html(md_text: str) -> str:
    """将 Markdown 转换为 HTML（启用 GFM 扩展）"""
    import markdown
    md = markdown.Markdown(
        extensions=[
            'extra',       # 包含 tables, fenced_code, footnotes 等
            'codehilite',  # 代码高亮（需要 Pygments）
            'toc',         # 目录锚点
            'sane_lists',  # 更好的列表处理
            'smarty',      # 智能引号
        ],
        extension_configs={
            'codehilite': {'css_class': 'codehilite', 'guess_lang': False}
        },
        output_format='html5'
    )
    return md.convert(md_text)


def build_html_doc(body_html: str, title: str, css_text: str, fonts_dir: Path) -> str:
    """构造完整 HTML 文档（含 @font-face 嵌入本地中文字体 + 排版 CSS）"""
    # 使用绝对 file:// URI 嵌入字体，这样无论 base_url 是什么都能正确加载
    reg = fonts_dir / 'notosans-sc.ttf'
    bold = fonts_dir / 'notosans-sc-bold.otf'

    font_face = ""
    if reg.exists():
        reg_uri = reg.resolve().as_uri()
        font_face += f"""
@font-face {{
    font-family: 'Noto Sans SC';
    font-weight: 400;
    font-style: normal;
    src: url('{reg_uri}');
}}"""
    if bold.exists():
        bold_uri = bold.resolve().as_uri()
        font_face += f"""
@font-face {{
    font-family: 'Noto Sans SC';
    font-weight: 700;
    font-style: normal;
    src: url('{bold_uri}');
}}"""

    title_escaped = title.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>{title_escaped}</title>
<style>
{font_face}
{css_text}
</style>
</head>
<body>
{body_html}
</body>
</html>"""


def generate_pdf(html_str: str, out_path: Path, base_url: Path) -> None:
    """用 WeasyPrint 将 HTML 渲染为 PDF"""
    from weasyprint import HTML, CSS
    log(f"渲染 PDF → {out_path}")
    html_obj = HTML(string=html_str, base_url=str(base_url))
    html_obj.write_pdf(target=str(out_path))


def generate_docx(md_path: Path, out_path: Path, base_dir: Path | None = None) -> bool:
    """用 Pandoc 将 Markdown 转换为 DOCX。若 pandoc 不可用则返回 False。"""
    pandoc = _which('pandoc')
    if not pandoc:
        log("Pandoc 未安装，跳过 DOCX 生成")
        return False

    log(f"渲染 DOCX → {out_path}")
    cmd = [
        pandoc,
        str(md_path),
        '-f', 'markdown+yaml_metadata_block',
        '-t', 'docx',
        '-o', str(out_path),
        '--standalone',
        # 让 Pandoc 识别中文，需要 wrap 选项；preset 让标题样式更接近 Word 默认
        '--wrap', 'preserve',
    ]
    # 指定资源路径，使 Pandoc 在工作目录中查找图片并嵌入 DOCX
    if base_dir:
        cmd.extend(['--resource-path', str(base_dir)])
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=120)
        return True
    except subprocess.CalledProcessError as e:
        log(f"Pandoc 失败: {e.stderr.strip()}")
        return False
    except subprocess.TimeoutExpired:
        log("Pandoc 超时")
        return False


def _which(cmd: str) -> str | None:
    """查找系统命令路径"""
    from shutil import which
    return which(cmd)


def main() -> int:
    parser = argparse.ArgumentParser(description='Markdown → DOCX + PDF')
    parser.add_argument('--input', required=True, help='输入 Markdown 文件路径')
    parser.add_argument('--name', required=True, help='输出文件基础名（不含扩展名）')
    parser.add_argument('--outdir', required=True, help='输出目录')
    parser.add_argument('--project-root', required=True, help='项目根目录（用于定位 fonts/）')
    parser.add_argument('--css', default=None, help='自定义 CSS 文件路径（可选）')
    parser.add_argument('--base-dir', default=None, help='工作目录（用于解析图片等相对路径资源）')
    args = parser.parse_args()

    md_path = Path(args.input)
    out_dir = Path(args.outdir)
    out_dir.mkdir(parents=True, exist_ok=True)

    project_root = Path(args.project_root)
    fonts_dir = project_root / 'fonts'
    css_path = Path(args.css) if args.css else (Path(__file__).parent / 'template.css')
    base_dir = Path(args.base_dir) if args.base_dir else md_path.parent

    if not md_path.exists():
        log(f"输入文件不存在: {md_path}")
        return 2

    # 读取 Markdown
    md_text = md_path.read_text(encoding='utf-8')

    # 准备 DOCX / PDF 输出路径（带时间戳以避免重名）
    import time
    timestamp = int(time.time() * 1000)
    base = args.name
    docx_path = out_dir / f"{base}-{timestamp}.docx"
    pdf_path = out_dir / f"{base}-{timestamp}.pdf"

    # DOCX（Pandoc）
    docx_ok = generate_docx(md_path, docx_path, base_dir=base_dir)

    # PDF（WeasyPrint）
    pdf_ok = False
    try:
        html_body = md_to_html(md_text)
        css_text = css_path.read_text(encoding='utf-8') if css_path.exists() else ""
        full_html = build_html_doc(html_body, base, css_text, fonts_dir)
        # 以 base_dir 作为 base_url，使图片相对路径能正确解析
        generate_pdf(full_html, pdf_path, base_url=base_dir)
        pdf_ok = True
    except Exception as e:
        log(f"PDF 生成失败: {type(e).__name__}: {e}")
        import traceback
        log(traceback.format_exc())

    if not pdf_ok and not docx_ok:
        log("DOCX 和 PDF 均生成失败")
        return 1

    # 通过 stdout 输出 JSON（供 Node 解析）
    result = {
        "docx": str(docx_path) if docx_ok else None,
        "pdf": str(pdf_path) if pdf_ok else None,
    }
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
