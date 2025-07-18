import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import TakedownRequestsClient from './takedown-requests-client';

export default function TakedownRequestsDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Dashboard de Solicitações de Takedown
                </h1>
                <p className="text-muted-foreground">
                  Acompanhe e gerencie o status das suas solicitações de remoção de conteúdo.
                </p>
            </div>
        </div>
        <TakedownRequestsClient />
      </main>
      <Footer />
    </div>
  );
}
