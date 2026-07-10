// ============================================================
// 酷狗 API 封装层 —— 直接调用模块函数，不经过 HTTP/Express
// ============================================================
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// 设置概念版标识（影响签名密钥、appid、RSA 公钥等）
// 用户配置 KG_PLATFORM=lite，桥接到内部 process.env.platform 供 API 模块读取
process.env.platform = process.env.KG_PLATFORM || process.env.platform || 'lite';

// 加载底层请求工具
const { createRequest } = require('./api/util/request');

// 加载需要的 5 个 API 模块
const userDetailMod    = require('./api/module/user_detail');
const loginTokenMod    = require('./api/module/login_token');
const listenSongMod    = require('./api/module/youth_listen_song');
const vipMod           = require('./api/module/youth_vip');
const vipDetailMod     = require('./api/module/user_vip_detail');

/**
 * 通用模块调用器
 * 将 cookie 对象传给模块，内部走 createRequest 做签名/加密/发请求
 * 返回值为 API 响应的 body 对象（成功时）或错误信息对象
 */
async function callModule(modFn, cookie) {
  try {
    const res = await modFn({ cookie }, createRequest);
    // createRequest resolve: { status: 200, body, cookie, headers }
    if (res.status === 200) return res.body;
    // resolve 但 status 非 200（不应出现，兜底处理）
    return res.body || res;
  } catch (err) {
    // createRequest reject: answer 对象 { status: 502, body, cookie }
    if (err && err.body) return err.body;
    return { status: 0, msg: err?.message || '请求失败' };
  }
}

// ---- 导出 5 个业务函数 ----

/**
 * 获取用户信息（验证 token 有效性）
 * @param {{userid: string, token: string}} cookie
 */
export function getUserDetail(cookie) {
  return callModule(userDetailMod, cookie);
}

/**
 * 刷新登录 token
 * @param {{userid: string, token: string}} cookie
 */
export function refreshToken(cookie) {
  return callModule(loginTokenMod, cookie);
}

/**
 * 听歌领取 VIP
 * @param {{userid: string, token: string}} cookie
 */
export function listenSong(cookie) {
  return callModule(listenSongMod, cookie);
}

/**
 * 看广告领取 VIP
 * @param {{userid: string, token: string}} cookie
 */
export function watchAd(cookie) {
  return callModule(vipMod, cookie);
}

/**
 * 获取 VIP 到期信息
 * @param {{userid: string, token: string}} cookie
 */
export function getVipDetail(cookie) {
  return callModule(vipDetailMod, cookie);
}
