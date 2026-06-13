const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const app = express();
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
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.md', '.markdown'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('仅支持 .md 或 .markdown 文件'));
        }
    }
});

// ============ API ============

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// 文档转换
app.post('/api/convert', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: '请上传 Markdown 文件' });
    }

    const mdPath = req.file.path;
    const originalName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const outputName = req.body.filename && req.body.filename.trim()
        ? req.body.filename.trim()
        : originalName;

    const args = [
        path.join(PROJECT_ROOT, 'python', 'convert.py'),
        '--input', mdPath,
        '--name', outputName,
        '--outdir', OUTPUTS_DIR,
        '--project-root', PROJECT_ROOT,
    ];

    execFile(PYTHON, args, { timeout: 120000 }, (err, stdout, stderr) => {
        // 清理上传的临时文件
        fs.unlink(mdPath, () => {});

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
