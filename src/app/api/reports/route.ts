import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';

function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber();
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'party-ledger';
    const gstType = searchParams.get('gstType') || 'gstr1';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const projectIdsParam = searchParams.get('project_ids');
    const partyIdsParam = searchParams.get('party_ids');
    const search = searchParams.get('search') || '';
    const month = searchParams.get('month');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sortField = searchParams.get('sortField') || 'transaction_date';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    const accountType = searchParams.get('account_type');
    const projectIds = projectIdsParam ? projectIdsParam.split(',') : [];
    const partyIds = partyIdsParam ? partyIdsParam.split(',') : [];

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    return await withCompany(async (company) => {
      const companyId = company?.company_id!;

      if (type === 'party-ledger') {
        const whereClause: any = {
          company_id: companyId,
          is_deleted: false,
        };

        if (partyIds.length > 0) whereClause.party_id = { in: partyIds };
        if (projectIds.length > 0) whereClause.project_id = { in: projectIds };
        if (startDate || endDate) {
          whereClause.transaction_date = dateFilter;
        }

        const [bankTransactions, cashTransactions, parties] = await Promise.all([
          prisma.bankBookTransaction.findMany({
            where: whereClause,
            include: {
              party: true,
              project: true,
              account: true,
            },
            orderBy: [{ transaction_date: 'asc' }, { sr_no: 'asc' }],
          }),
          prisma.cashBookTransaction.findMany({
            where: whereClause,
            include: {
              party: true,
              project: true,
              account: true,
            },
            orderBy: [{ transaction_date: 'asc' }, { sr_no: 'asc' }],
          }),
          prisma.party.findMany({
            where: { company_id: companyId },
            select: { id: true, name: true, bank_opening_balance: true },
          }),
        ]);

        const partyOpeningBalances = new Map(
          parties.map(p => [p.id, toNumber(p.bank_opening_balance)])
        );

        const allTransactions = [...bankTransactions, ...cashTransactions].sort(
          (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
        );

        const groupedByParty = new Map<string, typeof allTransactions>();
        for (const t of allTransactions) {
          if (!t.party_id) continue;
          if (!groupedByParty.has(t.party_id)) {
            groupedByParty.set(t.party_id, []);
          }
          groupedByParty.get(t.party_id)!.push(t);
        }

        const ledgerWithBalance: any[] = [];

        for (const [partyId, txns] of groupedByParty) {
          let currentBalance = partyOpeningBalances.get(partyId) || 0;
          const partyName = txns[0]?.party?.name || 'Unknown';

          for (const t of txns) {
            const debit = toNumber(t.debit_amount);
            const credit = toNumber(t.credit_amount);
            
            if (t.transaction_type === 'CREDIT') {
              currentBalance = currentBalance - credit;
            } else {
              currentBalance = currentBalance + debit;
            }

            const balanceStatus = currentBalance >= 0 ? 'CLEARED' : 'NOT_SUFFICIENT';

            ledgerWithBalance.push({
              ...t,
              opening_balance: partyOpeningBalances.get(partyId) || 0,
              running_balance: currentBalance,
              balance_status: balanceStatus,
              party_name: partyName,
            });
          }
        }

        let filtered = ledgerWithBalance;
        if (search) {
          filtered = filtered.filter((t: any) => 
            t.ledger?.toLowerCase().includes(search.toLowerCase()) ||
            t.party?.name?.toLowerCase().includes(search.toLowerCase()) ||
            t.party_name?.toLowerCase().includes(search.toLowerCase()) ||
            t.project?.name?.toLowerCase().includes(search.toLowerCase())
          );
        }

        const totalCount = filtered.length;

        filtered.sort((a: any, b: any) => {
          const aVal = a[sortField];
          const bVal = b[sortField];
          if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : -1;
          }
          return aVal < bVal ? 1 : -1;
        });

        const skip = (page - 1) * limit;
        const paginatedData = filtered.slice(skip, skip + limit);

        const summary = {
          totalDebit: filtered.reduce((sum: number, t: any) => sum + toNumber(t.debit_amount), 0),
          totalCredit: filtered.reduce((sum: number, t: any) => sum + toNumber(t.credit_amount), 0),
          notSufficientCount: filtered.filter((t: any) => t.balance_status === 'NOT_SUFFICIENT').length,
        };

        return NextResponse.json({
          success: true,
          message: 'Party ledger fetched successfully',
          data: paginatedData,
          summary,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
          },
        });
      }

      if (type === 'project-cost') {
        const whereClause: any = {
          company_id: companyId,
        };

        if (projectIds.length > 0) whereClause.project_id = { in: projectIds };
        if (startDate || endDate) {
          whereClause.transaction_date = dateFilter;
        }

        const transactions = await prisma.bankBookTransaction.findMany({
          where: whereClause,
        }) as any[];

        const projectCosts: Record<string, { totalDebit: number; totalCredit: number }> = {};
        
        for (const t of transactions) {
          if (t.project_id) {
            if (!projectCosts[t.project_id]) {
              projectCosts[t.project_id] = { totalDebit: 0, totalCredit: 0 };
            }
            projectCosts[t.project_id].totalDebit += t.debit_amount?.toNumber() || 0;
            projectCosts[t.project_id].totalCredit += t.credit_amount?.toNumber() || 0;
          }
        }

        const projectCostIds = Object.keys(projectCosts);
        const projects = await prisma.project.findMany({
          where: { id: { in: projectCostIds } },
          select: { id: true, name: true },
        });

        const projectMap = new Map(projects.map((p) => [p.id, p.name]));

        let projectCostData = Object.entries(projectCosts).map(([pid, costs]) => ({
          projectId: pid,
          projectName: projectMap.get(pid) || 'Unknown',
          totalDebit: costs.totalDebit,
          totalCredit: costs.totalCredit,
          netCost: costs.totalDebit - costs.totalCredit,
        }));

        if (search) {
          projectCostData = projectCostData.filter((p) =>
            p.projectName.toLowerCase().includes(search.toLowerCase())
          );
        }

        const total = projectCostData.length;
        const skip = (page - 1) * limit;
        
        if (sortField && sortField === 'projectName') {
          projectCostData.sort((a, b) => {
            const comparison = a.projectName.localeCompare(b.projectName);
            return sortOrder === 'asc' ? comparison : -comparison;
          });
        } else if (sortField && sortField === 'netCost') {
          projectCostData.sort((a, b) => {
            return sortOrder === 'asc' ? a.netCost - b.netCost : b.netCost - a.netCost;
          });
        } else if (sortField && sortField === 'totalDebit') {
          projectCostData.sort((a, b) => {
            return sortOrder === 'asc' ? a.totalDebit - b.totalDebit : b.totalDebit - a.totalDebit;
          });
        } else if (sortField && sortField === 'totalCredit') {
          projectCostData.sort((a, b) => {
            return sortOrder === 'asc' ? a.totalCredit - b.totalCredit : b.totalCredit - a.totalCredit;
          });
        }

        projectCostData = projectCostData.slice(skip, skip + limit);

        return NextResponse.json({
          success: true,
          message: 'Project cost fetched successfully',
          data: projectCostData,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        });
      }

      if (type === 'payable') {
        const monthFilter: any = {};
        if (month) {
          const [y, m] = month.split('-').map(Number);
          if (y && m) {
            monthFilter.gte = new Date(Date.UTC(y, m - 1, 1));
            monthFilter.lt = new Date(Date.UTC(y, m, 1));
          }
        }

        const effectiveDateFilter = month ? monthFilter : dateFilter;
        const effectiveAccountType = accountType || 'DEBIT';

        const purchaseEntries = await prisma.purchaseEntry.findMany({
          where: {
            company_id: companyId,
            account_type: effectiveAccountType,
            party_id: partyIds.length > 0 ? { in: partyIds } : undefined,
            project_id: projectIds.length > 0 ? { in: projectIds } : undefined,
            ...(startDate || endDate || month ? { entry_date: effectiveDateFilter } : {}),
          },
          include: {
            party: true,
            materials: true,
          },
        });

        const grouped = purchaseEntries.reduce((acc, entry) => {
          const pid = entry.party_id;
          if (!acc[pid]) {
            acc[pid] = {
              partyId: pid,
              partyName: entry.party?.name || 'Unknown',
              total: 0,
              accountNumber: entry.party?.bank_account_number || '',
              ifsc: entry.party?.bank_ifsc_code || '',
              bankName: entry.party?.bank_name || '',
              email: entry.party?.email || '',
            };
          }
          const materialsTotal = entry.materials.reduce((sum, m) => sum + toNumber(m.total), 0);
          const grandTotal = materialsTotal + toNumber(entry.gst_total);
          acc[pid].total += grandTotal;
          return acc;
        }, {} as Record<string, { partyId: string; partyName: string; total: number; accountNumber: string; ifsc: string; bankName: string; email: string }>);

        let payableData = Object.values(grouped);

        if (search) {
          payableData = payableData.filter((p) =>
            p.partyName.toLowerCase().includes(search.toLowerCase())
          );
        }

        const total = payableData.length;
        const summaryTotal = payableData.reduce((sum, p) => sum + toNumber(p.total), 0);
        const skip = (page - 1) * limit;

        if (sortField && sortField === 'partyName') {
          payableData.sort((a, b) => {
            const comparison = a.partyName.localeCompare(b.partyName);
            return sortOrder === 'asc' ? comparison : -comparison;
          });
        } else if (sortField && sortField === 'total') {
          payableData.sort((a, b) => {
            return sortOrder === 'asc' ? a.total - b.total : b.total - a.total;
          });
        }

        payableData = payableData.slice(skip, skip + limit);

        return NextResponse.json({
          success: true,
          message: 'Payable report fetched successfully',
          data: payableData,
          summary: {
            totalAmount: summaryTotal,
          },
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        });
      }

      if (type === 'receivable') {
        const monthFilter: any = {};
        if (month) {
          const [y, m] = month.split('-').map(Number);
          if (y && m) {
            monthFilter.gte = new Date(Date.UTC(y, m - 1, 1));
            monthFilter.lt = new Date(Date.UTC(y, m, 1));
          }
        }

        const effectiveDateFilter = month ? monthFilter : dateFilter;
        const effectiveAccountType = accountType || 'CREDIT';

        const purchaseEntries = await prisma.purchaseEntry.findMany({
          where: {
            company_id: companyId,
            account_type: effectiveAccountType,
            party_id: partyIds.length > 0 ? { in: partyIds } : undefined,
            project_id: projectIds.length > 0 ? { in: projectIds } : undefined,
            ...(startDate || endDate || month ? { entry_date: effectiveDateFilter } : {}),
          },
          include: {
            party: true,
            materials: true,
          },
        });

        const grouped = purchaseEntries.reduce((acc, entry) => {
          const pid = entry.party_id;
          if (!acc[pid]) {
            acc[pid] = {
              partyId: pid,
              partyName: entry.party?.name || 'Unknown',
              total: 0,
              accountNumber: entry.party?.bank_account_number || '',
              ifsc: entry.party?.bank_ifsc_code || '',
              bankName: entry.party?.bank_name || '',
              email: entry.party?.email || '',
            };
          }
          const materialsTotal = entry.materials.reduce((sum, m) => sum + toNumber(m.total), 0);
          const grandTotal = materialsTotal + toNumber(entry.gst_total);
          acc[pid].total += grandTotal;
          return acc;
        }, {} as Record<string, { partyId: string; partyName: string; total: number; accountNumber: string; ifsc: string; bankName: string; email: string }>);

        let receivableData = Object.values(grouped);

        if (search) {
          receivableData = receivableData.filter((r) =>
            r.partyName.toLowerCase().includes(search.toLowerCase())
          );
        }

        const total = receivableData.length;
        const summaryTotal = receivableData.reduce((sum, p) => sum + toNumber(p.total), 0);
        const skip = (page - 1) * limit;

        if (sortField && sortField === 'partyName') {
          receivableData.sort((a, b) => {
            const comparison = a.partyName.localeCompare(b.partyName);
            return sortOrder === 'asc' ? comparison : -comparison;
          });
        } else if (sortField && sortField === 'total') {
          receivableData.sort((a, b) => {
            return sortOrder === 'asc' ? a.total - b.total : b.total - a.total;
          });
        }

        receivableData = receivableData.slice(skip, skip + limit);

        return NextResponse.json({
          success: true,
          message: 'Receivable report fetched successfully',
          data: receivableData,
          summary: {
            totalAmount: summaryTotal,
          },
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        });
      }

      if (type === 'gst') {
        const company = await prisma.company.findFirst({ where: { id: companyId } });
        
        if (gstType === 'gstr1' || gstType === 'gstr2') {
          const purchases = await prisma.purchaseEntry.findMany({
            where: {
              company_id: companyId,
              ...(startDate || endDate ? { entry_date: dateFilter } : {}),
              gst_percent: { gt: 0 },
            },
            include: {
              party: true,
              materials: {
                include: {
                  capitalSOR: true,
                },
              },
            },
            orderBy: [{ entry_date: 'asc' }, { sr_no: 'asc' }],
          });

          let gstData: any[];

          if (gstType === 'gstr1') {
            gstData = (purchases as any[]).map((p: any) => {
              const taxableAmount = p.materials.reduce((sum: number, m: any) => sum + m.total.toNumber(), 0);
              const cgst = toNumber(p.gst_total) / 2;
              const sgst = cgst;
              const igst = p.transaction_type === 'INTER_STATE' ? toNumber(p.gst_total) : 0;
              
              return {
                id: p.id,
                invoiceNo: p.entry_no || `PE/${p.sr_no}`,
                date: p.entry_date,
                partyName: p.party.name,
                partyGstin: p.party.gst_no || '',
                voucherType: p.voucher_type,
                transactionType: p.transaction_type,
                taxableAmount,
                cgstRate: p.gst_percent.toNumber() / 2,
                sgstRate: p.gst_percent.toNumber() / 2,
                igstRate: p.transaction_type === 'INTER_STATE' ? p.gst_percent.toNumber() : 0,
                cgstAmount: cgst,
                sgstAmount: sgst,
                igstAmount: igst,
                totalGst: toNumber(p.gst_total),
                grandTotal: taxableAmount + toNumber(p.gst_total),
              };
            });
          } else {
            gstData = (purchases as any[]).map((p: any) => {
              const taxableAmount = p.materials.reduce((sum: number, m: any) => sum + m.total.toNumber(), 0);
              const cgst = toNumber(p.gst_total) / 2;
              const sgst = cgst;
              const igst = p.transaction_type === 'INTER_STATE' ? toNumber(p.gst_total) : 0;
              
              return {
                id: p.id,
                invoiceNo: p.entry_no || `PE/${p.sr_no}`,
                date: p.entry_date,
                partyName: p.party.name,
                partyGstin: p.party.gst_no || '',
                transactionType: p.transaction_type,
                taxableAmount,
                cgstAmount: cgst,
                sgstAmount: sgst,
                igstAmount: igst,
                totalGst: toNumber(p.gst_total),
                grandTotal: taxableAmount + toNumber(p.gst_total),
                itcClaim: toNumber(p.gst_total),
              };
            });
          }

          if (search) {
            gstData = gstData.filter((g: any) =>
              g.partyName.toLowerCase().includes(search.toLowerCase()) ||
              g.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
              g.partyGstin?.toLowerCase().includes(search.toLowerCase())
            );
          }

          const total = gstData.length;
          const skip = (page - 1) * limit;

          if (sortField) {
            gstData.sort((a: any, b: any) => {
              const aVal = a[sortField];
              const bVal = b[sortField];
              if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
              }
              return aVal < bVal ? 1 : -1;
            });
          }

          const paginatedData = gstData.slice(skip, skip + limit);

          const summary = {
            totalTaxable: gstData.reduce((sum: number, g: any) => sum + g.taxableAmount, 0),
            totalCgst: gstData.reduce((sum: number, g: any) => sum + g.cgstAmount, 0),
            totalSgst: gstData.reduce((sum: number, g: any) => sum + g.sgstAmount, 0),
            totalIgst: gstData.reduce((sum: number, g: any) => sum + g.igstAmount, 0),
            totalGst: gstData.reduce((sum: number, g: any) => sum + g.totalGst, 0),
            totalGrand: gstData.reduce((sum: number, g: any) => sum + g.grandTotal, 0),
          };

          return NextResponse.json({
            success: true,
            message: `${gstType.toUpperCase()} report fetched successfully`,
            data: paginatedData,
            summary,
            pagination: {
              page,
              limit,
              total,
              pages: Math.ceil(total / limit),
            },
          });
        }

        if (gstType === 'gstr3b') {
          const purchases = await prisma.purchaseEntry.findMany({
            where: {
              company_id: companyId,
              ...(startDate || endDate ? { entry_date: dateFilter } : {}),
              gst_percent: { gt: 0 },
            },
            include: {
              party: true,
              materials: true,
            },
          });

          const intraStatePurchases = purchases.filter(p => p.transaction_type === 'LOCAL' || p.transaction_type === 'LOCAL');
          const interStatePurchases = purchases.filter(p => p.transaction_type === 'INTER_STATE');

          const intraStateTaxable = intraStatePurchases.reduce((sum, p) => 
            sum + p.materials.reduce((s, m) => s + m.total.toNumber(), 0), 0);
          const interStateTaxable = interStatePurchases.reduce((sum, p) => 
            sum + p.materials.reduce((s, m) => s + m.total.toNumber(), 0), 0);

          const intraStateGst = intraStatePurchases.reduce((sum, p) => sum + toNumber(p.gst_total), 0);
          const interStateGst = interStatePurchases.reduce((sum, p) => sum + toNumber(p.gst_total), 0);

          const cgst = intraStateGst / 2;
          const sgst = cgst;
          const igst = interStateGst;

          const gstr3bData = {
            summary: {
              period: startDate && endDate ? `${startDate} to ${endDate}` : 'All Period',
              generatedDate: new Date().toISOString(),
            },
            sales: {
              intraState: {
                taxableAmount: 0,
                cgst: 0,
                sgst: 0,
                igst: 0,
                total: 0,
              },
              interState: {
                taxableAmount: 0,
                cgst: 0,
                sgst: 0,
                igst: 0,
                total: 0,
              },
              totalTaxable: 0,
              totalGst: 0,
            },
            purchases: {
              intraState: {
                taxableAmount: intraStateTaxable,
                cgst: cgst,
                sgst: sgst,
                igst: 0,
                total: intraStateTaxable + intraStateGst,
              },
              interState: {
                taxableAmount: interStateTaxable,
                cgst: 0,
                sgst: 0,
                igst: igst,
                total: interStateTaxable + interStateGst,
              },
              totalTaxable: intraStateTaxable + interStateTaxable,
              totalGst: intraStateGst + interStateGst,
            },
            itc: {
              cgst: cgst,
              sgst: sgst,
              igst: igst,
              total: cgst + sgst + igst,
            },
            netLiability: {
              cgst: Math.max(0, cgst - cgst),
              sgst: Math.max(0, sgst - sgst),
              igst: Math.max(0, igst - igst),
              total: Math.max(0, (cgst + sgst + igst) - (cgst + sgst + igst)),
            },
            totalTaxable: intraStateTaxable + interStateTaxable,
            totalGst: intraStateGst + interStateGst,
          };

          return NextResponse.json({
            success: true,
            message: 'GSTR-3B summary fetched successfully',
            data: gstr3bData,
          });
        }

        return NextResponse.json(
          { success: false, message: 'Invalid GST report type. Use: gstr1, gstr2, or gstr3b' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, message: 'Invalid report type' },
        { status: 400 }
      );
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}
