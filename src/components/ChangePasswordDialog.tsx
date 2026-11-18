import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changePwd } from '@/api/common'
import { encryptPassword } from '@/lib/crypto'

/** 校验规则与原 upPwd.vue 等价：当前密码必填、新密码 8-20 位、两次一致 */
const schema = z
  .object({
    current_password: z.string().min(1, '请输入当前密码'),
    new_password: z
      .string()
      .min(8, '密码长度至少 8 位')
      .max(20, '密码长度不能超过 20 位'),
    checkPwd: z.string().min(1, '请再次输入密码'),
  })
  .refine((v) => v.new_password === v.checkPwd, {
    message: '两次输入密码不一致',
    path: ['checkPwd'],
  })

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 首次登录强制改密：不允许关闭遮罩与 Esc */
  forced?: boolean
  onSuccess?: () => void
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  forced = false,
  onSuccess,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', new_password: '', checkPwd: '' },
  })

  // 关闭时重置，避免下次打开残留旧输入
  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  async function onSubmit(values: FormValues) {
    try {
      await changePwd({
        current_password: encryptPassword(values.current_password),
        new_password: encryptPassword(values.new_password),
      })
      toast.success('密码修改成功')
      onOpenChange(false)
      onSuccess?.()
    } catch {
      /* 错误提示已由请求层统一处理 */
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (forced && !v) return
        onOpenChange(v)
      }}
    >
      <DialogContent
        className="max-w-[440px]"
        onPointerDownOutside={(e) => forced && e.preventDefault()}
        onEscapeKeyDown={(e) => forced && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{forced ? '首次登录，请修改初始密码' : '修改密码'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-4">
            {forced && (
              <p className="rounded-[6px] bg-warning/10 px-3 py-2 text-xs leading-relaxed text-[#e6a23c]">
                为保障设备安全，首次登录必须修改初始密码后才能使用控制台其他功能。
              </p>
            )}

            <Field label="当前密码" error={errors.current_password?.message}>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="请输入当前密码"
                {...register('current_password')}
              />
            </Field>

            <Field label="新密码" error={errors.new_password?.message}>
              <Input
                type="password"
                autoComplete="new-password"
                maxLength={20}
                placeholder="请输入长度为 8-20 位的新密码"
                {...register('new_password')}
              />
            </Field>

            <Field label="确认密码" error={errors.checkPwd?.message}>
              <Input
                type="password"
                autoComplete="new-password"
                maxLength={20}
                placeholder="请再次输入新密码"
                {...register('checkPwd')}
              />
            </Field>
          </DialogBody>

          <DialogFooter>
            {!forced && (
              <Button type="button" onClick={() => onOpenChange(false)}>
                取消
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-[#f56c6c]">{error}</p>}
    </div>
  )
}
