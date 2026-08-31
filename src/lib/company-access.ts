import { prisma } from './prisma';

export async function getCompanyAccessSettings() {
    let setting = await prisma.companyAccessSetting.findFirst();

    if (!setting) {
        setting = await prisma.companyAccessSetting.create({
            data: {
                allow_add_company: true,
                allow_edit_company: true,
            },
        });
    }

    return setting;
}

export async function canAddCompany(): Promise<boolean> {
    const settings = await getCompanyAccessSettings();
    return settings.allow_add_company;
}

export async function canEditCompany(): Promise<boolean> {
    const settings = await getCompanyAccessSettings();
    return settings.allow_edit_company;
}
