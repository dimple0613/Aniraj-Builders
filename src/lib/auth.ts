import NextAuth, { AuthOptions, getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { Role } from "@prisma/client"

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    console.warn("[AUTH] Missing credentials - email/username or password");
                    return null;
                }

                const identifier = credentials.email as string;
                
                // Determine if input is email or username
                // Simple check: if it contains @, treat as email
                const isEmail = identifier.includes('@');
                
                const user = await prisma.user.findFirst({
                    where: isEmail 
                        ? { email: { equals: identifier, mode: 'insensitive' } }
                        : { username: { equals: identifier, mode: 'insensitive' } },
                    include: {
                        company: {
                            select: {
                                id: true,
                                company_name: true,
                                status: true
                            }
                        }
                    }
                });

                if (!user) {
                    console.warn(`[AUTH] User not found: ${identifier}`);
                    return null;
                }

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isValid) {
                    console.warn(`[AUTH] Invalid password for user: ${identifier}`);
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role as Role,
                    company_id: user.company_id,
                    zone_id: (user as any).zone_id,
                    profile_photo: user.profile_photo,
                    company_name: (user as any).company?.company_name || null,
                };
            }
        })
    ],
    callbacks: {
        async jwt({ token, user, trigger, session: sessionUpdate }) {

            if (user) {
                token.role = user.role;
                token.company_id = user.company_id;
                token.zone_id = (user as any).zone_id;
                token.name = user.name;
                token.email = user.email;
                token.profile_photo = user.profile_photo;
                token.company_name = (user as any).company_name;

            }

            if (trigger === 'update' && sessionUpdate) {
                if (sessionUpdate.name !== undefined) {
                    token.name = sessionUpdate.name;
                }
                if (sessionUpdate.email !== undefined) {
                    token.email = sessionUpdate.email;
                }
                if (sessionUpdate.company_id !== undefined && sessionUpdate.company_id !== null) {
                    token.company_id = sessionUpdate.company_id;
                }
                if ((sessionUpdate as any).zone_id !== undefined) {
                    token.zone_id = (sessionUpdate as any).zone_id;
                }
                if (sessionUpdate.profile_photo !== undefined) {
                    token.profile_photo = sessionUpdate.profile_photo;
                }
            }

            return token;
        },
        async session({ session, token, trigger, newSession }) {
            if (token && session.user) {
                (session.user as any).id = token.sub as string;
                (session.user as any).name = token.name as string;
                (session.user as any).email = token.email as string;
                (session.user as any).role = token.role as Role;
                (session.user as any).company_id = token.company_id as string | null;
                (session.user as any).zone_id = token.zone_id as string | null;
                (session.user as any).profile_photo = token.profile_photo as string | null;
                (session.user as any).company_name = token.company_name as string | null;

            }

            if (trigger === 'update') {
                if ((newSession as any)?.name !== undefined) {
                    (session.user as any).name = (newSession as any).name;
                }
                if ((newSession as any)?.email !== undefined) {
                    (session.user as any).email = (newSession as any).email;
                }
                if ((newSession as any)?.company_id !== undefined && (newSession as any)?.company_id !== null) {
                    (session.user as any).company_id = (newSession as any).company_id;
                }
                if ((newSession as any)?.zone_id !== undefined) {
                    (session.user as any).zone_id = (newSession as any).zone_id;
                }
                if ((newSession as any)?.profile_photo !== undefined) {
                    (session.user as any).profile_photo = (newSession as any).profile_photo;
                }
            }

            return session;
        }
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60,
    },
    debug: process.env.NODE_ENV === "development",
    logger: {
        error(code, metadata) {
            console.error("[AUTH ERROR]", code, metadata);
        },
        warn(code) {
            console.warn("[AUTH WARN]", code);
        },
        debug(code, metadata) {
            console.debug("[AUTH DEBUG]", code, metadata);
        }
    }
};

const handler = NextAuth(authOptions);
export { handler as default, getServerSession };
