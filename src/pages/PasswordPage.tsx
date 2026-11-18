import { useState } from 'react'
import { Info, KeyRound, ShieldCheck, Lock } from 'lucide-react'
import { Panel, PanelTitle, PageHeader } from '@/components/ui/layout-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog'

/** 账号安全 · 修改密码 */
export default function PasswordPage() {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <PageHeader title="账号安全" description="管理控制台本地登录密码，建议定期更换。" />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="p-5">
          <div className="flex items-start gap-2.5 rounded-[6px] bg-[#f0f6fe] px-3.5 py-3">
            <Info className="mt-px size-4 shrink-0 text-[#007cf7]" />
            <p className="text-[12.5px] leading-relaxed text-black/90">
              请注意保护好您的本地控制台登录密码。密码以 AES 加密后传输，设备端不保存明文。
            </p>
          </div>

          <div className="mt-8 mb-8 flex flex-col items-center gap-3">
            <div className="grid size-14 place-items-center rounded-full bg-[rgba(0,124,247,0.08)]">
              <KeyRound className="size-6 text-[#007cf7]" strokeWidth={1.8} />
            </div>
            <div className="flex w-full max-w-[300px] items-center gap-3">
              <span className="shrink-0 text-[13px] text-black/60">登录密码</span>
              <Input type="password" value="********" readOnly className="tracking-widest" />
            </div>
            <Button variant="primary" className="mt-2" onClick={() => setOpen(true)}>
              修改密码
            </Button>
          </div>
        </Panel>

        <div className="space-y-3">
          <Panel className="p-4">
            <PanelTitle>密码策略</PanelTitle>
            <ul className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-black/90">
              {[
                '长度 8 - 20 位，需包含字母与数字',
                '不得与账号名相同或包含连续字符',
                '首次登录必须修改初始密码',
                '修改成功后当前会话保持有效',
              ].map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#007cf7]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-px size-4 shrink-0 text-[#67c23a]" />
              <div>
                <p className="text-[12.5px] font-medium text-black/90">传输安全</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-black/60">
                  密码采用 AES-256-CBC 加密并携带随机 IV，与设备端密钥固定协商，全程不出现明文。
                </p>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start gap-2.5">
              <Lock className="mt-px size-4 shrink-0 text-black/60" />
              <div>
                <p className="text-[12.5px] font-medium text-black/90">忘记密码</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-black/60">
                  设备不支持在线找回。请联系技术支持通过本地串口或恢复出厂方式重置。
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <ChangePasswordDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
