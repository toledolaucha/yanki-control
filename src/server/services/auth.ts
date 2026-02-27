import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function getUser() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;

    const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (dbUser) return { ...session.user, id: dbUser.id };

    const byEmail = await prisma.user.findUnique({ where: { email: session.user.email! } });
    if (byEmail) return { ...session.user, id: byEmail.id, role: byEmail.role };

    return null;
}
