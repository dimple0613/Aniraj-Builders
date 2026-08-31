import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { projectSchema } from '@/lib/validations/project';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import { readFile, writeFile, mkdir, unlink, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const sorIds = searchParams.get('sor_id') || '';
    const deptIds = searchParams.get('department') || '';
    const areaIds = searchParams.get('area') || '';
    const workType = searchParams.get('workType') || '';
    const locationIds = searchParams.get('location_ids') || '';
    const negotiationPriceId = searchParams.get('negotiation_price_id') || '';
    const negotiationPriceMin = searchParams.get('negotiation_price_min') || '';
    const negotiationPriceMax = searchParams.get('negotiation_price_max') || '';
    const sortBy = searchParams.get('sortField') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    return await withCompany(async (company) => {
      const where: any = {
        company_id: company?.company_id,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
          { tender_notice_no: { contains: search, mode: 'insensitive' } },
          { department: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (status) {
        where.status = status;
      } else {
        // Hide draft projects from the default listing
        where.status = { not: 'DRAFT' };
      }

      if (workType) {
        where.work_type = workType;
      }

      if (sorIds) {
        where.sor_id = { in: sorIds.split(',') };
      }

      if (deptIds) {
        where.department = { in: deptIds.split(',') };
      }

      if (areaIds) {
        where.area = { in: areaIds.split(',') };
      }

      if (locationIds) {
        const locIds = locationIds.split(',');
        where.locations = {
          some: {
            location_id: { in: locIds },
          },
        };
      }

      if (negotiationPriceId) {
        where.negotiation_price_id = negotiationPriceId;
      }

      if (negotiationPriceMin || negotiationPriceMax) {
        where.project_approved_amount = {};
        if (negotiationPriceMin) {
          where.project_approved_amount.gte = parseFloat(negotiationPriceMin);
        }
        if (negotiationPriceMax) {
          where.project_approved_amount.lte = parseFloat(negotiationPriceMax);
        }
      }

      const skip = (page - 1) * limit;

      const [total] = await Promise.all([
        prisma.project.count({ where }),
      ]);

      // Build raw SQL WHERE clause matching Prisma's dynamic `where` object
      const whereClauses: string[] = [];
      const sqlParams: any[] = [];
      let paramIdx = 1;

      whereClauses.push(`company_id = $${paramIdx++}`);
      sqlParams.push(company?.company_id);

      if (search) {
        whereClauses.push(`(name ILIKE $${paramIdx} OR description ILIKE $${paramIdx} OR location ILIKE $${paramIdx} OR tender_notice_no ILIKE $${paramIdx} OR department ILIKE $${paramIdx})`);
        sqlParams.push(`%${search}%`);
        paramIdx++;
      }

      if (status) {
        whereClauses.push(`status = $${paramIdx++}`);
        sqlParams.push(status);
      } else {
        whereClauses.push(`status != 'DRAFT'`);
      }

      if (workType) {
        whereClauses.push(`work_type = $${paramIdx++}`);
        sqlParams.push(workType);
      }

      if (sorIds) {
        whereClauses.push(`sor_id = ANY($${paramIdx++}::text[])`);
        sqlParams.push(sorIds.split(','));
      }

      if (deptIds) {
        whereClauses.push(`department = ANY($${paramIdx++}::text[])`);
        sqlParams.push(deptIds.split(','));
      }

      if (areaIds) {
        whereClauses.push(`area = ANY($${paramIdx++}::text[])`);
        sqlParams.push(areaIds.split(','));
      }

      if (locationIds) {
        whereClauses.push(`EXISTS (SELECT 1 FROM "ProjectLocation" pl WHERE pl.project_id = "Project".id AND pl.location_id = ANY($${paramIdx++}::text[]))`);
        sqlParams.push(locationIds.split(','));
      }

      if (negotiationPriceId) {
        whereClauses.push(`negotiation_price_id = $${paramIdx++}`);
        sqlParams.push(negotiationPriceId);
      }

      if (negotiationPriceMin || negotiationPriceMax) {
        if (negotiationPriceMin) {
          whereClauses.push(`project_approved_amount >= $${paramIdx++}::float`);
          sqlParams.push(parseFloat(negotiationPriceMin));
        }
        if (negotiationPriceMax) {
          whereClauses.push(`project_approved_amount <= $${paramIdx++}::float`);
          sqlParams.push(parseFloat(negotiationPriceMax));
        }
      }

      const whereSQL = whereClauses.join(' AND ');

      // Custom ordering: NOT_STARTED first (newest created), then IN_PROGRESS (newest started), then COMPLETED (newest completed)
      const orderBySQL = `
        CASE
          WHEN status = 'NOT_STARTED' THEN 1
          WHEN status = 'IN_PROGRESS' THEN 2
          WHEN status = 'COMPLETED' THEN 3
          ELSE 4
        END ASC,
        CASE WHEN status = 'NOT_STARTED' THEN "createdAt" END DESC NULLS LAST,
        CASE WHEN status = 'IN_PROGRESS' THEN start_date END DESC NULLS LAST,
        CASE WHEN status = 'COMPLETED' THEN work_completion_date END DESC NULLS LAST
      `;

      // Get paginated ordered IDs via raw SQL
      const idRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "Project" WHERE ${whereSQL} ORDER BY ${orderBySQL} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        ...sqlParams, limit, skip
      );
      const ids: string[] = idRows.map(r => r.id);

      // Fetch full project data with Prisma, preserving ID order
      const unorderedData = ids.length > 0 ? await prisma.project.findMany({
        where: { id: { in: ids } },
        include: {
          items: {
            select: {
              id: true,
              capital_sor_id: true,
              size: true,
              rate: true,
            },
          },
          locations: {
            include: {
              location: true,
            },
          },
          _count: {
            select: {
              purchaseEntries: true,
              bankTransactions: true,
              cashTransactions: true,
              correspondence: true,
            },
          },
          negotiationPrice: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }) : [];
      const idOrderMap = new Map(ids.map((id, i) => [id, i]));
      const data = unorderedData.sort((a, b) => (idOrderMap.get(a.id) ?? 0) - (idOrderMap.get(b.id) ?? 0));

      const [workTypes, departments, sorItems] = await Promise.all([
        prisma.projectWorkType.findMany({
          where: { company_id: company?.company_id },
          select: { id: true, title: true },
        }),
        prisma.department.findMany({
          select: { id: true, name: true },
        }),
        prisma.sORItem.findMany({
          select: { id: true, name: true },
        }),
      ]);
      const workTypeMap = new Map(workTypes.map(wt => [wt.id, wt.title]));
      const departmentMap = new Map(departments.map(d => [d.id, d.name]));
      const sorMap = new Map(sorItems.map(s => [s.id, s.name]));

      const projectsWithProgress = data.map((project: any) => ({
        ...project,
        work_type_name: project.work_type ? workTypeMap.get(project.work_type) || project.work_type : null,
        department_name: project.department ? departmentMap.get(project.department) || project.department : null,
        sor_name: project.sor_id ? sorMap.get(project.sor_id) || project.sor_id : null,
      }));

      if (data.length > 0) {
        const ids = data.map((p: any) => p.id);
        const extraFields: any = await prisma.$queryRawUnsafe(
          `SELECT id, total_amount::float, sqm::float, brs::float FROM "Project" WHERE id = ANY($1)`,
          ids
        );
        const extraMap = new Map((extraFields as any[]).map((f: any) => [f.id, f]));
        projectsWithProgress.forEach((p: any) => {
          const extra = extraMap.get(p.id);
          if (extra) {
            p.total_amount = extra.total_amount ?? null;
            p.sqm = extra.sqm ?? null;
            p.brs = extra.brs ?? null;
          }
        });

        const progressData: any = await prisma.$queryRawUnsafe(
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
                      )), 0)::float AS progressive_amount,
            EXISTS(
              SELECT 1 FROM "ProjectItem" pi_o
              LEFT JOIN "PurchaseEntry" pe_o ON pe_o.project_id = p.id
              LEFT JOIN "PurchaseEntryMaterial" pem_o ON pem_o.purchase_entry_id = pe_o.id AND pem_o.material_id = pi_o.capital_sor_id
              WHERE pi_o.project_id = p.id
              GROUP BY pi_o.id, pi_o.size
              HAVING COALESCE(SUM(pem_o.qty), 0) > CASE WHEN pi_o.size <> '' AND pi_o.size IS NOT NULL THEN pi_o.size::float ELSE 0 END
            ) AS has_qty_overrun,
            EXISTS(
              SELECT 1 FROM "ProjectItem" pi_t
              LEFT JOIN "PurchaseEntry" pe_t ON pe_t.project_id = p.id
              LEFT JOIN "PurchaseEntryMaterial" pem_t ON pem_t.purchase_entry_id = pe_t.id AND pem_t.material_id = pi_t.capital_sor_id
              WHERE pi_t.project_id = p.id AND pi_t.is_price_tracking = true
              GROUP BY pi_t.id, pi_t.size
              HAVING COALESCE(SUM(pem_t.qty), 0) > CASE WHEN pi_t.size <> '' AND pi_t.size IS NOT NULL THEN pi_t.size::float ELSE 0 END
            ) AS has_tracked_qty_overrun
          FROM "Project" p
          INNER JOIN "ProjectItem" pi ON pi.project_id = p.id AND pi.is_price_tracking = true
          LEFT JOIN "PurchaseEntry" pe ON pe.project_id = p.id
          LEFT JOIN "PurchaseEntryMaterial" pem ON pem.purchase_entry_id = pe.id AND pem.material_id = pi.capital_sor_id
          WHERE p.id = ANY($1)
          GROUP BY p.id`,
          ids
        );
        const progressMap = new Map((progressData as any[]).map((p: any) => [p.project_id, p]));
        projectsWithProgress.forEach((p: any) => {
          const prog = progressMap.get(p.id);
          if (prog) {
            const purchasedQty = parseFloat(prog.purchased_qty) || 0;
            const denominator = parseFloat(p.main_item_execution_qty) || parseFloat(prog.total_qty) || 0;
            p.progress = {
              percentage: denominator > 0 ? Math.min(Math.round((purchasedQty / denominator) * 100), 100) : 0,
              totalQty: denominator,
              purchasedQty,
              totalAmount: parseFloat(prog.total_amount) || 0,
              progressiveAmount: parseFloat(prog.progressive_amount) || 0,
              itemName: '',
              uom: '',
              trackedItemsCount: prog.tracked_items_count || 0,
              hasQtyOverrun: !!prog.has_qty_overrun,
              hasTrackedQtyOverrun: !!prog.has_tracked_qty_overrun,
            };
          }
        });

        const form3aOverrides = await prisma.form3AOverride.findMany({
          where: { project_id: { in: ids } },
          select: { project_id: true, work_done_figure: true },
        });
        const overrideMap = new Map(form3aOverrides.map(o => [o.project_id, o.work_done_figure]));
        projectsWithProgress.forEach((p: any) => {
          p.form3a_work_done_figure = overrideMap.get(p.id) ?? null;
        });

      }

      return NextResponse.json({
        success: true,
        message: 'Projects fetched successfully',
        data: projectsWithProgress,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { location_ids, temp_document_ids, project_items, wizard_step, ...projectData } = body;

    const isDraft = wizard_step !== undefined;
    const validatedData = isDraft
      ? projectData
      : await projectSchema.validate(projectData, { abortEarly: false });

    const session = await getServerSession(authOptions);

    return await withCompany(async (company) => {
      const companyId = company?.company_id!;

      if (validatedData.name) {
        const existingByName = await prisma.project.findUnique({
          where: {
            company_id_name: {
              company_id: companyId,
              name: validatedData.name,
            },
          },
        });

        if (existingByName) {
          return NextResponse.json(
            { success: false, message: 'Project with this name already exists' },
            { status: 400 }
          );
        }
      }

      if (validatedData.unique_name) {
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

      const { ...restData } = validatedData;
      const createData: any = {
        ...restData,
        company_id: companyId,
        status: isDraft ? 'DRAFT' : (validatedData.status || 'NOT_STARTED'),
        wizard_step: wizard_step || 1,
        created_by: (session?.user as any)?.id || null,
      };
      const project = await prisma.project.create({
        data: createData,
      });

      let total_amount = 0;
      let sqm = 0;
      let brs = 0;

      if (project_items && Array.isArray(project_items)) {
        if (project_items.length > 0) {
          await prisma.projectItem.createMany({
            data: project_items.map((item: any) => ({
              company_id: companyId,
              project_id: project.id,
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
                project_id: project.id,
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

      if (location_ids && Array.isArray(location_ids) && location_ids.length > 0) {
        await prisma.projectLocation.createMany({
          data: location_ids.map((locId: string) => ({
            company_id: companyId,
            project_id: project.id,
            location_id: locId,
          })),
        });
      }

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

      const createdProject = await prisma.project.findUnique({
        where: { id: project.id },
        include: {
          locations: {
            include: {
              location: true,
            },
          },
          documents: true,
          items: {
            include: {
              capitalSOR: {
                include: {
                  prices: {
                    orderBy: { start_date: 'desc' },
                  },
                },
              },
            },
          },
        },
      });

      await createNotification({
        action: 'Created',
        entity: 'Project',
        entityId: project.id,
        entityName: project.name,
        userId: (session?.user as any)?.id,
        link: `/projects`,
      });

      return NextResponse.json({
        success: true,
        message: 'Project created successfully',
        data: createdProject,
      });
    });
  } catch (error: any) {
    console.error('Error creating project:', error);
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
      { success: false, message: 'Failed to create project' },
      { status: 500 }
    );
  }
}
