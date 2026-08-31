import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Return user information including role and company_id
        return NextResponse.json({
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            role: (session.user as any).role,
            company_id: (session.user as any).company_id,
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user information' },
            { status: 500 }
        );
    }
}