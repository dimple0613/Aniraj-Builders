'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

interface PageProps {
    params: Promise<{
        company_slug: string;
    }>;
}

export default function PublicVardhiSuccessPage({ params }: PageProps) {
    const searchParams = useSearchParams();
    const vardhiNo = searchParams.get('vardhi_no');
    const [companySlug, setCompanySlug] = useState<string>('');
    const [companyName, setCompanyName] = useState<string>('');
    const [logo, setLogo] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(20);

    useEffect(() => {
        async function getCompanyData() {
            const { company_slug } = await params;
            setCompanySlug(company_slug);

            const company = await prisma.company.findUnique({
                where: { slug: company_slug },
                select: {
                    company_name: true,
                    logo: true,
                },
            });

            if (company) {
                setCompanyName(company.company_name);
                setLogo(company.logo);
            }
        }

        getCompanyData();
    }, [params]);

    useEffect(() => {
        if (!companySlug) return;

        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    window.location.href = `/${companySlug}/vardhi/add`;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [companySlug]);

    return (
        <div className="">
            <div className="max-w-md mx-auto">
                <div className="text-center">
                    {logo && (
                        <img
                            src={logo}
                            alt={companyName}
                            className="h-16 mx-auto mb-6"
                        />
                    )}

                    <div className="">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                            <svg
                                className="h-8 w-8 text-green-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Request Submitted Successfully!
                        </h2>

                        {vardhiNo && (
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                                <p className="text-sm text-blue-600 mb-1">Your Vardhi Number:</p>
                                <p className="text-xl font-bold text-blue-900">{vardhiNo}</p>
                            </div>
                        )}

                        <p className="text-gray-600 mb-6">
                            Your Vardhi request has been submitted to {companyName || 'the company'}.
                            They will review your request and get back to you soon.
                        </p>

                        <div className="flex gap-3">
                            <Link
                                href={`/${companySlug}/vardhi/add`}
                                className="w-1/2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-center"
                            >
                                Another Request
                            </Link>

                            <Link
                                href={`/${companySlug}`}
                                className="w-1/2 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-center"
                            >
                                Go to Home
                            </Link>
                        </div>

                        <p className="mt-4 text-sm text-gray-500">
                            Redirecting to add new request in {countdown} seconds...
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
