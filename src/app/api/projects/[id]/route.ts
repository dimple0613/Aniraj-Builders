import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { projectSchema } from '@/lib/validations/project';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import { readFile, writeFile, mkdir, copyFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        return await withCompany(async (company) => {
            const project = await prisma.project.findFirst({
                where: {
                    id,
                    company_id: company?.company_id,
                },
                include: {
                    locations: {
                        include: {
                            location: true,
                        },
                    },
                    documents: {
                        orderBy: { uploaded_at: 'desc' },
                    },
                    negotiationPrice: {
                        select: { id: true, name: true },
                    },
                    projectArea: {
                        select: { id: true, title: true },
                    },
                    items: {
                        include: {
                            capitalSOR: {
                                include: {
                                    prices: {
                                        orderBy: { start_date: 'desc' },
                                    },
                                    itemMaster: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!project) {
                return NextResponse.json(
                    { success: false, message: 'Project not found' },
                    { status: 404 }
                );
            }

            let work_type_name = null;
            if (project.work_type) {
                const workType = await prisma.projectWorkType.findFirst({
                    where: { id: project.work_type },
                    select: { title: true },
                });
                work_type_name = workType?.title || null;
            }

            let department_name = null;
            if (project.department) {
                const dept = await prisma.department.findFirst({
                    where: { id: project.department },
                    select: { name: true },
                });
                department_name = dept?.name || null;
            }

            let sor_name = null;
            if (project.sor_id) {
                const sor = await prisma.sORItem.findFirst({
                    where: { id: project.sor_id },
                    select: { name: true },
                });
                sor_name = sor?.name || null;
            }

            let progress = null;
            try {
                const progressRaw: any = await prisma.$queryRawUnsafe(
                    `SELECT
                        p.id AS project_id,
                        COALESCE((SELECT SUM(CASE WHEN pi2.size <> '' AND pi2.size IS NOT NULL THEN pi2.size::float ELSE 0 END) FROM "ProjectItem" pi2 WHERE pi2.project_id = p.id AND pi2.is_price_tracking = true), 0)::float AS total_qty,
                        COUNT(DISTINCT pi.id)::int AS tracked_items_count,
                        COALESCE(SUM(pem.qty), 0)::float AS purchased_qty,
                        COALESCE(SUM(pem.qty * pem.rate), 0)::float AS total_amount,
                        COALESCE((SELECT SUM(pem2.qty * pem2.rate)::float FROM "PurchaseEntry" pe2
                                  JOIN "PurchaseEntryMaterial" pem2 ON pem2.purchase_entry_id = pe2.id
                                  WHERE pe2.project_id = p.id
                                  AND pem2.material_id IN (
                                      SELECT pi3.capital_sor_id FROM "ProjectItem" pi3
                                      WHERE pi3.project_id = p.id AND pi3.is_price_tracking = true
                                  )), 0)::float AS progressive_amount
                    FROM "Project" p
                    INNER JOIN "ProjectItem" pi ON pi.project_id = p.id AND pi.is_price_tracking = true
                    LEFT JOIN "PurchaseEntry" pe ON pe.project_id = p.id
                    LEFT JOIN "PurchaseEntryMaterial" pem ON pem.purchase_entry_id = pe.id AND pem.material_id = pi.capital_sor_id
                    WHERE p.id = $1
                    GROUP BY p.id`,
                    id
                );
                if (progressRaw && progressRaw.length > 0) {
                    const prog = progressRaw[0];
                    const purchasedQty = parseFloat(prog.purchased_qty) || 0;
                    const denominator = parseFloat(project.main_item_execution_qty ?? '') || parseFloat(prog.total_qty) || 0;
                    progress = {
                        percentage: denominator > 0 ? Math.min(Math.round((purchasedQty / denominator) * 100), 100) : 0,
                        totalQty: denominator,
                        purchasedQty,
                        totalAmount: parseFloat(prog.total_amount) || 0,
                        progressiveAmount: parseFloat(prog.progressive_amount) || 0,
                        itemName: '',
                        uom: '',
                        trackedItemsCount: prog.tracked_items_count || 0,
                    };
                }
            } catch (e) {
                console.error('Error computing progress:', e);
            }

            const purchaseEntryCount = await prisma.purchaseEntry.count({ where: { project_id: id } });
            const projectCompany = await prisma.company.findFirst({
                where: { id: project.company_id },
                select: { company_name: true },
            });

            const projectData: Record<string, any> = {
                ...project,
                purchaseEntryCount,
                company_name: projectCompany?.company_name ?? null,
                sor_id: project.sor_id || project.items?.find((i: any) => i.capitalSOR?.itemMaster?.sorId)?.capitalSOR?.itemMaster?.sorId || null,
                work_type_name,
                department_name,
                sor_name,
                progress,
                documents: project.documents?.map((d: any) => ({
                    id: d.id,
                    document_type: d.document_type,
                    file_url: d.file_url,
                    file_name: d.file_name,
                    file_size: d.file_size,
                    uploaded_at: d.uploaded_at,
                })) || [],
                items: project.items?.map((item: any) => ({
                    id: item.id,
                    capital_sor_id: item.capital_sor_id,
                    size: item.size,
                    rate: item.rate,
                    is_price_tracking: item.is_price_tracking,
                    capitalSOR: item.capitalSOR ? {
                        id: item.capitalSOR.id,
                        item_name: item.capitalSOR.item_name,
                        uom: item.capitalSOR.uom,
                        other_item_ids: item.capitalSOR.other_item_ids || null,
                        currentPrice: item.capitalSOR.prices?.find((p: any) => p.expiry_date === null)?.price?.toString() || '0',
                    } : null,
                })) || [],
            };

            // Resolve negotiation_price_id from UUID to name for the form
            if (projectData.negotiation_price_id) {
                const premium = await prisma.negotiationPrice.findUnique({
                    where: { id: projectData.negotiation_price_id },
                    select: { name: true },
                });
                if (premium) {
                    projectData.negotiation_price_id = premium.name;
                }
            }

            return NextResponse.json({
                success: true,
                message: 'Project fetched successfully',
                data: projectData,
            });
        });
    } catch (error) {
        console.error('Error fetching project:', error);
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to fetch project' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { location_ids, project_items, wizard_step, ...projectData } = body;

        const isDraft = wizard_step !== undefined;
        const validatedData = isDraft
            ? projectData
            : await projectSchema.validate(projectData, { abortEarly: false });
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;

        return await withCompany(async (company) => {
            const companyId = company?.company_id!;

            const existingProject = await prisma.project.findFirst({
                where: {
                    id,
                    company_id: companyId,
                },
            });

            if (!existingProject) {
                return NextResponse.json(
                    { success: false, message: 'Project not found' },
                    { status: 404 }
                );
            }

            if (validatedData.name && validatedData.name !== existingProject.name) {
                const duplicateProject = await prisma.project.findUnique({
                    where: {
                        company_id_name: {
                            company_id: companyId,
                            name: validatedData.name,
                        },
                    },
                });

                if (duplicateProject) {
                    return NextResponse.json(
                        { success: false, message: 'Project with this name already exists' },
                        { status: 400 }
                    );
                }
            }

            if (validatedData.unique_name && validatedData.unique_name !== existingProject.unique_name) {
                const existingUnique = await prisma.project.findUnique({
                    where: { unique_name: validatedData.unique_name },
                });
                if (existingUnique) {
                    return NextResponse.json(
                        { success: false, message: 'Project with this unique name already exists' },
                        { status: 400 }
                    );
                }
            }

            // Resolve negotiation_price_id from name string to UUID
            if (validatedData.negotiation_price_id && typeof validatedData.negotiation_price_id === 'string' && validatedData.negotiation_price_id.length < 36) {
                let premium = await prisma.negotiationPrice.findFirst({
                    where: { name: validatedData.negotiation_price_id, company_id: companyId },
                });
                if (!premium) {
                    premium = await prisma.negotiationPrice.create({
                        data: { name: validatedData.negotiation_price_id, company_id: companyId },
                    });
                }
                validatedData.negotiation_price_id = premium.id;
            }

            // Remove status and temp_document_ids from draft updates
            const { status, temp_document_ids, ...stepData } = validatedData;
            const updateData: any = {
                ...stepData,
            };
            if (wizard_step) {
                updateData.wizard_step = wizard_step;
            }
            // On final save (no wizard_step), transition DRAFT → NOT_STARTED
            if (!isDraft) {
                updateData.status = existingProject.status === 'DRAFT' ? 'NOT_STARTED' : (status || existingProject.status || 'NOT_STARTED');
            }
            if (!existingProject.created_by && userId) {
                updateData.created_by = userId;
            }
            const project = await prisma.project.update({
                where: { id },
                data: updateData,
            });

            // Process temp_document_ids: move temp docs to permanent project documents
            if (temp_document_ids && Array.isArray(temp_document_ids) && temp_document_ids.length > 0) {
                const tempDocs = await prisma.tempProjectDocument.findMany({
                    where: {
                        id: { in: temp_document_ids },
                        company_id: companyId,
                    },
                });

                const projectUploadDir = path.join(process.cwd(), 'public', 'uploads', 'projects', project.id);
                if (!existsSync(projectUploadDir)) {
                    await mkdir(projectUploadDir, { recursive: true });
                }

                for (const tempDoc of tempDocs) {
                    if (tempDoc.file_url) {
                        const oldPath = path.join(process.cwd(), 'public', tempDoc.file_url);
                        const fileName = path.basename(tempDoc.file_url);
                        const newPath = path.join(projectUploadDir, fileName);
                        const newUrl = `/uploads/projects/${project.id}/${fileName}`;

                        try {
                            if (existsSync(oldPath)) {
                                await copyFile(oldPath, newPath);
                                await unlink(oldPath);
                            }
                        } catch (error) {
                            console.error('Error moving temp file:', error);
                        }

                        await prisma.projectDocument.create({
                            data: {
                                company_id: companyId,
                                project_id: project.id,
                                document_type: tempDoc.document_type,
                                file_url: newUrl,
                                file_name: tempDoc.file_name,
                                file_size: tempDoc.file_size || 0,
                            },
                        });
                    }
                }

                await prisma.tempProjectDocument.deleteMany({
                    where: { id: { in: temp_document_ids } },
                });
            }

            if (location_ids && Array.isArray(location_ids)) {
                await prisma.projectLocation.deleteMany({
                    where: { project_id: id },
                });

                if (location_ids.length > 0) {
                    await prisma.projectLocation.createMany({
                        data: location_ids.map((locId: string) => ({
                            company_id: companyId,
                            project_id: id,
                            location_id: locId,
                        })),
                    });
                }
            }

            let total_amount = 0;
            let sqm = 0;
            let brs = 0;

            if (project_items && Array.isArray(project_items)) {
                await prisma.projectItem.deleteMany({
                    where: { project_id: id },
                });

                if (project_items.length > 0) {
                    await prisma.projectItem.createMany({
                        data: project_items.map((item: any) => ({
                            company_id: companyId,
                            project_id: id,
                            capital_sor_id: item.capital_sor_id,
                            size: item.size || '',
                            rate: item.rate || 0,
                            is_price_tracking: item.is_price_tracking ?? false,
                        })),
                    });

                    total_amount = project_items.reduce((sum: number, item: any) =>
                        sum + ((parseFloat(item.size) || 0) * (parseFloat(item.rate) || 0)), 0);

                    const firstCheckedItem = project_items.find((item: any) => item.is_price_tracking);
                    if (firstCheckedItem) {
                        const matchedItem = await prisma.projectItem.findFirst({
                            where: {
                                project_id: id,
                                capital_sor_id: firstCheckedItem.capital_sor_id,
                            },
                        });
                        if (matchedItem) {
                            const checkedItemQty = parseFloat(matchedItem.size) || 0;
                            sqm = checkedItemQty;
                            brs = sqm / 9.29;
                        }
                    }
                }
            }

            await prisma.$executeRawUnsafe(
                `UPDATE "Project" SET total_amount = $1, sqm = $2, brs = $3 WHERE id = $4`,
                total_amount, sqm, brs, project.id
            );

            const updatedProject = await prisma.project.findUnique({
                where: { id: project.id },
                include: {
                    locations: {
                        include: {
                            location: true,
                        },
                    },
                    documents: true,
                    negotiationPrice: {
                        select: { id: true, name: true },
                    },
                    items: {
                        include: {
                            capitalSOR: {
                                include: {
                                    prices: {
                                        orderBy: { start_date: 'desc' },
                                    },
                                    itemMaster: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!isDraft) {
                await createNotification({
                    action: 'Updated',
                    entity: 'Project',
                    entityId: project.id,
                    entityName: project.name,
                    userId: (session?.user as any)?.id,
                    link: `/projects`,
                });
            }

            return NextResponse.json({
                success: true,
                message: 'Project updated successfully',
                data: updatedProject,
            });
        });
    } catch (error: any) {
        console.error('Error updating project:', error);
        if (error.name === 'ValidationError') {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to update project' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const existingProject = await prisma.project.findFirst({
                where: {
                    id,
                    company_id: company?.company_id,
                },
            });

            if (!existingProject) {
                return NextResponse.json(
                    { success: false, message: 'Project not found' },
                    { status: 404 }
                );
            }

            const [
                attendanceCount,
                belongingsFromCount,
                belongingsToCount,
                purchaseEntryCount,
                bankTransactionCount,
                cashTransactionCount,
            ] = await Promise.all([
                prisma.attendance.count({ where: { project_id: id } }),
                prisma.belongingsTransfer.count({ where: { from_project_id: id } }),
                prisma.belongingsTransfer.count({ where: { to_project_id: id } }),
                prisma.purchaseEntry.count({ where: { project_id: id } }),
                prisma.bankBookTransaction.count({ where: { project_id: id, is_deleted: false } }),
                prisma.cashBookTransaction.count({ where: { project_id: id, is_deleted: false } }),
            ]);

            const totalReferences = attendanceCount + belongingsFromCount + belongingsToCount
                + purchaseEntryCount + bankTransactionCount + cashTransactionCount;

            if (totalReferences > 0) {
                return NextResponse.json(
                    { success: false, message: 'This project is currently in use, so it cannot be deleted.' },
                    { status: 400 }
                );
            }

            const documents = await prisma.projectDocument.findMany({
                where: { project_id: id },
            });

            for (const doc of documents) {
                try {
                    if (doc.file_url) {
                        const fullPath = path.join(process.cwd(), 'public', doc.file_url);
                        await unlink(fullPath);
                    }
                } catch (error: any) {
                    if (error.code !== 'ENOENT') {
                        console.error('Error deleting document file:', error);
                    }
                }
            }

            await prisma.projectDocument.deleteMany({
                where: { project_id: id },
            });

            await prisma.projectLocation.deleteMany({
                where: { project_id: id },
            });

            await prisma.project.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Project',
                entityId: id,
                entityName: existingProject.name,
                userId: (session?.user as any)?.id,
                link: `/projects`,
            });

            return NextResponse.json({
                success: true,
                message: 'Project deleted successfully',
            });
        });
    } catch (error) {
        console.error('Error deleting project:', error);
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to delete project' },
            { status: 500 }
        );
    }
}
