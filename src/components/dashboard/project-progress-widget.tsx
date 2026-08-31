'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ProjectProgress {
  id: string;
  name: string;
  status: string;
  work_progress?: string;
}

interface ProjectProgressWidgetProps {
  projects: ProjectProgress[];
}

const statusColors: Record<string, string> = {
  NOT_STARTED: 'bg-gray-500',
  IN_PROGRESS: 'bg-blue-500',
  COMPLETED: 'bg-green-500',
  ON_HOLD: 'bg-yellow-500',
  CANCELLED: 'bg-red-500',
};

export function ProjectProgressWidget({ projects }: ProjectProgressWidgetProps) {
  const inProgressProjects = projects.filter(p => p.status === 'IN_PROGRESS');
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Project Price Tracking</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active projects
          </p>
        ) : (
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {inProgressProjects.slice(0, 5).map((project) => {
              const progress = parseFloat(project.work_progress || '0');
              return (
                <div key={project.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate max-w-[180px]">{project.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {progress}%
                    </Badge>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              );
            })}
            {inProgressProjects.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{inProgressProjects.length - 5} more projects
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
