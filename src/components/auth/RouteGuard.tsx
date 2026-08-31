import { Action, Module, hasPermission } from '@/lib/permissions';
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth';
import { AccessDenied } from './AccessDenied';
import { redirect } from 'next/navigation';

interface RouteGuardProps {
    module: Module;
    action?: Action;
    children: React.ReactNode;
}

export async function RouteGuard({ module, action = 'READ', children }: RouteGuardProps) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        redirect('/login');
    }

    const role = (session.user as any).role as any;

    if (!hasPermission(role, module, action)) {
        return <AccessDenied />;
    }

    return <>{children}</>;
}
