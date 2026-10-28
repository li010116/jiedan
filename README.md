# MOGUSTACK 全栈接单网站

React + Vite 前端、Express 5 API、SQLite 持久化数据库与管理员工作台。

## 功能

- 访客：服务与作品展示、作品详情、需求确认后真实提交、回执编号、下载需求单。
- 需求管理：搜索、分页、状态筛选、更新跟进状态、保存内部备注。
- 经营概览：累计签约、实收、待收余额、交付项目、六个月收款趋势、近期安排与业务动态。
- 客户管理：客户档案、联系方式、合作状态、沟通记录及下次跟进日期。
- 项目交付与任务看板：关联客户、计划交付日期、任务优先级、截止日期、任务进度与逾期提醒。
- 报价管理：多条服务明细、数量与单价自动汇总、报价状态、下载 TXT 报价单。
- 合同记录：报价生成合同草稿、合同编号、金额、签署日期及状态。
- 收款台账：定金与阶段款计划、到账确认、交易凭证编号、合同余额校验。
- 业务列表：关键词搜索、状态与关联筛选、CSV 导出。
- 作品管理：新建、修改、删除、发布/下架、排序，区分演示与正式作品。
- 站点设置：工作室名称、简介、标语、邮箱、微信；修改后反映到首页。
- 账户与数据：密码哈希、数据库会话、HttpOnly Cookie、来源校验、限流、输入校验、幂等提交与数据库备份。

需求保存到数据库；不依赖付费服务，未接入邮件、短信或微信通知。

### 接单业务流程

1. 在“项目需求”详情中点击“转为客户与项目”；重复操作会返回已有客户和项目。
2. 在“客户管理”记录沟通和下次跟进日期，在“项目交付”确认范围并安排日期。
3. 在“任务看板”拆解任务，编辑状态推动进展。
4. 在“报价管理”填写服务明细，客户接受后点击“生成合同”，建立合同草稿。
5. 记录实际合同签署信息后，在“收款台账”登记定金、阶段款和尾款；到账时编辑原记录为“已到账”。

金额以整数分存储。非作废收款的计划与实收合计不能超过合同总额；已有收款记录时，合同变更受到约束。合同模块保存摘要和状态，尚未接入电子签署；收款模块是人工台账，尚未接入在线支付。业务记录通过归档、暂停、取消和作废状态管理。

数据库会自动迁移至版本 3：版本 2 加入业务管理，版本 3 加入作品在线体验链接。更新前建议运行 `npm run db:backup`。

新增鉴权接口：`GET /api/admin/business` 读取业务快照；`POST /api/admin/business/:module`、`PUT /api/admin/business/:module/:id` 创建与更新记录，module 为 clients、engagements、tasks、quotes、contracts、payments；`POST /api/admin/inquiries/:id/convert` 转项目；`POST /api/admin/business/quotes/:id/contract` 生成合同草稿。

## 本地启动

需要 Node.js 22.13+。数据库使用 [Node 内置 SQLite](https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html)。

```sh
npm install
npm run admin:create
npm run dev
```

- 首页：<http://localhost:4173/>
- 后台：<http://localhost:4173/admin>
- 健康检查：<http://localhost:3001/api/health>

管理员默认邮箱 `admin@mogustack.local`。脚本随机生成密码并写入 `.local/admin-credentials.txt`，不会在终端打印密码。已有账号会拒绝覆盖。创建其他管理员：

```sh
npm run admin:create -- --email owner@example.com
```

本工作区已完成首次账号创建，可直接打开本地凭据文件登录。

`npm run dev` 同时启动前端 4173 和后端 3001，Vite 代理 `/api`。两者默认仅监听本机。数据库保存在 `data/mogustack.sqlite`，重启不会丢失数据。首次迁移加入三个演示作品；删除的作品不会在重启后再次生成。

## 环境配置

默认配置可直接运行。自定义时将 `.env.example` 复制为 `.env`。

| 变量 | 用途 |
| --- | --- |
| `HOST` | 后端监听地址，默认 `127.0.0.1` |
| `PORT` | 后端端口，默认 `3001` |
| `DATABASE_PATH` | 默认 `./data/mogustack.sqlite` |
| `PUBLIC_ORIGIN` | 留空使用本机默认；部署填写真实 HTTPS 域名，支持逗号分隔 |
| `TRUST_PROXY` | 默认 `0`；反向代理场景填写实际可信代理层数 |

`.env`、`.local`、`data` 与备份文件已加入 Git 忽略规则，不应提交。

## 构建与部署

```sh
npm run build
npm start
```

单个 Node 服务提供构建后的首页、后台与 API。本地访问 <http://localhost:3001/>。若设置过开发用 `PUBLIC_ORIGIN`，改为 `http://localhost:3001` 或留空。

公网部署时设置 `PUBLIC_ORIGIN=https://你的域名`，通过 HTTPS 反向代理访问。会话有效期 8 小时，HTTPS 环境启用 Secure Cookie。可参考 [Express 官方安全实践](https://expressjs.com/en/advanced/best-practice-security/)。

### Docker

```sh
docker compose up -d --build
docker compose exec studio npm run admin:create
docker compose exec studio cat .local/admin-credentials.txt
```

访问 <http://localhost:3001/>。Compose 使用非 root 容器与持久化具名卷，端口默认仅绑定本机。接入域名时设置 `DEPLOY_ORIGIN=https://你的域名`，并配置反向代理。

## 测试和备份

```sh
npm test
npm run db:backup
```

API 测试在独立临时数据库中覆盖权限、登录/退出、来源校验、输入校验、幂等性、持久化、需求跟进、作品管理、限流和生产路由。

备份使用 SQLite `VACUUM INTO` 生成一致性副本，默认写入 `backups/`。恢复前先停止应用，保留旧数据库及其 `-wal`、`-shm` 文件作为回滚副本，再将备份放到 `DATABASE_PATH` 指定位置。不要在应用运行时替换数据库。

## 目录

| 路径 | 内容 |
| --- | --- |
| `src/App.jsx` | 公开落地页 |
| `src/components/` | 需求提交与联系方式 |
| `src/admin/` | 登录、需求、作品、站点设置 |
| `server/app.js` | API 与静态文件服务 |
| `server/db.js` | 数据库迁移与种子数据 |
| `server/auth.js` | 密码与会话 |
| `server/validation.js` | 输入校验 |
| `server/create-admin.js` | 管理员创建 |
| `server/backup.js` | 备份 |
| `scripts/` | 开发与生产启动 |
| `tests/` | API 集成测试 |
| `public/assets/` | 网站图片 |

## API

公开接口：`GET /api/site`、`POST /api/inquiries`。账户接口：`GET /api/auth/session`、`POST /api/auth/login`、`POST /api/auth/logout`。

以下接口需要管理员会话：

| 接口 | 用途 |
| --- | --- |
| `GET /api/admin/inquiries` | 搜索、状态筛选、分页、统计 |
| `PATCH /api/admin/inquiries/:id` | 更新状态与内部备注 |
| `GET /api/admin/projects` | 包括未发布内容的作品列表 |
| `POST /api/admin/projects` | 新增作品 |
| `PUT /api/admin/projects/:id` | 修改作品 |
| `DELETE /api/admin/projects/:id` | 删除作品 |
| `PUT /api/admin/settings` | 更新品牌和联系方式 |

作品图片支持 `/assets/` 路径或 HTTPS 地址，当前不含上传服务。后台“作品管理 → 编辑作品 → 在线体验链接”可填写 HTTP/HTTPS 完整地址；留空隐藏入口，填写后前台详情在新标签页打开。需求状态为 `new`、`contacted`、`in_progress`、`closed`。

后台“项目交付 → 项目详情”可集中查看客户、任务、报价、合同和收款；概览入口会携带具体状态或记录。后台地址中的 hash 保存当前栏目和筛选，刷新或使用浏览器前进/后退可恢复上下文。项目待收余额按已签署/完成合同减去实收计算，可能包含尚未登记收款计划的部分。
