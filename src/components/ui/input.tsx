import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Input — 还原 el-input 观感
 *
 * Element Plus 默认：高度 32px、圆角 4px、边框 #dcdfe6、
 * 聚焦边框 #409eff、占位符 #a8abb2。
 */
const base = [
  'flex h-8 w-full rounded-[4px] border border-[#dcdfe6] bg-white px-2.5',
  'text-[14px] text-[#606266] transition-colors duration-150',
  'placeholder:text-[#a8abb2]',
  'hover:border-[#c0c4cc]',
  'focus:border-[#409eff] focus:outline-none',
  'disabled:cursor-not-allowed disabled:bg-[#f5f7fa] disabled:text-[#a8abb2]',
].join(' ')

export function Input({
  className,
  type = 'text',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { type?: string }) {
  return <input type={type} className={cn(base, className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(base, 'h-auto py-2 leading-relaxed', className)} {...props} />
  )
}
