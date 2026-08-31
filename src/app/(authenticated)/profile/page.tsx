import { getServerSession, authOptions } from "@/lib/auth";
import { ProfileClient } from "@/components/profile";

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-muted-foreground">Please sign in to view your profile.</p>
            </div>
        );
    }

    const extendedUser = session.user as any;

    return <ProfileClient user={{
        id: extendedUser?.id || session.user.id || '',
        name: extendedUser?.name || session.user.name || null,
        email: extendedUser?.email || session.user.email || null,
        role: extendedUser?.role || null,
        company_id: extendedUser?.company_id || null,
        profile_photo: extendedUser?.profile_photo || null
    }} />;
}
