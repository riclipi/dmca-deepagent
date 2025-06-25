import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import WhitelistClient from './whitelist-client';

export default function WhitelistPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Gerenciar Domínios na Whitelist
          </h1>
          <p className="text-muted-foreground">
            Adicione ou remova domínios que devem ser ignorados durante o monitoramento.
          </p>
        </div>
        <WhitelistClient />
      </main>
      <Footer />
    </div>
  );
}
