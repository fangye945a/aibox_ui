import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { User, Lock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { login } from '@/api/common'
import { encryptPassword } from '@/lib/crypto'
import { IS_FIRST_KEY, TOKEN_KEY } from '@/lib/utils'

const schema = z.object({
  user_name: z.string().min(1, '账号不能为空'),
  password: z.string().min(1, '密码不能为空'),
})

type FormValues = z.infer<typeof schema>

const MOCK_HINT = import.meta.env.DEV ? import.meta.env.VITE_MOCK_HINT ?? '' : ''

/**
 * 登录页 — 还原原工程 login.vue
 *
 * 原样式（提取自 login.vue 的 SCSS）：
 *   外层    background: url(bj.png) no-repeat center #E6EEF5
 *   内容    宽度 60%，居中
 *   表单卡  460×600，白底，padding 40px 38px，右对齐
 *   标题    24px 加粗，下内距 30px
 *   输入框  高 48px
 *   说明    12px，rgba(0,0,0,.4)
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { user_name: '', password: '' },
  })

  async function onSubmit(values: FormValues) {
    try {
      const res = await login({
        user_name: values.user_name,
        password: encryptPassword(values.password),
      })
      localStorage.setItem(TOKEN_KEY, res.data.token)
      localStorage.setItem(IS_FIRST_KEY, String(res.data.is_first_login))
      toast.success('登录成功')
      const redirect = params.get('redirect') || '/'
      navigate(decodeURIComponent(redirect), { replace: true })
    } catch {
      /* 请求层已按错误类型提示 */
    }
  }

  return (
    <div
      className="flex h-full w-full items-center bg-[#e6eef5]"
      style={{
        backgroundImage: `url(${new URL('@/assets/img/bj.png', import.meta.url).href})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
    >
      <div className="mx-auto w-full max-w-[1152px]">
        {/* 右侧表单卡：460 宽、白底、40px 38px 内距 */}
        <div className="ml-auto w-[460px] bg-white px-[38px] py-10">
          <p className="text-[24px] leading-normal font-bold text-black">
            使用本地管理账号登录
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-[30px]">
            <div className="relative mb-6">
              <User className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#c0c4cc]" />
              <input
                className="h-12 w-full border border-[#dcdfe6] pr-4 pl-11 text-[14px] text-[#606266] transition-colors placeholder:text-[#a8abb2] hover:border-[#c0c4cc] focus:border-[#409eff] focus:outline-none"
                placeholder="请输入账号"
                autoComplete="username"
                {...register('user_name')}
              />
            </div>

            <div className="relative mb-2">
              <Lock className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#c0c4cc]" />
              <input
                className="h-12 w-full border border-[#dcdfe6] pr-4 pl-11 text-[14px] text-[#606266] transition-colors placeholder:text-[#a8abb2] hover:border-[#c0c4cc] focus:border-[#409eff] focus:outline-none"
                type="password"
                placeholder="请输入密码"
                autoComplete="current-password"
                {...register('password')}
              />
            </div>

            <div className="mb-2 min-h-[20px]">
              {(errors.user_name || errors.password) && (
                <p className="text-[13px] text-[#f56c6c]">
                  {errors.user_name?.message || errors.password?.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="h-12 w-full rounded-[2px] text-[15px]"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              登 录
            </Button>
          </form>

          <p className="mt-3 text-[12px] leading-relaxed text-black/40">
            初始账号和密码请联系销售人员，注意账号资料的保密，并经常修改密码
          </p>

          {MOCK_HINT && (
            <div className="mt-5 border border-dashed border-[#c6e2ff] bg-[#f0f6fe] px-3 py-2">
              <p className="text-[12px] text-[#409eff]">演示模式 · 未接真实设备</p>
              <p className="mt-0.5 text-[12px] text-black/60">
                账号 <span className="font-mono">{MOCK_HINT}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
