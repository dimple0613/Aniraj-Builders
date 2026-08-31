'use client';

import { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'sonner';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/lib/user-context';

interface User {
    id: string;
    name: string | null;
    email: string | null;
    role?: string | null;
    company_id?: string | null;
    profile_photo?: string | null;
}

interface ProfileFormData {
    name: string;
    email: string;
    profile_photo?: string;
}

interface PasswordFormData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

const validationSchema = Yup.object().shape({
    name: Yup.string().required('Name is required'),
    email: Yup.string().email('Invalid email').required('Email is required'),
});

const passwordValidationSchema = Yup.object().shape({
    currentPassword: Yup.string().required('Current password is required'),
    newPassword: Yup.string()
        .min(6, 'Password must be at least 6 characters')
        .required('New password is required'),
    confirmPassword: Yup.string()
        .oneOf([Yup.ref('newPassword')], 'Passwords must match')
        .required('Confirm password is required'),
});

interface ProfileClientProps {
    user: User;
}

export default function ProfileClient({ user: initialUser }: ProfileClientProps) {
    const router = useRouter();
    const { update } = useSession();
    const { updateUser } = useUser();
    const [loading, setLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [user, setUser] = useState<User>(initialUser);
    const [previewImage, setPreviewImage] = useState<string | null>(initialUser.profile_photo || null);

    const [profileForm, setProfileForm] = useState({ name: user.name || '', email: user.email || '', profile_photo: user.profile_photo || '' });

    const progress = (() => {
        let filled = 0;
        let total = 0;
        const fields = [profileForm.name, profileForm.email, profileForm.profile_photo];
        fields.forEach(f => { total++; if (f && f.toString().trim() !== '') filled++; });
        return total > 0 ? Math.round((filled / total) * 100) : 0;
    })();

    const handleProfileSubmit = async (values: ProfileFormData) => {
        try {
            setLoading(true);

            const response = await axios.put('/api/profile', values);

            if (response.data.success) {
                toast.success('Profile updated successfully');

                await update({
                    name: values.name,
                    email: values.email,
                    profile_photo: values.profile_photo,
                });

                updateUser({
                    name: values.name,
                    email: values.email,
                    profile_photo: values.profile_photo || null,
                });

                setUser({
                    ...user,
                    name: values.name,
                    profile_photo: values.profile_photo || null,
                });

                setProfileForm({
                    name: values.name,
                    email: values.email,
                    profile_photo: values.profile_photo || '',
                });

                if (values.profile_photo) {
                    setPreviewImage(values.profile_photo);
                }

                router.refresh();
            }

        } catch (error: any) {
            toast.error(
                error.response?.data?.message || 'Failed to update profile'
            );
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (values: PasswordFormData) => {
        try {
            setPasswordLoading(true);

            const response = await axios.put('/api/profile/password', {
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
                confirmPassword: values.confirmPassword,
            });

            if (response.data.success) {
                toast.success('Password changed successfully');
            }

        } catch (error: any) {
            toast.error(
                error.response?.data?.message || 'Failed to change password'
            );
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, setFieldValue: any) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result as string);
            };
            reader.readAsDataURL(file);

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await axios.post('/api/upload/profile', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
                setFieldValue('profile_photo', response.data.data.url);
                setProfileForm(prev => ({ ...prev, profile_photo: response.data.data.url }));
                toast.success('Image uploaded successfully');
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to upload image');
                setPreviewImage(user.profile_photo || null);
            }
        }
    };

    const removeImage = (setFieldValue: any) => {
        setPreviewImage(null);
        setFieldValue('profile_photo', '');
        setProfileForm(prev => ({ ...prev, profile_photo: '' }));
    };

    return (
        <div className="flex flex-col gap-4 md:gap-6  w-full">
            <div className=" -mt-[1.5rem] -ml-[1.5rem] -mr-[1.5rem]">
                <div className="w-full h-1.5 bg-muted rounded-full bg-red-500 overflow-hidden mb-4 w-[calc(100%+3rem)]">
                    <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Account Settings
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Manage your personal information and security settings.
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Formik
                            initialValues={{
                                name: user.name || '',
                                email: user.email || '',
                                profile_photo: user.profile_photo || '',
                            }}
                            validationSchema={validationSchema}
                            onSubmit={handleProfileSubmit}
                            enableReinitialize
                        >
                            {({ values, isSubmitting, setFieldValue }) => (
                                <Form className="space-y-4">
                                    <div className="flex items-center space-x-4 mb-4">
                                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                                            {previewImage ? (
                                                <img
                                                    src={previewImage}
                                                    alt="Profile"
                                                    className="w-16 h-16 rounded-full object-cover"
                                                />
                                            ) : user.name ? (
                                                <span className="text-lg font-medium text-gray-500">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </span>
                                            ) : (
                                                <span className="text-lg font-medium text-gray-500">?</span>
                                            )}
                                        </div>
                                        <div className="space-y-2 relative flex-1s">
                                            <Input
                                                type="file"
                                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                                onChange={(e) => handleImageUpload(e, setFieldValue)}
                                                className="text-sm"
                                            />
                                            {previewImage && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => removeImage(setFieldValue)}
                                                >
                                                    Remove
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-2 relative">
                                        <Label>Full Name *</Label>
                                        <Input
                                            name="name"
                                            value={values.name}
                                            onChange={(e) => { setFieldValue('name', e.target.value); setProfileForm(prev => ({ ...prev, name: e.target.value })); }}
                                            className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex w-fit items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full" />
                                        <ErrorMessage
                                            name="name"
                                            component="div"
                                            className="text-red-500 text-sm"
                                        />
                                    </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-2 relative">
                                        <Label>Email Address *</Label>
                                        <Input
                                            name="email"
                                            type="email"
                                            value={values.email}
                                            onChange={(e) => { setFieldValue('email', e.target.value); setProfileForm(prev => ({ ...prev, email: e.target.value })); }}
                                            className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex w-fit items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full" />
                                        <ErrorMessage
                                            name="email"
                                            component="div"
                                            className="text-red-500 text-sm"
                                        />
                                    </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-2 relative">
                                        <Label>Role</Label>
                                        <Input value={user.role || ''} disabled className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex w-fit items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full" />
                                    </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || loading}
                                        className="w-full"
                                    >
                                        {loading ? 'Saving...' : 'Update Profile'}
                                    </Button>
                                </Form>
                            )}
                        </Formik>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Formik
                            initialValues={{
                                currentPassword: '',
                                newPassword: '',
                                confirmPassword: '',
                            }}
                            validationSchema={passwordValidationSchema}
                            onSubmit={handlePasswordSubmit}
                        >
                            {({ isSubmitting }) => (
                                <Form className="space-y-4">
                                    <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-2 relative">
                                        <Label>Current Password *</Label>
                                        <Field as={Input} name="currentPassword" type="password" className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex w-fit items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full" />
                                        <ErrorMessage
                                            name="currentPassword"
                                            component="div"
                                            className="text-red-500 text-sm"
                                        />
                                    </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-2 relative">
                                        <Label>New Password *</Label>
                                        <Field as={Input} name="newPassword" type="password" className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex w-fit items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full" />
                                        <ErrorMessage
                                            name="newPassword"
                                            component="div"
                                            className="text-red-500 text-sm"
                                        />
                                    </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-2 relative">
                                        <Label>Confirm New Password *</Label>
                                        <Field as={Input} name="confirmPassword" type="password" className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex w-fit items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full" />
                                        <ErrorMessage
                                            name="confirmPassword"
                                            component="div"
                                            className="text-red-500 text-sm"
                                        />
                                    </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || passwordLoading}
                                        className="w-full"
                                    >
                                        {passwordLoading ? 'Changing...' : 'Change Password'}
                                    </Button>
                                </Form>
                            )}
                        </Formik>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
