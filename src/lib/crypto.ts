/**
 * 登录/改密密码加密
 *
 * 与原 Vue 实现严格保持一致，不要"优化"：
 *   AES-CBC / Pkcs7，密钥为 32 字符的 UTF-8 原始字节（即 AES-256），
 *   随机 16 字节 IV 前置拼接到密文，整体 Base64。
 *
 * 注意：CryptoJS 由 index.html 的 <script> 全局注入，
 * 不放进 bundle，以保持与后端约定的同一份实现。
 */

const AES_KEY = 'd19ef415d060492a86bdb64b5773da44'

export function encryptPassword(plain: string): string {
  if (typeof CryptoJS === 'undefined') {
    // 全局脚本未加载时直接抛错，避免把明文密码发给后端
    throw new Error('加密组件未加载，请刷新页面重试')
  }
  const key = CryptoJS.enc.Utf8.parse(AES_KEY)
  const iv = CryptoJS.lib.WordArray.random(16)
  const encrypted = CryptoJS.AES.encrypt(plain, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  })
  const combined = iv.concat(encrypted.ciphertext)
  return combined.toString(CryptoJS.enc.Base64)
}
