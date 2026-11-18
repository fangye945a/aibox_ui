/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_URL: string
  readonly VITE_MOCK: string
  readonly VITE_MOCK_HINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** index.html 通过 <script> 全局引入的 CryptoJS */
declare const CryptoJS: {
  enc: {
    Utf8: { parse(v: string): unknown }
    Base64: unknown
  }
  lib: {
    WordArray: {
      random(n: number): { concat(o: unknown): { toString(enc: unknown): string } }
    }
  }
  AES: {
    encrypt(
      data: string,
      key: unknown,
      opts: { iv: unknown; mode: unknown; padding: unknown },
    ): { ciphertext: unknown }
  }
  mode: { CBC: unknown }
  pad: { Pkcs7: unknown }
}
