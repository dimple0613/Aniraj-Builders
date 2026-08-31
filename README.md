# Aniraj-Builders

A construction / builder management web application built with **Next.js (App Router)**, **TypeScript**, **Prisma (PostgreSQL)**, **Tailwind CSS**, and **shadcn/ui**.

## Features

- **Dashboard** with role-based views (Admin, Accountant, Supervisor, etc.)
- **Bank Book & Cash Book** with ledger management
- **Payable & Receivable Reports** with project/month filters and bulk payment (banking `.txt`) file generation
- **Purchase Entries** with GST, materials, and tax invoice generation
- **Projects** with stages, abstract preview, forms, photos & correspondence
- **Party Ledger / Project Cost / GST Reports**
- **HR & Payroll** (employees, salaries, leaves, loans, payslips, reimbursements)
- **Vardhi / Billing** management
- Authentication, RBAC/permissions, notifications, and multi-company support

## Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui components
- **Auth**: NextAuth (credentials)
- **Forms/Validation**: Formik + Yup

## Getting Started

### Prerequisites

- Node.js 18.17.0 or higher
- PostgreSQL database

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd anirajbildersnew
```

2. Install dependencies:

```bash
npm install --legacy-peer-deps
```

3. Set up the database and environment variables:

```bash
cp .env.example .env
# configure DATABASE_URL and other required values
```

4. Generate the Prisma client and push the schema:

```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run prisma:generate` - Generate the Prisma client
- `npm run prisma:push` - Push the Prisma schema to the database
- `npm run prisma:seed` - Seed the database

## Environment Variables

Create a `.env` file (see `.env.example`) with configuration such as:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/aniraj_builders
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

## License

MIT
