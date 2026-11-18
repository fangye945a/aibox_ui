import { Link } from 'react-router'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#f2f4f5]">
      <FileQuestion className="size-12 text-border" strokeWidth={1.4} />
      <div className="text-center">
        <p className="text-[17px] font-semibold text-black/90">页面不存在</p>
        <p className="mt-1 text-[13px] text-black/60">
          请求的地址可能已变更，或设备固件版本不支持该功能。
        </p>
      </div>
      <Button asChild variant="primary">
        <Link to="/home">返回首页</Link>
      </Button>
    </div>
  )
}
