import { useCallback, useEffect, useRef, useState } from 'react'

/** 每秒自增的运行时长计时器，来源为后端返回的 boot_time（已运行秒数） */
export function useUptime(bootTime: number | undefined) {
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (bootTime === undefined || bootTime === null || bootTime < 0) return
    setSeconds(bootTime)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [bootTime])

  return seconds
}

/** 轮询 hook，interval 为 null 时停止 */
export function usePolling(fn: () => void | Promise<void>, intervalMs: number | null) {
  const savedFn = useRef(fn)
  savedFn.current = fn

  useEffect(() => {
    if (!intervalMs) return
    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      await savedFn.current()
    }
    void tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])
}

/** 本地存储布尔开关，用于「正则/忽略大小写」这类偏好持久化 */
export function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* 隐私模式或配额不足时静默失败 */
    }
  }, [key, value])

  return [value, setValue] as const
}

/** 防抖回调 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFn = useRef(fn)
  savedFn.current = fn

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const run = useCallback(
    (...args: A) => {
      cancel()
      timer.current = setTimeout(() => savedFn.current(...args), delay)
    },
    [cancel, delay],
  )

  useEffect(() => cancel, [cancel])

  return run
}
