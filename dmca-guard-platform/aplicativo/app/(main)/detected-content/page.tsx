// Header and Footer moved to (main) layout
import DetectedContentClient from './detected-content-client'

export default function DetectedContentPage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-foreground mb-8">
        Conteudo Detectado
      </h1>
      <DetectedContentClient />
    </div>
  )
}