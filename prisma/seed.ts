import { PrismaClient } from '@prisma/client'
import { upsertDefaultSalaryComponents } from '../src/lib/payroll-defaults'
const prisma = new PrismaClient()

async function main() {
    console.log('Cleaning up database...')

    // Truncate all tables with CASCADE to handle FK constraints
    const tablenames = await prisma.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    const tables = tablenames
        .map(({ tablename }) => tablename)
        .filter((name) => name !== '_prisma_migrations')
        .map((name) => `"public"."${name}"`)
        .join(', ');

    if (tables.length > 0) {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    }

    const companyA = await prisma.company.create({
        data: {
            company_name: 'Aniraj Builders',
            slug: 'aniraj',
            status: 'ACTIVE',
        },
    })

    const bcrypt = require('bcryptjs')
    const hashedPassword = await bcrypt.hash('password12345', 10)

    await prisma.user.create({
        data: {
            company_id: companyA.id,
            name: 'Aniraj Admin',
            email: 'anirajbuildrrs1995@gmail.com',
            password: hashedPassword,
            role: 'Admin',
        },
    })

    await prisma.user.create({
        data: {
            company_id: companyA.id,
            name: 'Aniraj Accountant',
            email: 'accountant@aniraj.com',
            password: hashedPassword,       
            role: 'Accountant',
        },
    })

    await prisma.user.create({
        data: {
            company_id: companyA.id,
            name: 'Aniraj Operator',
            email: 'operator@aniraj.com',
            password: hashedPassword,
            role: 'DataEntry',
        },
    })

    await prisma.user.create({
        data: {
            company_id: companyA.id,
            name: 'Aniraj Supervisor',
            email: 'supervisor@aniraj.com',
            password: hashedPassword,
            role: 'Supervisor',
        },
    })

    const companyB = await prisma.company.create({
        data: {
            company_name: 'Test Corp',
            slug: 'test',
            status: 'ACTIVE',
        },
    })

    await prisma.user.create({
        data: {
            company_id: companyB.id,
            name: 'Test Admin',
            email: 'admin@test.com',
            password: hashedPassword,
            role: 'Admin',
        },
    })

    await prisma.user.create({
        data: {
            name: 'Super Admin',
            email: 'npandya7874@gmail.com',
            password: hashedPassword,
            role: 'SuperAdmin',
        },
    })

    await prisma.workType.createMany({
        data: [
            {
                company_id: companyA.id,
                name: 'Maintenance',
                is_active: true
            },
            {
                company_id: companyA.id,
                name: 'Capital',
                is_active: true
            }
        ],
        skipDuplicates: true
    })

    await upsertDefaultSalaryComponents(prisma, companyA.id)
    await upsertDefaultSalaryComponents(prisma, companyB.id)

    console.log('Seed completed successfully')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
