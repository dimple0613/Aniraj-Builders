import { getServerSession, authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Correspondence } from "@/components/projects/Correspondence";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function CorrespondencePage({ params }: Props) {
  await getServerSession(authOptions);

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      project_no: true,
      loa_approved_no: true,
    },
  });

  if (!project) {
    return <div className="p-8 text-center">Project not found</div>;
  }

  return <Correspondence project={project} />;
}
