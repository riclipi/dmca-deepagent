import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export default function MonitoringPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Sessões de Monitoramento
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas sessões de monitoramento ativas.
          </p>
        </div>
        {/* Monitoring sessions content */}
      </main>
      <Footer />
    </div>
  );
}
