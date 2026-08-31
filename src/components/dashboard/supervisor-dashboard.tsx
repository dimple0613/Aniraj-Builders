'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { DashboardHeader } from '@/components/dashboard';

interface SupervisorDashboardProps {
    data: {
        assignedProjects?: number;
        recentProgress?: Array<{
            projectName: string;
            progress: number;
            date: Date;
        }>;
        metrics?: Array<{
            label: string;
            value: number;
            icon?: string;
        }>;
    };
}

export function SupervisorDashboard({ data }: SupervisorDashboardProps) {
    const recentProgress = data?.recentProgress || [];

    return (
        <>
            <DashboardHeader
                title="Command Center"
                description="Welcome back. Here's your supervisor overview."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Assigned Projects</CardTitle>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.assignedProjects || 0}</div>
                    </CardContent>
                </Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            {/* <ClipboardLists className="w-5 h-5 text-green-500" /> */}
                            Recent Site Updates
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {recentProgress.map((item, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{item.projectName}</span>
                                        <span className="text-green-600 font-bold">{item.progress}%</span>
                                    </div>
                                    <Progress value={item.progress} className="h-2" />
                                    <p className="text-[10px] text-muted-foreground">
                                        Updated: {new Date(item.date).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
