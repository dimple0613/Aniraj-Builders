import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userRole = (session?.user as any)?.role;
        const userId = (session?.user as any)?.id;
        const userZoneId = (session?.user as any)?.zone_id;

        if (!userId) {
            return NextResponse.json(errorResponse('Unauthorized'), { status: 401 });
        }

        if (userRole !== 'Zone') {
            return NextResponse.json(
                errorResponse('Only Zone Officers can approve zones'),
                { status: 403 }
            );
        }

        if (!userZoneId) {
            return NextResponse.json(
                errorResponse('No zone assigned to this user'),
                { status: 400 }
            );
        }

        const body = await request.json();
        const { zone_id, vardhi_ids } = body;

        if (!zone_id || !Array.isArray(vardhi_ids)) {
            return NextResponse.json(
                errorResponse('Zone ID and vardhi_ids array are required'),
                { status: 400 }
            );
        }

        // Zone Officers can only approve their own assigned zone
        if (zone_id !== userZoneId) {
            return NextResponse.json(
                errorResponse('You can only approve your own assigned zone'),
                { status: 403 }
            );
        }

        // Look up zone directly (no company_id filter needed since we verified user's zone)
        const zone = await prisma.zoneMaster.findUnique({
            where: { id: zone_id },
            include: {
                users: { select: { id: true } }
            }
        });

        if (!zone) {
            return NextResponse.json(errorResponse('Zone not found'), { status: 404 });
        }

        // Verify the zone officer is assigned to this zone
        const isAssignedToZone = zone.users?.some(u => u.id === userId);
        if (!isAssignedToZone) {
            return NextResponse.json(
                errorResponse('You are not authorized to approve this zone'),
                { status: 403 }
            );
        }

        // Resolve the company exactly the way withCompany does for the summary GET/POST:
        // the session company takes priority, falling back to the zone's company. Writing
        // the approval under a different company than the one used to read it back makes
        // the approval appear to not persist across refreshes and other logins.
        const company_id = (session?.user as any)?.company_id || zone.company_id;

        // Merge with any previously approved vardhis so existing approvals are never lost.
        // This keeps already-approved vardhis approved even when new vardhis are added to
        // the zone or vardhis return from Bill Tracking.
        const existingApproval = await prisma.zoneApproval.findUnique({
            where: {
                company_id_zone_id: {
                    company_id: company_id,
                    zone_id: zone_id,
                }
            },
            select: { approved_vardhi_ids: true },
        });

        let existingApprovedIds: string[] = [];
        if (existingApproval) {
            try {
                existingApprovedIds = JSON.parse(existingApproval.approved_vardhi_ids);
            } catch {
                existingApprovedIds = [];
            }
        }

        const mergedApprovedIds = Array.from(new Set([...existingApprovedIds, ...vardhi_ids])).sort();
        const approvedVardhiIdsJson = JSON.stringify(mergedApprovedIds);

        const approval = await prisma.zoneApproval.upsert({
            where: {
                company_id_zone_id: {
                    company_id: company_id,
                    zone_id: zone_id,
                }
            },
            update: {
                approved_vardhi_ids: approvedVardhiIdsJson,
                updated_at: new Date(),
            },
            create: {
                company_id: company_id,
                zone_id: zone_id,
                approved_vardhi_ids: approvedVardhiIdsJson,
            }
        });

        return NextResponse.json(
            successResponse('Zone approved successfully', {
                zone_id: zone_id,
                approved_vardhi_ids: mergedApprovedIds,
                updated_at: approval.updated_at,
            })
        );

    } catch (error) {
        console.error('Error approving zone:', error);
        return NextResponse.json(errorResponse('Failed to approve zone'), { status: 500 });
    }
}
