"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Labels } from "../ui/labels";

const validationSchema = Yup.object({
    email: Yup.string()
        .required("Email or username is required"),
    password: Yup.string()
        .min(6, "Password must be at least 6 characters")
        .required("Password is required"),
});

function LoginForm() {
    const [loading, setLoading] = useState(false);
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

    const formik = useFormik({
        initialValues: {
            email: "",
            password: "",
        },
        validationSchema,
        onSubmit: async (values) => {
            setLoading(true);

                try {
                    const result = await signIn("credentials", {
                        email: values.email,
                        password: values.password,
                        redirect: false,
                    });

                    if (result?.error) {
                        toast.error(result.error === "CredentialsSignin"
                            ? "Invalid email/username or password"
                            : "Authentication failed");
                    } else if (result?.ok) {
                        const sessionRes = await fetch("/api/auth/session?_=" + Date.now());
                        const session = await sessionRes.json();
                        const role = session?.user?.role;
                        const redirectUrl = role === "Zone" ? "/vardhi-summary" : callbackUrl;
                        toast.success("Login successful!");
                        window.location.href = redirectUrl;
                    }
            } catch (error) {
                console.error("Login error:", error);
                toast.error("An unexpected error occurred");
            } finally {
                setLoading(false);
            }
        },
    });

    return (
        <form onSubmit={formik.handleSubmit}>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-1 text-center">
                    <h1 className="text-2xl font-bold">Login to your account</h1>
                    <p className="text-muted-foreground text-sm text-balance">
                        Enter your email or username below to login to your account
                    </p>
                </div>
            
                <div className="grid gap-2">
                    <Labels htmlFor="identifier">Email or Username</Labels>
                    <Input
                        id="identifier"
                        type="text"
                        placeholder="m@example.com or johndoe123"
                        autoFocus
                        {...formik.getFieldProps("email")}
                    />
                    {formik.touched.email && formik.errors.email && (
                        <p className="text-sm text-destructive">
                            {formik.errors.email}
                        </p>
                    )}
                </div>

                <div className="grid gap-2">
                    <Labels htmlFor="password">Password</Labels>
                    <Input
                        id="password"
                        type="password"
                        {...formik.getFieldProps("password")}
                    />
                    {formik.touched.password && formik.errors.password && (
                        <p className="text-sm text-destructive">
                            {formik.errors.password}
                        </p>
                    )}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                </Button>

                <div className="text-center text-sm">
                    <Link
                        href="/forgot-password"
                        className="text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                    >
                        Forgot Password?
                    </Link>
                </div>
            </div>
        </form>
    )
}

export default function LoginFormClient() {
    return (
        <Suspense fallback={<div className="flex min-h-svh items-center justify-center">Loading...</div>}>
            <LoginForm />
        </Suspense>
    );
}
