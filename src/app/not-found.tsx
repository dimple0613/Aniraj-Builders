import { ArrowLeft, Rocket } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans 
                    bg-background text-foreground">

            {/* Background Ambience */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[20%] left-[20%] w-96 h-96 
                        bg-indigo-500/10 dark:bg-indigo-500/10 
                        rounded-full blur-[128px] animate-pulse-slow" />
                <div className="absolute bottom-[20%] right-[20%] w-64 h-64 
                        bg-emerald-500/10 dark:bg-emerald-500/5 
                        rounded-full blur-[96px] animate-pulse-slow delay-1000" />
            </div>

            {/* Card */}
            <div className="relative z-10 max-w-lg w-full text-center p-12 rounded-3xl 
                      bg-card/60 dark:bg-card/30
                      backdrop-blur-xl border border-border 
                      shadow-2xl animate-float">

                {/* Icon */}
                <div className="mx-auto w-24 h-24 mb-8 relative">
                    <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
                    <div className="relative bg-gradient-to-br 
                          from-background to-muted 
                          dark:from-card dark:to-background
                          p-6 rounded-2xl border border-border shadow-lg">
                        <Rocket className="w-full h-full text-indigo-500 -rotate-45" />
                    </div>
                </div>

                <h1 className="text-8xl font-black text-transparent bg-clip-text 
                       bg-gradient-to-b from-foreground to-foreground/30 
                       mb-2 tracking-tighter">
                    404
                </h1>

                <h2 className="text-2xl font-bold mb-4">
                    Lost in Space?
                </h2>

                <p className="text-muted-foreground mb-8 leading-relaxed">
                    The page you are looking for seems to have drifted away into the void.
                    Let's get you back to solid ground.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="/"
                        className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl 
                       bg-indigo-600 hover:bg-indigo-500 
                       text-white font-medium shadow-lg 
                       transition-all hover:scale-105 active:scale-95"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Return Home
                    </Link>

                    <button className="px-8 py-3 rounded-xl 
                             bg-muted hover:bg-muted/80 
                             border border-border 
                             transition-all hover:scale-105 active:scale-95">
                        Contact Support
                    </button>
                </div>
            </div>
        </div>
    );
}
