# DocumentConverter

一个基于 Web 的文档转换工具，支持将 **Markdown** 文件一键转换为 **Word (DOCX)** 和 **PDF** 格式。提供友好的浏览器操作界面，也支持通过 API 集成到其他工作流中。

---

## 目录

- [功能特性](#功能特性)
- [技术架构](#技术架构)
- [项目结构](#项目结构)
- [环境要求](#环境要求)
- [安装与部署](#安装与部署)
- [启动服务](#启动服务)
- [使用方式](#使用方式)
  - [Web 界面](#web-界面)
  - [API 接口](#api-接口)
- [配置说明](#配置说明)
- [排版与字体](#排版与字体)
- [环境检查工具](#环境检查工具)
- [常见问题](#常见问题)
- [测试](#测试)

---

## 功能特性

- **一键双格式输出**：上传一次 Markdown 文件，同时生成 DOCX 和 PDF 两种格式
- **图片支持**：可同时上传 Markdown 引用的图片文件（.png .jpg .gif .svg .webp .bmp），转换时自动嵌入到 PDF 和 DOCX 中
- **拖拽文件夹上传**：支持拖拽包含图片的整个文件夹，保持相对目录结构
- **完整的 Markdown 支持**：基于 GFM（GitHub Flavored Markdown）扩展，包括：
  - 表格、围栏代码块、脚注
  - 任务列表（`- [x]`）
  - 代码语法高亮（Pygments）
  - 目录锚点（TOC）
  - 智能引号
- **专业的 PDF 排版**：
  - A4 页面尺寸，2.5cm / 2cm 页边距
  - 页码显示（当前页 / 总页数）
  - 标题层级样式、代码块配色、表格斑马纹
  - 分页控制（标题不断页、代码块不跨页）
- **完美中文支持**：内嵌 Google Noto Sans CJK SC 字体（Regular + Bold），避免中文乱码
- **自定义输出文件名**：可在转换前指定输出文件的基础名
- **文件大小限制**：单文件最大 20MB，避免超大文件导致服务超时
- **拖拽上传**：支持点击选择或拖拽文件上传

---

## 技术架构

```
┌──────────────────────────────────────────────────────┐
│  浏览器 (index.html)                                  │
│  - 拖拽/选择文件上传                                    │
│  - 调用 /api/convert 接口                              │
│  - 展示下载链接                                        │
└────────────────────┬─────────────────────────────────┘
                     │  HTTP POST (multipart/form-data)
                     ▼
┌──────────────────────────────────────────────────────┐
│  Node.js 服务 (server.js - Express 5)                 │
│  - 文件接收 (multer)                                   │
│  - 调用 Python 子进程                                  │
│  - 返回 JSON 结果                                      │
└────────────────────┬─────────────────────────────────┘
                     │  child_process.execFile
                     ▼
┌──────────────────────────────────────────────────────┐
│  Python 转换脚本 (python/convert.py)                   │
│  ┌─────────────────┐   ┌─────────────────────────┐   │
│  │ DOCX: Pandoc    │   │ PDF: Python-Markdown    │   │
│  │ (md → docx)     │   │   + WeasyPrint          │   │
│  └─────────────────┘   │   (md → html → pdf)     │   │
│                         └─────────────────────────┘   │
│  stdout 输出 JSON → Node.js 解析                       │
└──────────────────────────────────────────────────────┘
```

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | 原生 HTML / CSS / JS | 无框架依赖，轻量快速 |
| 后端 | Node.js + Express 5 | 文件上传、进程调度 |
| Markdown 解析 | Python-Markdown | 支持 extra / codehilite / toc 等扩展 |
| PDF 渲染 | WeasyPrint | HTML → PDF，支持 CSS Paged Media |
| DOCX 生成 | Pandoc | 成熟的文档格式转换工具 |
| 代码高亮 | Pygments | 配合 codehilite 扩展 |
| 中文字体 | Noto Sans CJK SC | Google 官方完整版，覆盖 44810 字符 |

---

## 项目结构

```
DocumentConverter/
├── server.js              # Node.js 主服务（Express）
├── package.json           # Node.js 依赖配置
├── start.sh               # 启动脚本（自动加载 nvm）
├── _check_tools.sh        # 环境检查脚本
├── python/
│   ├── convert.py         # 核心转换逻辑（Python）
│   └── template.css       # PDF 排版 CSS 模板
├── fonts/
│   ├── notosans-sc.ttf        # Noto Sans SC Regular（~16MB）
│   └── notosans-sc-bold.otf   # Noto Sans SC Bold（~17MB）
├── public/
│   └── index.html         # Web 前端界面
├── uploads/               # 临时上传目录（自动创建）
├── outputs/               # 转换输出目录（自动创建）
└── test/
    ├── test.md            # 基础测试用例
    ├── complex.md         # 复杂语法测试
    └── final.md           # 综合测试用例
```

---

## 环境要求

### 必需

| 依赖 | 版本要求 | 用途 |
|------|---------|------|
| **Node.js** | ≥ 18.x | 运行 Web 服务 |
| **Python3** | ≥ 3.10 | 运行转换脚本 |

### Node.js 依赖（自动安装）

| 包名 | 版本 | 说明 |
|------|------|------|
| express | ^5.2.1 | Web 框架 |
| multer | ^2.1.1 | 文件上传中间件 |
| marked | ^18.0.5 | Markdown 解析（备用） |
| puppeteer | ^25.1.0 | 无头浏览器（备用） |
| pdfkit | ^0.19.1 | PDF 生成（备用） |
| html-docx-js | ^0.3.1 | HTML 转 DOCX（备用） |

### Python 依赖（需手动安装）

| 包名 | 说明 |
|------|------|
| `markdown` | Markdown → HTML 转换 |
| `weasyprint` | HTML → PDF 渲染 |
| `Pygments` | 代码语法高亮 |
| `fonttools` | 字体处理工具 |

### 系统工具（可选但推荐）

| 工具 | 说明 |
|------|------|
| **Pandoc** | 用于生成 DOCX 文件。若未安装，仅生成 PDF |

---

## 安装与部署

### 1. 克隆项目

```bash
cd /home/cuihf/AIPlayGround/myWebServices
git clone <repository-url> DocumentConverter
cd DocumentConverter
```

### 2. 安装 Node.js 依赖

```bash
npm install
```

### 3. 安装 Python 依赖

```bash
pip3 install markdown weasyprint Pygments fonttools
```

> **注意**：WeasyPrint 依赖系统级库 `pango`、`cairo`、`gdk-pixbuf2`。在 Ubuntu/Debian 上可通过以下命令安装：
> ```bash
> sudo apt install libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev
> ```

### 4. 安装 Pandoc（可选，用于 DOCX 生成）

```bash
# Ubuntu/Debian
sudo apt install pandoc

# 或使用 conda
conda install -c conda-forge pandoc
```

### 5. 确认字体文件

确保 `fonts/` 目录下存在以下字体文件：

```
fonts/notosans-sc.ttf         # Regular（~16MB）
fonts/notosans-sc-bold.otf    # Bold（~17MB）
```

> 如需重新下载，可前往 [Google Fonts - Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC) 获取。

### 6. 环境检查

```bash
bash _check_tools.sh
```

预期输出示例：

```
=== DocumentConverter 环境检查 ===
✓ Node.js v20.x.x
✓ Python3 3.11.x
✓ Pandoc 3.x.x.x

--- Python 依赖 ---
✓ markdown
✓ weasyprint
✓ Pygments
✓ fonttools

--- 字体文件 ---
✓ fonts/notosans-sc.ttf (16M)
✓ fonts/notosans-sc-bold.otf (17M)

环境检查通过 ✓
```

---

## 启动服务

### 方式一：使用启动脚本（推荐）

```bash
bash start.sh
```

启动脚本会自动检测 `node` 是否在 PATH 中，若不在则自动加载 `nvm`。日志同时输出到终端和 `server.log` 文件。

### 方式二：直接启动

```bash
node server.js
```

### 自定义端口

```bash
PORT=8080 node server.js
# 或
PORT=8080 bash start.sh
```

默认端口为 **3003**。

### 后台运行

```bash
nohup bash start.sh &
```

---

## 使用方式

### Web 界面

启动服务后，在浏览器中访问：

```
http://localhost:3003
```

操作步骤：

1. 点击上传区域或拖拽 `.md` / `.markdown` 文件及相关图片
2. 文件列表显示已选择的 Markdown 和图片文件（支持移除单个文件）
3. （可选）修改输出文件名
4. 点击 **“转换为 Word & PDF”** 按钮
5. 等待转换完成，下载 DOCX 和 PDF 文件

> 图片引用格式示例：`![图片说明](./image.png)` 或 `![图片说明](image.png)`，转换时按 Markdown 文件所在目录为基准解析相对路径。

### API 接口

#### 健康检查

```http
GET /api/health
```

响应示例：

```json
{
  "status": "ok",
  "timestamp": 1718265600000
}
```

#### 文档转换

```http
POST /api/convert
Content-Type: multipart/form-data
```

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `files` | File[] | 是 | Markdown 文件 + 可选图片（支持 .md .markdown .png .jpg .jpeg .gif .svg .webp .bmp），单文件最大 20MB |
| `filename` | String | 否 | 输出文件基础名（不含扩展名），留空使用原文件名 |
| `relativePaths` | String | 否 | JSON 字符串，文件名到相对路径的映射，用于保持目录结构 |

**cURL 示例：**

```bash
# 仅上传 Markdown
curl -X POST http://localhost:3003/api/convert \
  -F "files=@document.md" \
  -F "filename=my-output"

# 上传 Markdown + 图片
curl -X POST http://localhost:3003/api/convert \
  -F "relativePaths={\"document.md\":\"document.md\",\"image.png\":\"image.png\"}" \
  -F "files=@document.md" \
  -F "files=@image.png" \
  -F "filename=my-output"
```

**成功响应（200）：**

```json
{
  "success": true,
  "docx": "/outputs/my-output-1718265600000.docx",
  "pdf": "/outputs/my-output-1718265600000.pdf"
}
```

**错误响应：**

| 状态码 | 场景 | 响应示例 |
|--------|------|---------|
| 400 | 未上传文件 | `{"success": false, "error": "请上传 Markdown 文件"}` |
| 400 | 文件类型不支持 | `{"success": false, "error": "仅支持 .md 或 .markdown 文件"}` |
| 500 | 转换失败 | `{"success": false, "error": "转换失败，请重试"}` |

---

## 配置说明

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3003` | 服务监听端口 |
| `PYTHON` | `python3` | Python 解释器路径 |

### 自定义 CSS 模板

转换脚本支持自定义 CSS 文件来控制 PDF 排版。默认使用 `python/template.css`。

可通过 `convert.py` 的 `--css` 参数指定自定义 CSS：

```bash
python3 python/convert.py \
  --input document.md \
  --name output \
  --outdir ./outputs \
  --project-root . \
  --css /path/to/custom.css
```

### convert.py 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `--input` | 是 | 输入 Markdown 文件路径 |
| `--name` | 是 | 输出文件基础名（不含扩展名） |
| `--outdir` | 是 | 输出目录 |
| `--project-root` | 是 | 项目根目录（用于定位 `fonts/`） |
| `--css` | 否 | 自定义 CSS 文件路径 |

---

## 排版与字体

### PDF 排版特性

- **页面**：A4 尺寸，上 2.5cm / 左右 2cm / 下 2.8cm 页边距
- **字体**：Noto Sans SC（正文 11pt，行高 1.75）
- **标题**：6 级标题层级样式，h1/h2 带底部边框
- **代码**：行内代码粉色高亮，代码块灰色背景 + Pygments 语法高亮
- **表格**：表头灰色背景，斑马纹行，完整边框
- **引用**：左侧蓝色竖线 + 灰色背景
- **页码**：底部居中显示 "当前页 / 总页数"（首页不显示）
- **分页控制**：标题后不断页，表格/代码块/引用块不跨页

### 中文字体方案

项目使用 **Google Noto Sans CJK SC** 完整版字体：

- `notosans-sc.ttf`：Regular 字重（~16MB），覆盖 44810 字符
- `notosans-sc-bold.otf`：Bold 字重（~17MB）

字体通过 CSS `@font-face` 自动嵌入 PDF，无需在系统中安装字体。WeasyPrint 会自动从 `fonts/` 目录加载字体文件。

---

## 环境检查工具

项目提供 `_check_tools.sh` 脚本，用于一键检查所有依赖：

```bash
bash _check_tools.sh
```

检查项目包括：

- Node.js 是否安装
- Python3 是否安装
- Pandoc 是否安装（DOCX 功能依赖）
- Python 包：markdown、weasyprint、Pygments、fonttools
- 字体文件是否完整

---

## 常见问题

### Q: DOCX 文件未生成？

Pandoc 未安装时会跳过 DOCX 生成，仅输出 PDF。安装 Pandoc 后即可同时生成两种格式。

### Q: PDF 中文显示为方块或乱码？

确认 `fonts/` 目录下存在 `notosans-sc.ttf` 和 `notosans-sc-bold.otf` 文件。可通过 `_check_tools.sh` 检查字体状态。

### Q: WeasyPrint 报错缺少系统库？

安装系统级依赖：

```bash
sudo apt install libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev
```

### Q: 转换超时？

默认超时时间为 120 秒。对于超大文件，可能需要更长时间。可修改 `server.js` 中 `execFile` 的 `timeout` 参数。

### Q: 如何修改默认端口？

通过环境变量 `PORT` 指定：

```bash
PORT=8080 bash start.sh
```

---

## 测试

项目在 `test/` 目录下提供了三个测试文件：

| 文件 | 说明 |
|------|------|
| `test/test.md` | 基础 Markdown 语法测试 |
| `test/complex.md` | 复杂语法（嵌套列表、多级标题等） |
| `test/final.md` | 综合测试用例 |

可通过 API 快速测试：

```bash
curl -X POST http://localhost:3003/api/convert \
  -F "file=@test/test.md" \
  -F "filename=test-output"
```

---

## 许可证

本项目仅供内部使用。
