const express = require('express');
const compression = require('compression');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const app = express();
app.use(compression()); // gzip 压缩，加速远程访问
const PORT = process.env.PORT || 3003;

const PROJECT_ROOT = __dirname;
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads');
const OUTPUTS_DIR = path.join(PROJECT_ROOT, 'outputs');
const PYTHON = process.env.PYTHON || 'python3';

// 确保目录存在
[UPLOADS_DIR, OUTPUTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 静态文件
app.use(express.static(path.join(PROJECT_ROOT, 'public')));
app.use('/outputs', express.static(OUTPUTS_DIR));

// Multer 文件上传配置
const ALLOWED_MD_EXT = ['.md', '.markdown'];
const ALLOWED_IMG_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'];
const ALLOWED_EXT = [...ALLOWED_MD_EXT, ...ALLOWED_IMG_EXT];

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 每个请求的工作目录在 middleware 阶段已挂载到 req._workDir
        const dir = req._workDir || UPLOADS_DIR;
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // 使用前端传来的相对路径映射（保留目录结构）
        let relPath = null;
        if (req.body && req.body.relativePaths) {
            try {
                const pathMap = JSON.parse(req.body.relativePaths);
                // 按 originalname 查找相对路径
                relPath = pathMap[file.originalname] || null;
            } catch (_) { /* 解析失败时回退到平铺保存 */ }
        }

        if (relPath && req._workDir) {
            // 按相对路径创建子目录并保存
            const targetPath = path.join(req._workDir, relPath);
            const targetDir = path.dirname(targetPath);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
            cb(null, relPath);
        } else {
            // 无相对路径时，平铺保存
            cb(null, file.originalname);
        }
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_EXT.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`不支持的文件类型: ${ext}（支持 Markdown 和常见图片格式）`));
        }
    }
});

// 中间件：为每次转换请求创建唯一工作目录
function prepareWorkDir(req, res, next) {
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const workDir = path.join(UPLOADS_DIR, uniqueSuffix);
    fs.mkdirSync(workDir, { recursive: true });
    req._workDir = workDir;
    next();
}

// ============ API ============

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// 文档转换
app.post('/api/convert', prepareWorkDir, upload.array('files'), (req, res) => {
    const files = req.files || [];
    const workDir = req._workDir;

    // 从上传文件中找到 Markdown 文件
    const mdFile = files.find(f => {
        const ext = path.extname(f.originalname).toLowerCase();
        return ALLOWED_MD_EXT.includes(ext);
    });

    if (!mdFile) {
        // 清理工作目录
        fs.rm(workDir, { recursive: true, force: true }, () => {});
        return res.status(400).json({ success: false, error: '请上传至少一个 Markdown 文件（.md / .markdown）' });
    }

    const mdPath = mdFile.path;
    const originalName = path.basename(mdFile.originalname, path.extname(mdFile.originalname));
    const outputName = req.body.filename && req.body.filename.trim()
        ? req.body.filename.trim()
        : originalName;

    const imageCount = files.filter(f => {
        const ext = path.extname(f.originalname).toLowerCase();
        return ALLOWED_IMG_EXT.includes(ext);
    }).length;

    console.log(`转换请求: ${mdFile.originalname} + ${imageCount} 张图片`);

    const args = [
        path.join(PROJECT_ROOT, 'python', 'convert.py'),
        '--input', mdPath,
        '--name', outputName,
        '--outdir', OUTPUTS_DIR,
        '--project-root', PROJECT_ROOT,
        '--base-dir', workDir,
    ];

    execFile(PYTHON, args, { timeout: 120000 }, (err, stdout, stderr) => {
        // 清理工作目录
        fs.rm(workDir, { recursive: true, force: true }, () => {});

        if (err) {
            console.error('转换失败:', stderr || err.message);
            return res.status(500).json({ success: false, error: '转换失败，请重试' });
        }

        try {
            // 从 stdout 提取 JSON（convert.py 最后一行输出）
            const lines = stdout.trim().split('\n');
            const jsonLine = lines[lines.length - 1];
            const result = JSON.parse(jsonLine);

            const response = { success: true, docx: null, pdf: null };

            if (result.docx) {
                const fileName = path.basename(result.docx);
                response.docx = `/outputs/${fileName}`;
            }
            if (result.pdf) {
                const fileName = path.basename(result.pdf);
                response.pdf = `/outputs/${fileName}`;
            }

            res.json(response);
        } catch (parseErr) {
            console.error('解析输出失败:', parseErr.message, stdout);
            res.status(500).json({ success: false, error: '解析转换结果失败' });
        }
    });
});

// ============ 启动 ============

app.listen(PORT, () => {
    console.log(`DocumentConverter 已启动: http://localhost:${PORT}`);
});
