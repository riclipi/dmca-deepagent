// dmca-guard-platform/app/app/dashboard/page.tsx

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import DashboardClient from './dashboard-client'; // Importa nosso novo componente

export default async function DashboardPage() {
  // 1. Busca a sessão no servidor
  const session = await getServerSession(authOptions);

  // 2. Renderiza o componente de cliente, passando a sessão como prop
  return <DashboardClient session={session} />;
}