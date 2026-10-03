import { Loading as LoadingComponent } from '@/components/ui'

export default function Loading() {
  return (
    <main className="flex-grow pt-[var(--header-height)] pb-24 max-w-[1200px] mx-auto px-6 md:px-8 w-full">
      <LoadingComponent variant="home" className="mt-6" />
    </main>
  )
}
