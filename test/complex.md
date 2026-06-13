# 项目开发文档

## 一、概述

本文档介绍 **DocumentConverter** 工具的开发背景与目标。

> 目标：提供简洁高效的 Markdown 转 Word / PDF 能力。

## 二、技术栈

- 后端：Node.js + Express
- 前端：原生 HTML + CSS + JavaScript
- Markdown 解析：`marked`
- DOCX 生成：`html-docx-js`
- PDF 生成：`pdfkit`

## 三、核心代码

### 3.1 转换主流程

```python
def convert(markdown_text):
    html = markdown_to_html(markdown_text)
    docx = html_to_docx(html)
    pdf = html_to_pdf(html)
    return docx, pdf
```

### 3.2 表格示例

| 步骤 | 输入 | 输出 | 状态 |
|------|------|------|------|
| 1 | .md 文件 | HTML | ✅ |
| 2 | HTML | DOCX | ✅ |
| 3 | HTML | PDF | ✅ |

## 四、特性清单

1. 支持 GitHub Flavored Markdown
2. 支持 GFM 表格
3. 支持代码块（含语法高亮标签）
4. 支持任务列表
5. 支持多级标题

## 五、结语

如有问题，欢迎反馈。
