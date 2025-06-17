import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Adjust path as needed
import { prisma } from '@/lib/prisma'; // Adjust path as needed
import { createAuditLog } from '@/lib/audit'; // Adjust path as needed
import { domainWhitelistSchema } from '@/lib/validations'; // Adjust path as needed
// import { getPlanLimits, canPerformAction } from '@/lib/plans'; // Uncomment if plan limits are to be implemented

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const whitelistedDomains = await prisma.domainWhitelist.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        domain: 'asc', // Or createdAt: 'desc'
      },
    });

    return NextResponse.json(whitelistedDomains);
  } catch (error) {
    console.error('Erro ao buscar whitelist de domínios:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validation = domainWhitelistSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: validation.error.flatten() }, { status: 400 });
    }

    const { domain: normalizedDomain } = validation.data; // Zod transform handles normalization

    // Optional: Check plan limits
    // const planLimits = getPlanLimits(session.user.planType);
    // if (!canPerformAction(await prisma.domainWhitelist.count({ where: { userId: session.user.id } }), planLimits.domainWhitelists)) {
    //   return NextResponse.json({ error: `Limite de domínios na whitelist atingido para o plano ${session.user.planType}.` }, { status: 403 });
    // }

    // Check if domain already exists for this user
    const existingWhitelistEntry = await prisma.domainWhitelist.findUnique({
      where: {
        user_domain_unique: { // Using the @@unique name from schema.prisma
          userId: session.user.id,
          domain: normalizedDomain,
        },
      },
    });

    if (existingWhitelistEntry) {
      return NextResponse.json({ error: 'Este domínio já está na sua whitelist.' }, { status: 409 }); // 409 Conflict
    }

    const newWhitelistEntry = await prisma.domainWhitelist.create({
      data: {
        userId: session.user.id,
        domain: normalizedDomain,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'domain_whitelist_add',
      resource: 'DomainWhitelist',
      resourceId: newWhitelistEntry.id,
      details: { domain: normalizedDomain },
    });

    return NextResponse.json(newWhitelistEntry, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao adicionar domínio à whitelist:', error);
    if (error.code === 'P2002') { // Prisma unique constraint violation
        return NextResponse.json({ error: 'Este domínio já está na sua whitelist (P2002).' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
