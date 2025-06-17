import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Adjust path as needed
import { prisma } from '@/lib/prisma'; // Adjust path as needed
import { createAuditLog } from '@/lib/audit'; // Adjust path as needed

interface RouteParams {
  params: {
    id: string;
  };
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'ID do item da whitelist é obrigatório' }, { status: 400 });
    }

    // Verify the whitelist entry exists and belongs to the user
    const whitelistEntry = await prisma.domainWhitelist.findUnique({
      where: { id },
    });

    if (!whitelistEntry) {
      return NextResponse.json({ error: 'Item da whitelist não encontrado' }, { status: 404 });
    }

    if (whitelistEntry.userId !== session.user.id) {
      // This check is crucial to prevent users from deleting others' entries
      await createAuditLog({
        userId: session.user.id,
        action: 'domain_whitelist_delete_attempt_forbidden',
        resource: 'DomainWhitelist',
        resourceId: id,
        details: { targetUserId: whitelistEntry.userId, domain: whitelistEntry.domain, reason: "Forbidden access" },
      });
      return NextResponse.json({ error: 'Acesso negado. Você não tem permissão para remover este item.' }, { status: 403 });
    }

    // Delete the whitelist entry
    const deletedEntry = await prisma.domainWhitelist.delete({
      where: {
        id: id,
        // We can add userId here again for an extra layer, though the check above should suffice
        // userId: session.user.id,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'domain_whitelist_delete',
      resource: 'DomainWhitelist',
      resourceId: deletedEntry.id, // Use id of the deleted entry from the result
      details: { domain: deletedEntry.domain },
    });

    return NextResponse.json({ message: 'Domínio removido da whitelist com sucesso', deletedDomain: deletedEntry.domain }, { status: 200 });
  } catch (error) {
    console.error('Erro ao remover domínio da whitelist:', error);
    // It's good to check for specific Prisma errors, e.g., P2025 (Record to delete does not exist)
    // though our initial findUnique should catch it.
    if ((error as any).code === 'P2025') {
        return NextResponse.json({ error: 'Item da whitelist não encontrado para exclusão (P2025).' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
