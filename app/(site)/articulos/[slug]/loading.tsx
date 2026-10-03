import { Loading as LoadingComponent } from '@/components/ui'

export default function ArticleLoading() {
  return (
    <main className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="section-container max-w-4xl pt-8">
        <LoadingComponent variant="article" />
      </div>
    </main>
  )
}
