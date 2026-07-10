// ============================================================
// 青龙面板 OpenAPI 交互 —— token 回写 + 通知推送
// ============================================================

const { execSync } = require('child_process');

const QL_URL    = (process.env.QL_URL || 'http://127.0.0.1:5700').replace(/\/$/, '');
const CLIENT_ID = process.env.QL_CLIENT_ID;
const SECRET    = process.env.QL_CLIENT_SECRET;

let _token = null;

// ---- 内部工具 ----

async function qlFetch(path, options = {}) {
  const url = `${QL_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return res.json();
}

/**
 * 获取青龙 OpenAPI 访问令牌
 */
async function getQlToken() {
  if (_token) return _token;
  if (!CLIENT_ID || !SECRET) {
    throw new Error('未配置 QL_CLIENT_ID / QL_CLIENT_SECRET，无法自动回写 token');
  }
  const data = await qlFetch(`/open/auth/token?client_id=${CLIENT_ID}&client_secret=${SECRET}`);
  if (data.code === 200 && data.data?.token) {
    _token = data.data.token;
    return _token;
  }
  throw new Error(`获取青龙 token 失败: ${data.message || JSON.stringify(data)}`);
}

// ---- 环境变量操作 ----

/**
 * 按名称搜索环境变量，返回第一个匹配项
 * @param {string} envName  变量名（如 "KUGOU_CK"）
 * @returns {Promise<{id: number, name: string, value: string, remarks: string}|null>}
 */
async function searchEnv(envName) {
  try {
    const token = await getQlToken();
    const data = await qlFetch(`/open/envs?searchValue=${encodeURIComponent(envName)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (data.code === 200 && Array.isArray(data.data)) {
      return data.data.find((item) => item.name === envName) || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 更新环境变量值
 * @param {number} id     变量 ID
 * @param {string} name   变量名
 * @param {string} value  新值
 * @param {string} remarks 备注
 */
async function updateEnv(id, name, value, remarks = '') {
  const token = await getQlToken();
  const data = await qlFetch('/open/envs', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id, name, value, remarks }),
  });
  return data.code === 200;
}

// ---- 通知 ----

/**
 * 发送通知
 * 优先使用青龙 notify 命令，失败时静默降级
 * @param {string} title   通知标题
 * @param {string} content 通知内容
 */
async function sendNotify(title, content) {
  // 方式 1: 调用青龙内置 notify 脚本
  try {
    const qlDir = process.env.QL_DIR || '/ql';
    execSync(
      `bash "${qlDir}/data/scripts/sendNotify" "${title.replace(/"/g, '\\"')}" "${content.replace(/"/g, '\\"')}"`,
      { stdio: 'ignore', timeout: 10000 },
    );
    return;
  } catch { /* 降级 */ }

  // 方式 2: 通过 OpenAPI（需要额外配置通知渠道，此处仅记录日志）
  console.log(`[NOTIFY] ${title}\n${content}`);
}

module.exports = { searchEnv, updateEnv, sendNotify };
