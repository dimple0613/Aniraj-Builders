'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Shield, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CompanyAccessSettings {
    id: string;
    allow_add_company: boolean;
    allow_edit_company: boolean;
}

export default function CompanySettingsPage() {
    const router = useRouter();
    const [settings, setSettings] = useState<CompanyAccessSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/company-settings');
            setSettings(response.data.data);
        } catch (error) {
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        try {
            setSaving(true);
            await axios.put('/api/company-settings', {
                allow_add_company: settings.allow_add_company,
                allow_edit_company: settings.allow_edit_company,
            });
            toast.success('Settings saved successfully');
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const toggleSetting = (key: 'allow_add_company' | 'allow_edit_company') => {
        if (!settings) return;
        setSettings({ ...settings, [key]: !settings[key] });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 w-full">
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/company')}
                >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                </Button>
            </div>

            <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                    Company Settings
                </h2>
                <p className="text-muted-foreground text-sm">
                    Configure access permissions for company management.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-500" />
                        <CardTitle className="text-lg">Admin → Company Management</CardTitle>
                    </div>
                    <CardDescription>
                        Control which company management features are available for the Super Admin role.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                        <Checkbox
                            id="allow_add_company"
                            checked={settings?.allow_add_company ?? true}
                            onCheckedChange={() => toggleSetting('allow_add_company')}
                        />
                        <div className="space-y-1">
                            <Label
                                htmlFor="allow_add_company"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                                Add Company
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Allows the Super Admin to access and use the Add Company functionality.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                        <Checkbox
                            id="allow_edit_company"
                            checked={settings?.allow_edit_company ?? true}
                            onCheckedChange={() => toggleSetting('allow_edit_company')}
                        />
                        <div className="space-y-1">
                            <Label
                                htmlFor="allow_edit_company"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                                Edit Company
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Allows the Super Admin to access and use the Edit Company functionality.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
}
