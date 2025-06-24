import { Footer } from '@/components/footer';

export default function NewMonitoringPage() {
  return (
    <>
      <main className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Nova Sessão de Monitoramento
          </h1>
          <p className="text-muted-foreground">
            Configure uma nova sessão de monitoramento.
          </p>
        </div>
        {/* New monitoring session form */}
      </main>
      <Footer />
    </>
  );
}
