import { Role } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    company_id: string | null;
    profile_photo: string | null;
    company_name?: string | null;
  }

  interface Session {
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      role: Role;
      company_id: string | null;
      profile_photo: string | null;
      company_name?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    company_id: string | null;
    profile_photo: string | null;
    company_name?: string | null;
  }
}
