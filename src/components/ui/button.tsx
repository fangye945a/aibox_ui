import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Button — 还原原工程的 Element Plus 按钮观感
 *
 * 原工程用 el-button（默认 32px 高、14px 字号、2px 圆角）与
 * .btn-primary（#1890FF 底、9px 10px 内距）。
 * 这里用 Tailwind 复刻同样的尺寸与色值，不引入新的设计语言。
 *
 * 色值来源（原 SCSS）：
 *   主色按钮  #1890FF  hover #62a2fa
 *   危险按钮  #ff6464  hover #f47d7d
 *   描边按钮  #4C95FB 边框，白底，hover #f6faff
 *   默认按钮  #fff 底，#dcdcdc 边框
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-nowrap select-none',
    'font-normal transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-60 disabled:cursor-not-allowed',
  ].join(' '),
  {
    variants: {
      variant: {
        // el-button type="primary"
        primary: 'bg-[#1890ff] text-white hover:bg-[#62a2fa] rounded-[2px]',
        // el-button 默认
        default:
          'bg-white text-[#606266] border border-[#dcdcdc] hover:text-[#409eff] hover:border-[#c6e2ff] hover:bg-[#ecf5ff] rounded-[2px]',
        // .btn-default 描边
        outline:
          'bg-white text-[#4c95fb] border border-[#4c95fb] hover:bg-[#f6faff] rounded-[2px]',
        // el-button text
        text: 'bg-transparent text-[#409eff] border-none hover:text-[#66b1ff] hover:bg-transparent px-1',
        // el-button type="danger"
        danger: 'bg-[#ff6464] text-white hover:bg-[#f47d7d] rounded-[2px]',
        // el-button link
        link: 'bg-transparent text-[#409eff] border-none px-0 hover:text-[#66b1ff]',
      },
      size: {
        sm: 'h-7 px-2.5 text-[13px]',
        default: 'h-8 px-3 text-[14px]',
        lg: 'h-10 px-5 text-[14px]',
        icon: 'h-8 w-8 rounded-[2px]',
        'icon-sm': 'h-7 w-7 rounded-[2px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
}

export { buttonVariants }
