// ============================================================
// 酷狗概念 VIP 每日签到 —— 青龙面板入口脚本
// ============================================================
import {
  parseKgCookie, logInfo, logWarn, logError, logSuccess,
  delay, maskDisplayName, maskIdentifier, summarizeResponse,
} from './utils.js';
import {
  getUserDetail, refreshToken, listenSong, watchAd, getVipDetail,
} from './kugouApi.js';
import { searchEnv, updateEnv, sendNotify } from './qlApi.js';

async function main() {
  logInfo('========== 酷狗概念 VIP 每日签到 ==========');

  // 解析账号列表
  const accounts = parseKgCookie(process.env.KUGOU_CK);
  logInfo(`共 ${accounts.length} 个账号`);

  const now = new Date();
  const isSunday = now.getDay() === 0;
  const canWriteBack = !!(process.env.QL_CLIENT_ID && process.env.QL_CLIENT_SECRET);
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let tokenChanged = false;
  const errors = {};

  for (let i = 0; i < accounts.length; i++) {
    const user = accounts[i];
    const cookie = { userid: user.userid, token: user.token };
    const tag = `账号${i + 1}`;

    logInfo(`${tag} 验证 token...`);

    // 1. 验证 token
    const userDetail = await getUserDetail(cookie);
    if (userDetail?.data?.nickname == null) {
      const safeId = maskIdentifier(user.userid);
      logError(`${tag} token 过期或账号不存在, userid: ${safeId}`);
      errors[`${tag}(${safeId})`] = {
        msg: 'token 过期或账号不存在',
        detail: summarizeResponse(userDetail),
      };
      continue;
    }

    const nickname = maskDisplayName(userDetail.data.nickname);
    logInfo(`${tag} [${nickname}] 开始签到`);

    // 2. 周日刷新 token（仅在配置了 OpenAPI 凭证时执行，避免刷新后无法回写导致旧 token 失效）
    if (isSunday && canWriteBack) {
      logInfo(`${tag} 刷新 token...`);
      const refreshResult = await refreshToken(cookie);
      if (refreshResult?.status == 1 && refreshResult?.data?.token) {
        if (refreshResult.data.token !== user.token) {
          user.token = refreshResult.data.token;
          cookie.token = user.token;
          tokenChanged = true;
          logSuccess(`${tag} token 已刷新`);
        } else {
          logInfo(`${tag} token 无需刷新`);
        }
      } else {
        logWarn(`${tag} token 刷新失败，继续使用旧 token`);
      }
    } else if (isSunday && !canWriteBack) {
      logInfo(`${tag} 跳过 token 刷新（未配置 QL_CLIENT_ID / QL_CLIENT_SECRET，无法回写新 token）`);
    }

    // 3. 听歌领 VIP
    logInfo(`${tag} 听歌领取 VIP...`);
    const listen = await listenSong(cookie);
    if (listen?.status === 1) {
      logSuccess(`${tag} 听歌领取成功`);
    } else if (listen?.error_code === 130012) {
      logInfo(`${tag} 听歌今日已领取`);
    } else {
      logError(`${tag} 听歌领取失败`);
      errors[`${tag}(${nickname}) listen`] = summarizeResponse(listen);
    }

    // 4. 看广告领 VIP（最多 8 次，间隔 30 秒）
    logInfo(`${tag} 看广告领取 VIP...`);
    for (let j = 1; j <= 8; j++) {
      const ad = await watchAd(cookie);
      if (ad?.status === 1) {
        logSuccess(`${tag} 第${j}次广告领取成功`);
        if (j < 8) await delay(30 * 1000);
      } else if (ad?.error_code === 30002) {
        logInfo(`${tag} 今日广告次数已用完`);
        break;
      } else if (ad?.error_code === 20028) {
        logInfo(`${tag} 广告奖励今日已领取`);
        break;
      } else {
        logError(`${tag} 第${j}次广告领取失败`);
        errors[`${tag}(${nickname}) ad`] = summarizeResponse(ad);
        break;
      }
    }

    // 5. 查询 VIP 到期时间
    const vipDetail = await getVipDetail(cookie);
    if (vipDetail?.status === 1) {
      const endTime = vipDetail.data?.busi_vip?.[0]?.vip_end_time || '未知';
      logInfo(`${tag} VIP 到期时间: ${endTime}`);
    } else {
      logWarn(`${tag} 获取 VIP 到期时间失败`);
      errors[`${tag}(${nickname}) vip_detail`] = summarizeResponse(vipDetail);
    }

    logInfo(`${tag} [${nickname}] 签到完成\n`);
  }

  // 6. Token 回写 + 验证
  if (tokenChanged) {
    const newValue = accounts.map((u) => `${u.userid}#${u.token}`).join('@');
    logInfo('检测到 token 变更，尝试回写环境变量...');
    logInfo(`最新 KUGOU_CK: ${newValue}`);

    let writeOk = false;
    try {
      const envItem = await searchEnv('KUGOU_CK');
      if (envItem) {
        const updated = await updateEnv(envItem.id, 'KUGOU_CK', newValue, envItem.remarks || '');
        if (updated) {
          // 回读验证
          const verify = await searchEnv('KUGOU_CK');
          if (verify && verify.value === newValue) {
            logSuccess('KUGOU_CK 已自动更新并验证成功');
            writeOk = true;
          } else {
            logWarn('KUGOU_CK 写回后验证不一致');
          }
        } else {
          logWarn('KUGOU_CK 更新失败，请检查青龙 OpenAPI 权限');
        }
      } else {
        logWarn('未找到 KUGOU_CK 环境变量，无法自动更新');
      }
    } catch (e) {
      logWarn(`token 自动回写异常: ${e.message}`);
    }

    if (!writeOk) {
      logWarn('请手动更新 KUGOU_CK，否则 token 将在约两个月后过期');
      await sendNotify(
        '酷狗签到 - Token 更新提醒',
        `Token 已刷新但自动回写未成功，请手动更新 KUGOU_CK。\n最新值:\n${newValue}`,
      );
    }
  }

  // 7. 结果汇总
  if (Object.keys(errors).length > 0) {
    logError('签到过程中存在异常:');
    console.log(JSON.stringify(summarizeResponse(errors), null, 2));

    const errorSummary = Object.entries(errors)
      .map(([k, v]) => `- ${k}: ${v.msg || JSON.stringify(v)}`)
      .join('\n');

    await sendNotify(
      `酷狗签到 ${dateStr}`,
      `${accounts.length} 个账号签到完成，存在异常:\n${errorSummary}`,
    );
    process.exit(1);
  }

  logSuccess(`========== ${dateStr} 签到全部完成 ==========`);
  await sendNotify(`酷狗签到 ${dateStr}`, `${accounts.length} 个账号全部签到成功`);
}

main().catch(async (err) => {
  logError(`签到脚本异常退出: ${err.message}`);
  try {
    await sendNotify('酷狗签到异常', err.message);
  } catch { /* 通知失败则静默 */ }
  process.exit(1);
});
