import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export default function BrandProfilesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Perfis de Marca
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus perfis de marca para monitoramento.
          </p>
        </div>
        {/* Brand profiles content */}
      </main>
      <Footer />
    </div>
  );
}
