import Image from 'next/image'

type BrandLogoProps = {
  size?: 'sm' | 'lg'
  tone?: 'dark' | 'light'
}

export function BrandMark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const dimension = size === 'lg' ? 96 : 36
  return (
    <Image
      src="/nexago-logo.png"
      alt=""
      width={dimension}
      height={dimension}
      priority
      className={size === 'lg' ? 'size-24 rounded-[28px] object-cover' : 'size-9 rounded-xl object-cover'}
    />
  )
}

export function BrandWordmark({ size = 'sm', tone = 'dark' }: BrandLogoProps) {
  return (
    <span className={`font-black tracking-tight ${size === 'lg' ? 'text-4xl' : 'text-lg'} ${tone === 'light' ? 'text-white' : 'text-slate-900'}`}>
      Nexa<span className={tone === 'light' ? 'text-orange-400' : 'text-orange-500'}>Go</span>
    </span>
  )
}

export function BrandLogo({ size = 'sm', tone = 'dark' }: BrandLogoProps) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={size} />
      <BrandWordmark size={size} tone={tone} />
    </span>
  )
}
