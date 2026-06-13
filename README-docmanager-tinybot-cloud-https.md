# docmanager.tinybot.cloud Nginx 反向代理说明

> 本文记录如何通过 **Nginx** 将外部访问域名 `docmanager.tinybot.cloud` 反向代理到本机 `127.0.0.1:3003`，并说明当前状态、配置文件位置、HTTPS 接入步骤、验证方法与常见故障排查。

---

## 1. 目标

实现以下访问链路：

```text
外部浏览器
    |
    |  HTTP / HTTPS
    v
docmanager.tinybot.cloud
    |
    v
Nginx
    |
    |  反向代理到本机
    v
127.0.0.1:3003
```

目标效果：

- 用户从公网访问 `docmanager.tinybot.cloud`
- Nginx 接收请求并转发到本机 `3003` 服务
- 上游服务不直接暴露公网端口
- 后续可接入 Let's Encrypt 证书，实现 HTTPS 访问

---

## 2. 当前状态

截至当前，已完成：

- 已创建并启用 Nginx 站点：`docmanager.tinybot.cloud`
- 已将该域名请求反向代理到 `http://127.0.0.1:3003`
- 本机使用 `Host: docmanager.tinybot.cloud` 请求验证时，能够正常返回 `3003` 服务内容
- Nginx 配置语法检查通过，服务已成功 reload
- 已成功签发并部署 `docmanager.tinybot.cloud` 的 Let's Encrypt 证书
- 已启用 HTTP 自动跳转到 HTTPS

简而言之：

- **Nginx 转发已就绪**
- **HTTPS 已正式生效**

---

## 3. 实际环境

| 项目 | 值 |
|---|---|
| 域名 | `docmanager.tinybot.cloud` |
| 代理软件 | `nginx/1.18.0 (Ubuntu)` |
| 上游服务 | `127.0.0.1:3003` |
| 上游服务响应 | `HTTP/1.1 200 OK` |
| Nginx 站点配置 | `/etc/nginx/sites-available/docmanager.tinybot.cloud` |
| 启用链接 | `/etc/nginx/sites-enabled/docmanager.tinybot.cloud` |
| TLS 工具 | `certbot 1.21.0` |
| 证书路径 | `/etc/letsencrypt/live/docmanager.tinybot.cloud/fullchain.pem` |
| 证书到期 | `2026-09-11` |

---

## 4. 涉及文件

### 4.1 Nginx 站点文件

```bash
/etc/nginx/sites-available/docmanager.tinybot.cloud
```

### 4.2 Nginx 启用链接

```bash
/etc/nginx/sites-enabled/docmanager.tinybot.cloud
```

### 4.3 证书目录

```bash
/etc/letsencrypt/live/docmanager.tinybot.cloud/
```

---

## 5. 当前生效的 Nginx 配置

当前站点配置如下：

```nginx
server {
    server_name docmanager.tinybot.cloud;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/docmanager.tinybot.cloud/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/docmanager.tinybot.cloud/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = docmanager.tinybot.cloud) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;
    server_name docmanager.tinybot.cloud;
    return 404; # managed by Certbot
}
```

---

## 6. 配置项说明

| 配置项 | 作用 |
|---|---|
| `server_name docmanager.tinybot.cloud;` | 只匹配该域名的请求 |
| `proxy_pass http://127.0.0.1:3003;` | 将请求转发到本机 3003 服务 |
| `proxy_http_version 1.1;` | 使用 HTTP/1.1，兼容 keep-alive 和升级连接 |
| `proxy_set_header Host $host;` | 把原始域名传递给上游应用 |
| `X-Real-IP` | 让上游获取真实客户端 IP |
| `X-Forwarded-For` | 记录代理链路中的客户端来源 |
| `X-Forwarded-Proto` | 告知上游原始请求协议 |
| `Upgrade` / `Connection "upgrade"` | 支持 WebSocket 或其他升级连接场景 |

---

## 7. 部署步骤

### 7.1 创建站点文件

```bash
sudo nano /etc/nginx/sites-available/docmanager.tinybot.cloud
```

写入：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name docmanager.tinybot.cloud;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 7.2 启用站点

```bash
sudo ln -sfn /etc/nginx/sites-available/docmanager.tinybot.cloud \
  /etc/nginx/sites-enabled/docmanager.tinybot.cloud
```

### 7.3 检查并重载 Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. 上游服务要求

Nginx 只负责转发，请确保 `3003` 服务本身可用。

建议至少满足以下条件：

- 服务正在监听 `127.0.0.1:3003` 或 `0.0.0.0:3003`
- 本机访问 `http://127.0.0.1:3003` 返回 `200 OK`
- 若是前端开发服务器，需要允许通过该域名访问
- 若依赖 WebSocket/HMR，需保留当前 `Upgrade` 和 `Connection` 配置

本次验证结果显示：

```text
curl -I http://127.0.0.1:3003
HTTP/1.1 200 OK
X-Powered-By: Express
```

这说明当前 `3003` 上的应用已经在正常响应。

---

## 9. DNS 配置要求

要让外部用户真正访问到该服务，必须先完成公网 DNS 配置。

需要在域名解析平台添加：

| 记录类型 | 主机记录 | 指向 |
|---|---|---|
| A | `docmanager` | 当前服务器公网 IP |

如果服务器支持 IPv6，也可以额外添加：

| 记录类型 | 主机记录 | 指向 |
|---|---|---|
| AAAA | `docmanager` | 当前服务器公网 IPv6 地址 |

### 9.1 为什么 DNS 很关键

Let's Encrypt 在签发证书时会验证：

- `docmanager.tinybot.cloud` 是否真的指向当前服务器
- 公网是否能通过该域名访问到此 Nginx 实例

如果 DNS 未生效，会出现类似错误：

```text
DNS problem: NXDOMAIN looking up A for docmanager.tinybot.cloud
```

这表示证书申请失败不是 Nginx 配错，而是 **公网 DNS 尚未建立或尚未传播完成**。

---

## 10. HTTPS 接入步骤

本次实际执行以下命令，为该域名申请证书并自动写入 HTTPS 配置：

```bash
sudo certbot --nginx -d docmanager.tinybot.cloud --non-interactive --redirect
```

该命令会自动完成：

1. 向 Let's Encrypt 申请证书
2. 通过 Nginx 插件完成域名校验
3. 把证书路径写入站点配置
4. 自动加入 HTTP -> HTTPS 跳转
5. 自动 reload Nginx

---

## 11. 证书签发后的实际结果

证书已成功签发，当前返回的证书信息为：

```text
subject=CN = docmanager.tinybot.cloud
issuer=C = US, O = Let's Encrypt, CN = YR1
notBefore=Jun 13 12:02:45 2026 GMT
notAfter=Sep 11 12:02:44 2026 GMT
DNS:docmanager.tinybot.cloud
```

当前 Nginx HTTPS 配置结构如下：

```nginx
server {
    server_name docmanager.tinybot.cloud;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/docmanager.tinybot.cloud/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/docmanager.tinybot.cloud/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = docmanager.tinybot.cloud) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;
    server_name docmanager.tinybot.cloud;
    return 404; # managed by Certbot
}
```

---

## 12. 验证方法

### 12.1 检查上游服务

```bash
curl -I http://127.0.0.1:3003
```

### 12.2 检查本机 Nginx 是否已转发成功

```bash
curl -I -H 'Host: docmanager.tinybot.cloud' http://127.0.0.1/
```

### 12.3 检查 Nginx 配置语法

```bash
sudo nginx -t
```

### 12.4 查看站点文件

```bash
sudo sed -n '1,220p' /etc/nginx/sites-available/docmanager.tinybot.cloud
```

### 12.5 检查公网访问

```bash
curl -I http://docmanager.tinybot.cloud
```

### 12.6 证书签发后检查 HTTPS

```bash
curl -I https://docmanager.tinybot.cloud
```

### 12.7 查看证书信息

```bash
echo | openssl s_client -connect docmanager.tinybot.cloud:443 -servername docmanager.tinybot.cloud 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

---

## 13. 常用运维命令

```bash
# 检查 nginx 状态
sudo systemctl status nginx

# 测试配置并重载
sudo nginx -t && sudo systemctl reload nginx

# 查看已启用站点
ls -la /etc/nginx/sites-enabled/

# 查看该站点配置
sudo sed -n '1,220p' /etc/nginx/sites-available/docmanager.tinybot.cloud

# 查看 nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 查看 nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# 检查 3003 端口监听
ss -ltnp '( sport = :3003 )'

# 检查 80 / 443 端口监听
ss -ltnp '( sport = :80 or sport = :443 )'

# 查看证书
sudo certbot certificates

# 测试续期
sudo certbot renew --dry-run
```

---

## 14. 常见故障排查

### 14.1 外部访问失败，但本机 `curl 127.0.0.1:3003` 正常

优先检查：

1. DNS 是否已解析到当前服务器公网 IP
2. 防火墙或安全组是否放行了 `80` 和 `443`
3. Nginx 是否已启动并成功 reload

### 14.2 Certbot 报 `NXDOMAIN`

这通常表示：

- 该子域名还没有公网 A 记录
- 或 DNS 尚未传播完成

此时应先修复 DNS，而不是重复申请证书。

### 14.3 Nginx 正常，但访问返回 502

说明 Nginx 无法连通上游服务。检查：

```bash
curl -I http://127.0.0.1:3003
ss -ltnp '( sport = :3003 )'
```

### 14.4 页面能打开，但 WebSocket/HMR 异常

检查以下两行是否仍存在：

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### 14.5 证书申请成功，但浏览器仍提示不安全

优先检查：

1. 浏览器拿到的证书主题是否确实是 `docmanager.tinybot.cloud`
2. Nginx 是否已经 reload
3. 是否存在旧证书缓存或 CDN 缓存

---

## 15. 推荐上线顺序

建议按下面顺序执行：

1. 确保 `3003` 服务本机可访问
2. 配置并启用 Nginx 反向代理
3. 验证 `curl -H 'Host: docmanager.tinybot.cloud' http://127.0.0.1/` 正常
4. 在 DNS 平台添加 `docmanager.tinybot.cloud` 的 A 记录
5. 等待 DNS 生效
6. 执行 `sudo certbot --nginx -d docmanager.tinybot.cloud --non-interactive --redirect`
7. 用浏览器或 `curl -I https://docmanager.tinybot.cloud` 验证最终结果

---

## 16. 最终结果定义

当以下条件全部满足时，说明接入完成：

- `docmanager.tinybot.cloud` 已解析到当前服务器
- Nginx 已将该域名反向代理到 `127.0.0.1:3003`
- `curl -I https://docmanager.tinybot.cloud` 返回正常响应
- 证书主题与 SAN 包含 `docmanager.tinybot.cloud`
- 浏览器访问无证书警告

---

## 17. 当前结论

当前环境中，这项配置已经完成：

- **代理配置已完成**
- **本机转发已验证成功**
- **Nginx 正在运行**
- **HTTPS 证书已成功部署**
- **HTTP 已自动跳转到 HTTPS**

当前正式对外入口：

- **https://docmanager.tinybot.cloud**
