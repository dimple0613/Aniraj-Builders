'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const validationSchema = Yup.object({
    email: Yup.string()
        .email('Invalid email address')
        .required('Email is required'),
});

export default function ForgotPasswordFormClient() {
    const router = useRouter();
    const [emailSent, setEmailSent] = useState(false);

    const formik = useFormik({
        initialValues: {
            email: '',
        },
        validationSchema,
        onSubmit: async (values, { setSubmitting }) => {
            try {
                await axios.post('/api/auth/forgot-password', { email: values.email });
                setEmailSent(true);
                toast.success('If an account exists, a reset link has been sent');
            } catch (error: any) {
                toast.error(error.response?.data?.error || 'Failed to send reset link');
            } finally {
                setSubmitting(false);
            }
        },
    });

    if (emailSent) {
        return (
            <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6">
                    <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Check Your Email
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                    We have sent a password reset link to <strong>{formik.values.email}</strong>
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        The reset link will expire in 15 minutes. Please check your inbox and spam folder.
                    </p>
                </div>
                <Button
                    onClick={() => router.push('/login')}
                    className="w-full"
                >
                    Back to Login
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={formik.handleSubmit}>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-1 text-center">
                    <h1 className="text-2xl font-bold">Forgot Password?</h1>
                    <p className="text-muted-foreground text-sm text-balance">
                        Enter your email and we will send you a reset link
                    </p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        {...formik.getFieldProps('email')}
                    />
                    {formik.touched.email && formik.errors.email && (
                        <p className="text-sm text-destructive">{formik.errors.email}</p>
                    )}
                </div>

                <Button type="submit" className="w-full" disabled={formik.isSubmitting}>
                    {formik.isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        'Send Reset Link'
                    )}
                </Button>

                <div className="text-center text-sm">
                    <Link
                        href="/login"
                        className="text-muted-foreground hover:text-primary inline-flex items-center"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Login
                    </Link>
                </div>
            </div>
        </form>
    );
}
