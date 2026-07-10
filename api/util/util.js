/**
 * 随机字符串
 * @param {number} len
 * @returns {string}
 */
const randomString = (len = 16) => {
  const keyString = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const _key = [];
  const keyStringArr = keyString.split('');
  for (let i = 0; i < len; i += 1) {
    const ceil = Math.ceil((keyStringArr.length - 1) * Math.random());
    const _tmp = keyStringArr[ceil];
    _key.push(_tmp);
  }
  return _key.join('');
};

/**
 * 格式化 cookie
 * @param {string} cookie
 * @returns {string}
 */
const parseCookieString = (cookie) => {
  const t = cookie.replace(/\s*(Domain|domain|path|expires)=[^(;|$)]+;*/g, '');
  return t.replace(/;HttpOnly/g, '');
};

/**
 * cookie 字符串转 json 对象
 * @param {string} cookie
 * @returns {Record<string, string>}
 */
const cookieToJson = (cookie) => {
  if (!cookie) return {};
  let cookieArr = cookie.split(';');
  let obj = {};
  cookieArr.forEach((i) => {
    let arr = i.split('=');
    obj[arr[0]] = arr[1];
  });
  return obj;
};

module.exports = {
  cookieToJson,
  parseCookieString,
  randomString,
};
