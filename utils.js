// ============================================================
// 工具函数 —— 日志脱敏、cookie 解析、延时等
// ============================================================

const SENSITIVE_KEYS = new Set([
  'token', 'vip_token', 'viptoken', 'cookie', 'authorization',
  'pat', 'gh_token', 'userinfo', 'password', 'code',
  'mobile', 'phone', 'qrcode', 'key',
]);

const DISPLAY_NAME_KEYS = new Set(['nickname', 'username', 'display_name', 'displayname']);
const IDENTIFIER_KEYS = new Set(['userid', 'user_id', 'uid', 'kguid', 'kugouid', 't_userid']);

// ---- 日志前缀（替代 ANSI 彩色输出，适配青龙面板） ----

function log(level, msg) {
  const ts = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  console.log(`[${ts}] [${level}] ${msg}`);
}

export const logInfo  = (msg) => log('INFO', msg);
export const logWarn  = (msg) => log('WARN', msg);
export const logError = (msg) => log('ERROR', msg);
export const logSuccess = (msg) => log('SUCCESS', msg);

// ---- 延时 ----

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Cookie 工具 ----

/**
 * 解析 KUGOU_CK 环境变量
 * 格式：userid1#token1@userid2#token2
 * @param {string} envValue
 * @returns {Array<{userid: string, token: string}>}
 */
export function parseKgCookie(envValue) {
  if (!envValue || !envValue.trim()) {
    throw new Error('KUGOU_CK 环境变量未配置或为空');
  }
  return envValue.split('@').map((item) => {
    const parts = item.trim().split('#');
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      throw new Error(`KUGOU_CK 格式错误，期望 userid#token，实际: ${item}`);
    }
    return { userid: parts[0].trim(), token: parts[1].trim() };
  });
}

// ---- 脱敏工具 ----

function sanitizeString(value) {
  return value
    .replace(/(github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]{20,})/g, '[REDACTED]')
    .replace(/(?<!\d)(1[3-9]\d{9})(?!\d)/g, (phone) => `${phone.slice(0, 2)}*******${phone.slice(-2)}`);
}

export function maskDisplayName(value) {
  const text = String(value ?? '');
  const chars = Array.from(text);
  if (chars.length === 0) return '';
  if (chars.length === 1) return `${chars[0]}********`;
  if (chars.length === 2) return `${chars[0]}********${chars[1]}`;
  return `${chars.slice(0, 2).join('')}********${chars[chars.length - 1]}`;
}

export function maskIdentifier(value) {
  const text = String(value ?? '');
  const chars = Array.from(text);
  if (chars.length === 0) return '';
  if (chars.length <= 2) return '*'.repeat(chars.length);
  if (chars.length <= 6) return `${chars[0]}***${chars[chars.length - 1]}`;
  return `${chars.slice(0, 3).join('')}***${chars.slice(-2).join('')}`;
}

function redactValue(key, value) {
  const nk = String(key).toLowerCase();
  if (DISPLAY_NAME_KEYS.has(nk)) return maskDisplayName(value);
  if (IDENTIFIER_KEYS.has(nk)) return maskIdentifier(value);
  if (SENSITIVE_KEYS.has(nk)) return '[REDACTED]';
  if (typeof value === 'string') return sanitizeString(value);
  return value;
}

export function sanitizeForLog(value, depth = 0) {
  if (value == null) return value;
  if (typeof value !== 'object') return typeof value === 'string' ? sanitizeString(value) : value;
  if (depth >= 4) return '[Object]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeForLog(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, sanitizeForLog(redactValue(k, v), depth + 1)]),
  );
}

export function summarizeResponse(response) {
  const safe = sanitizeForLog(response);
  if (!safe || typeof safe !== 'object') return safe;

  const summary = {};
  for (const key of ['status', 'code', 'error_code', 'errcode', 'error', 'msg', 'message', 'httpStatus']) {
    if (safe[key] !== undefined) summary[key] = safe[key];
  }
  if (safe.data && typeof safe.data === 'object') {
    summary.data = {};
    for (const key of ['status', 'code', 'error_code', 'errcode', 'msg', 'message', 'nickname', 'userid']) {
      if (safe.data[key] !== undefined) summary.data[key] = safe.data[key];
    }
  }
  return Object.keys(summary).length > 0 ? summary : safe;
}
