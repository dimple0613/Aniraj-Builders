'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const AppSidebar = dynamic(() => import('./app-sidebar').then(mod => mod.AppSidebar), { ssr: false });
const SiteHeader = dynamic(() => import('./site-header').then(mod => mod.SiteHeader), { ssr: false });

export function DynamicSidebar(props: ComponentProps<typeof AppSidebar>) {
    return <AppSidebar {...props} />;
}

export function DynamicHeader() {
    return <SiteHeader />;
}
