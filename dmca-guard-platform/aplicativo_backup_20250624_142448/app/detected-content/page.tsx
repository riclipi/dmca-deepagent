import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import DetectedContentClient from './detected-content-client' // Assuming this will be the client component

export default function DetectedContentPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">
          Conteúdo Detectado
        </h1>
        <DetectedContentClient />
      </main>
      <Footer />
    </div>
  )
}
