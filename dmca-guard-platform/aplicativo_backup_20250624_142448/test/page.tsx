import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Página de Teste
          </h1>
          <p className="text-muted-foreground">
            Esta é uma página de teste para validação.
          </p>
        </div>
        {/* Test content */}
      </main>
      <Footer />
    </div>
  );
}
