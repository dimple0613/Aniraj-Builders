'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const validationSchema = Yup.object({
    password: Yup.string()
        .min(8, 'Password must be at least 8 characters')
        .matches(/[A-Z]/, 'Must contain at least one uppercase letter')
        .matches(/[a-z]/, 'Must contain at least one lowercase letter')
        .matches(/[0-9]/, 'Must contain at least one number')
        .required('Password is required'),
    confirmPassword: Yup.string()
        .oneOf([Yup.ref('password')], 'Passwords must match')
        .required('Confirm password is required'),
});

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        setTokenValid(!!token);
    }, [token]);

    const formik = useFormik({
        initialValues: {
            password: '',
            confirmPassword: '',
        },
        validationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        onSubmit: async (values, { setSubmitting }) => {
            if (!token) {
                toast.error('Invalid reset token');
                setSubmitting(false);
                return;
            }

            try {
                await axios.post('/api/auth/reset-password', { token, password: values.password });
                setSuccess(true);
                toast.success('Password reset successfully');
                setTimeout(() => router.push('/login'), 2000);
            } catch (error: any) {
                toast.error(error.response?.data?.error || 'Failed to reset password');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const getPasswordRequirements = () => {
        const { password } = formik.values;
        return [
            { label: 'At least 8 characters', met: password.length >= 8 },
            { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
            { label: 'One lowercase letter', met: /[a-z]/.test(password) },
            { label: 'One number', met: /[0-9]/.test(password) },
        ];
    };

    if (tokenValid === null) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
        );
    }

    if (tokenValid === false) {
        return (
            <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-6">
                    <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Invalid Link
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                    This password reset link is invalid or has expired.
                </p>
                <Button onClick={() => router.push('/forgot-password')}>
                    Request New Link
                </Button>
            </div>
        );
    }

    if (success) {
        return (
            <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Password Reset!
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                    Your password has been reset successfully.
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                    Redirecting to login...
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={formik.handleSubmit}>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-1 text-center">
                    <h1 className="text-2xl font-bold">Reset Password</h1>
                    <p className="text-muted-foreground text-sm text-balance">
                        Enter your new password below
                    </p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="password">New Password</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            {...formik.getFieldProps('password')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {formik.touched.password && formik.errors.password && (
                        <p className="text-sm text-destructive">{formik.errors.password}</p>
                    )}
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                        <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            {...formik.getFieldProps('confirmPassword')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                        <p className="text-sm text-destructive">{formik.errors.confirmPassword}</p>
                    )}
                </div>

                <div className="bg-muted rounded-lg p-3 space-y-1">
                    <p className="text-sm font-medium">Password Requirements:</p>
                    {getPasswordRequirements().map((req) => (
                        <div key={req.label} className="flex items-center gap-2 text-xs">
                            {req.met ? (
                                <CheckCircle className="w-3 h-3 text-green-500" />
                            ) : (
                                <div className="w-3 h-3 rounded-full border" />
                            )}
                            <span className={req.met ? 'text-green-600' : 'text-muted-foreground'}>
                                {req.label}
                            </span>
                        </div>
                    ))}
                </div>

                <Button type="submit" className="w-full" disabled={formik.isSubmitting || !formik.isValid}>
                    {formik.isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Resetting...
                        </>
                    ) : (
                        'Reset Password'
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

export default function ResetPasswordFormClient() {
    return (
        <Suspense>
            <ResetPasswordForm />
        </Suspense>
    );
}
