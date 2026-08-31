import { getServerSession, authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Form3A } from "@/components/projects/Form3A";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function Form3APage({ params }: Props) {
  await getServerSession(authOptions);
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id },
    include: {
      company: {
        select: { company_name: true },
      },
      items: {
        include: {
          capitalSOR: {
            select: { item_name: true, uom: true },
          },
        },
      },
    },
  });

  if (!project) {
    return <div className="p-8 text-center text-muted-foreground">Project not found</div>;
  }

  const itemsTotal = project.items.reduce((sum, item) => {
    return sum + (parseFloat(item.size) || 0) * (Number(item.rate) || 0);
  }, 0);

  const totalAmount = project.total_amount ? Number(project.total_amount) : itemsTotal;

  const serialized = {
    id: project.id,
    name: project.name,
    project_no: project.project_no,
    project_estimation_cost: project.project_estimation_cost ? Number(project.project_estimation_cost) : 0,
    project_approved_amount: project.project_approved_amount ? Number(project.project_approved_amount) : 0,
    loa_approved_date: project.loa_approved_date?.toISOString() ?? null,
    work_order_date: project.work_order_date?.toISOString() ?? null,
    project_end_date: project.project_end_date?.toISOString() ?? null,
    work_completion_date: project.work_completion_date?.toISOString() ?? null,
    is_completed: project.is_completed,
    status: project.status,
    remarks: project.remarks,
    total_amount: totalAmount,
    company_name: project.company?.company_name ?? "Aniraj Builders",
  };

  return <Form3A project={serialized} />;
}
