import { ShieldAlert } from 'lucide-react';

export function AccessDenied() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
            <div className="bg-red-500/10 p-4 rounded-full mb-6">
                <ShieldAlert className="h-12 w-12 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-slate-400 max-w-md">
                You do not have permission to access this page.
                Please contact your Administrator.
            </p>
        </div>
    );
}
