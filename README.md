# 酷狗概念 VIP 每日自动签到

基于青龙面板的酷狗概念版 VIP 每日自动签到工具，通过"听歌"和"看广告"两种方式每天免费领取 VIP 天数。

## 功能

- 每日自动听歌领取 VIP
- 每日自动看广告领取 VIP（最多 8 次，间隔 30 秒）
- 每周日自动刷新 token（延长有效期）
- Token 变更后自动回写青龙环境变量
- 多账号支持
- 日志脱敏（自动隐藏 token、昵称等敏感信息）

## 部署步骤

### 1. 添加订阅

在青龙面板的「订阅管理」中添加本仓库，或手动将本仓库文件放入青龙数据目录的 `repo/kgcheckin` 下。

### 2. 安装依赖

在青龙的「脚本管理」或终端中执行：

```bash
cd /ql/data/repo/kgcheckin/api && npm install
```

> 只需安装 `api/` 目录下的依赖（axios），根目录无需额外安装。

### 3. 配置环境变量

在青龙面板「环境变量」中添加以下变量：

| 变量名                | 必填  | 说明                                 | 示例                            |
| ------------------ | --- | ---------------------------------- | ----------------------------- |
| `KUGOU_CK`         | 是   | 账号凭证，格式 `userid#token`，多账号用 `@` 分隔 | `123456#abc...@789012#def...` |
| `KG_PLATFORM`      | 否   | 固定填 `lite`（概念版），默认已是 lite          | `lite`                        |
| `QL_CLIENT_ID`     | 否   | 青龙 OpenAPI 客户端 ID（用于 token 自动回写）   |                               |
| `QL_CLIENT_SECRET` | 否   | 青龙 OpenAPI 客户端密钥（用于 token 自动回写）    |                               |
| `KUGOU_API_PROXY`  | 否   | HTTP 代理地址（网络受限时使用）                  | `http://127.0.0.1:7890`       |

#### 如何获取 userid 和 token

1. 手机上安装酷狗概念版并登录
2. 使用抓包工具（如 Stream、HttpCanary 等）抓取任意 API 请求
3. 在请求 Cookie 中找到 `userid` 和 `token` 的值
4. 按 `userid#token` 格式填入 `KUGOU_CK`

#### 多账号

多个账号之间用 `@` 分隔：

```
userid1#token1@userid2#token2@userid3#token3
```

### 4. 创建定时任务

在青龙面板「定时任务」中新增：

- 名称：`酷狗概念签到`
- 命令：`task kgcheckin/kgcheckin.js`
- 定时规则：`10 1 * * *`（每天北京时间 01:10 执行）

> 也可选择其他时间，避开酷狗服务器维护时段即可。

### 5. Token 自动回写（可选）

如果需要 token 刷新后自动回写环境变量，需要在青龙「系统设置 → API 应用」中创建一个应用，获取 `Client ID` 和 `Client Secret`，分别填入 `QL_CLIENT_ID` 和 `QL_CLIENT_SECRET` 环境变量。

权限至少需要勾选「环境变量」。

如果未配置这两个变量，token 过期时脚本会发送通知提醒你手动更新。

## 项目结构

```
kgcheckin/
├── kgcheckin.js          # 青龙入口脚本
├── kugouApi.js           # 酷狗 API 封装层
├── qlApi.js              # 青龙 OpenAPI 交互
├── utils.js              # 工具函数
├── package.json
├── api/                  # 酷狗 API 底层模块
│   ├── package.json
│   ├── module/           # 5 个签到相关接口
│   └── util/             # 加密/签名/请求工具
└── README.md
```

## 致谢

API 模块基于 [MakcRe/KuGouMusicApi](https://github.com/MakcRe/KuGouMusicApi)。
