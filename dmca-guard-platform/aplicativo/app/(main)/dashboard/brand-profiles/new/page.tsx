import { Footer } from '@/components/footer';

export default function NewBrandProfilePage() {
  return (
    <>
      <main className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Novo Perfil de Marca
          </h1>
          <p className="text-muted-foreground">
            Crie um novo perfil de marca para monitoramento.
          </p>
        </div>
        {/* New brand profile form */}
      </main>
      <Footer />
    </>
  );
}
