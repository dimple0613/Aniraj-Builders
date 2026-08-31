'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Column, DataTable, DataTableFilter } from '../common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from '@/components/ui/dialog';
import { InlineSelect } from '@/components/common/InlineSelect';
import { Printer, FileText, Download } from 'lucide-react';
import { formatIndianCurrency } from '@/lib/financial-year';

type ReportType = 'party-ledger' | 'project-cost' | 'payable' | 'receivable' | 'gst';
type GstReportType = 'gstr1' | 'gstr2' | 'gstr3b';

interface PartyLedgerEntry {
	id: string;
	transaction_date: string;
	ledger: string;
	transaction_type: string;
	credit_amount: string;
	debit_amount: string;
	party?: { name: string };
	project?: { name: string };
	against_reference?: string;
}

interface ProjectCostEntry {
	projectId: string;
	projectName: string;
	totalDebit: number;
	totalCredit: number;
	netCost: number;
}

interface PayableEntry {
	partyId: string;
	partyName: string;
	total: number;
}

interface ReceivableEntry {
	partyId: string;
	partyName: string;
	total: number;
}

interface GstEntry {
	id: string;
	srNo: number;
	entryDate: string;
	partyName: string;
	gstPercent: number;
	gstTotal: number;
	total: number;
}

const REPORT_TYPES = [
	{ label: 'Party Ledger', value: 'party-ledger' },
	{ label: 'Project Cost Report', value: 'project-cost' },
	{ label: 'Payable Report', value: 'payable' },
	{ label: 'Receivable Report', value: 'receivable' },
	{ label: 'GST Report', value: 'gst' },
];

export function ReportsClient() {
	const [reportType, setReportType] = useState<ReportType>('party-ledger');
	const [gstReportType, setGstReportType] = useState<GstReportType>('gstr1');
	const [data, setData] = useState<any>([]);
	const [summary, setSummary] = useState<any>(null);
	const [gstSummary, setGstSummary] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [selectedParty, setSelectedParty] = useState<string[]>([]);
	const [selectedProject, setSelectedProject] = useState<string[]>([]);
	const [partyOptions, setPartyOptions] = useState<Array<{ label: string; value: string }>>([]);
	const [projectOptions, setProjectOptions] = useState<Array<{ label: string; value: string }>>([]);
	const [previewEntry, setPreviewEntry] = useState<any>(null);
	const [previewOpen, setPreviewOpen] = useState(false);

	const fetchParties = useCallback(async () => {
		try {
			const response = await axios.get('/api/parties?limit=9999');
			const parties = response.data.data || response.data;
			setPartyOptions(
				(Array.isArray(parties) ? parties : []).map((p: any) => ({
					label: p.name,
					value: p.id,
				}))
			);
		} catch {
			toast.error('Failed to fetch parties');
		}
	}, []);

	const fetchProjects = useCallback(async () => {
		try {
			const response = await axios.get('/api/projects?limit=9999');
			const projects = response.data.data || response.data;
			setProjectOptions(
				(Array.isArray(projects) ? projects : []).map((p: any) => ({
					label: p.name,
					value: p.id,
				}))
			);
		} catch {
			toast.error('Failed to fetch projects');
		}
	}, []);

	useEffect(() => {
		fetchParties();
		fetchProjects();
	}, [fetchParties, fetchProjects]);

	const fetchReport = useCallback(async () => {
		try {
			setLoading(true);
			const params = new URLSearchParams();
			params.append('type', reportType);
			if (reportType === 'gst') {
				params.append('gstType', gstReportType);
			}
			if (startDate) params.append('start_date', startDate);
			if (endDate) params.append('end_date', endDate);
			if (selectedParty.length > 0) params.append('party_ids', selectedParty.join(','));
			if (selectedProject.length > 0) params.append('project_ids', selectedProject.join(','));

			const response = await axios.get(`/api/reports?${params.toString()}`);
			setData(response.data.data || []);
			if (reportType === 'party-ledger' && response.data.summary) {
				setSummary(response.data.summary);
			} else {
				setSummary(null);
			}
			if (reportType === 'gst' && response.data.summary) {
				setGstSummary(response.data.summary);
			} else {
				setGstSummary(null);
			}
		} catch {
			toast.error('Failed to fetch report');
		} finally {
			setLoading(false);
		}
	}, [reportType, gstReportType, startDate, endDate, selectedParty, selectedProject]);

	useEffect(() => {
		fetchReport();
	}, [fetchReport, gstReportType]);

	const handlePrint = () => {
		window.print();
	};

	const handleExport = () => {
		const csvContent = generateCSV();
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
		link.click();
	};

	const generateCSV = () => {
		if (data.length === 0) return '';
		const headers = Object.keys(data[0]);
		const rows = data.map((row: any) =>
			headers.map((header: any) => JSON.stringify(row[header] ?? '')).join(',')
		);
		return [headers.join(','), ...rows].join('\n');
	};

	const columns = useMemo<Column<any>[]>(() => {
		switch (reportType) {
			case 'party-ledger':
				return [
					{
						header: 'Date',
						accessorKey: 'transaction_date',
						cell: (item: any) => (
							<span className="text-sm">
								{new Date(item.transaction_date).toLocaleDateString()}
							</span>
						),
					},
					{
						header: 'Ledger',
						accessorKey: 'ledger',
					},
					{
						header: 'Party',
						accessorKey: 'party',
						cell: (item: any) => item.party?.name || '-',
					},
					{
						header: 'Project',
						accessorKey: 'project',
						cell: (item: any) => (
							<div className="text-sm text-muted-foreground truncate max-w-[200px]">
								{item.project?.name || '-'}
							</div>
						),
					},
					{
						header: 'Type',
						accessorKey: 'transaction_type',
						cell: (item: any) => (
							<Badge
								variant={item.transaction_type === 'CREDIT' ? 'default' : 'destructive'}
							>
								{item.transaction_type}
							</Badge>
						),
					},
					{
						header: 'Debit',
						accessorKey: 'debit_amount',
						cell: (item: any) => (
							<span className="text-red-600 font-medium">
								{item.debit_amount > 0 ? `₹${formatIndianCurrency(Number(item.debit_amount))}` : '-'}
							</span>
						),
					},
					{
						header: 'Credit',
						accessorKey: 'credit_amount',
						cell: (item: any) => (
							<span className="text-green-600 font-medium">
								{item.credit_amount > 0 ? `₹${formatIndianCurrency(Number(item.credit_amount))}` : '-'}
							</span>
						),
					},
					{
						header: 'Balance',
						accessorKey: 'running_balance',
						cell: (item: any) => (
							<span className={`font-medium ${item.balance_status === 'NOT_SUFFICIENT' ? 'text-red-600' : 'text-green-600'}`}>
								{item.balance_status === 'NOT_SUFFICIENT' ? `₹${formatIndianCurrency(Number(item.running_balance))}` : `₹${formatIndianCurrency(Number(item.running_balance))}`}
							</span>
						),
					},
				];

			case 'project-cost':
				return [
					{
						header: 'Project',
						accessorKey: 'projectName',
						cell: (item: any) => (
							<div className="flex flex-col truncate max-w-[200px] font-medium">
								{item.projectName}							</div>
						),
					},
					{
						header: 'Total Debit',
						accessorKey: 'totalDebit',
						cell: (item: any) => (
							<span className="text-red-600 font-medium">
								₹{item.totalDebit.toLocaleString()}
							</span>
						),
					},
					{
						header: 'Total Credit',
						accessorKey: 'totalCredit',
						cell: (item: any) => (
							<span className="text-green-600 font-medium">
								₹{item.totalCredit.toLocaleString()}
							</span>
						),
					},
					{
						header: 'Net Cost',
						accessorKey: 'netCost',
						cell: (item: any) => (
							<span
								className={`font-bold ${item.netCost > 0 ? 'text-red-600' : 'text-green-600'
									}`}
							>
								₹{item.netCost.toLocaleString()}
							</span>
						),
					},
				];

			case 'payable':
			case 'receivable':
				return [
					{
						header: 'Party',
						accessorKey: 'partyName',
						cell: (item: any) => (
							<div className="flex flex-col">
								<span className="font-medium">{item.partyName}</span>
							</div>
						),
					},
					{
						header: 'Total Amount',
						accessorKey: 'total',
						cell: (item: any) => (
							<span className="font-bold text-red-600">
								₹{item.total.toLocaleString()}
							</span>
						),
					},
				];

			case 'gst':
				if (gstReportType === 'gstr1' || gstReportType === 'gstr2') {
					return [
						{
							header: 'Invoice No',
							accessorKey: 'invoiceNo',
						},
						{
							header: 'Date',
							accessorKey: 'date',
							cell: (item: any) => (
								<span className="text-sm">
									{new Date(item.date).toLocaleDateString()}
								</span>
							),
						},
						{
							header: 'Party',
							accessorKey: 'partyName',
						},
						{
							header: 'GSTIN',
							accessorKey: 'partyGstin',
						},
						{
							header: 'Type',
							accessorKey: 'transactionType',
							cell: (item: any) => (
								<Badge variant={item.transactionType === 'INTER_STATE' ? 'destructive' : 'default'}>
									{item.transactionType === 'INTER_STATE' ? 'IGST' : 'CGST/SGST'}
								</Badge>
							),
						},
						{
							header: 'Taxable',
							accessorKey: 'taxableAmount',
							cell: (item: any) => (
								<span className="font-medium">₹{item.taxableAmount?.toLocaleString()}</span>
							),
						},
						{
							header: 'CGST',
							accessorKey: 'cgstAmount',
							cell: (item: any) => (
								<span>₹{item.cgstAmount?.toLocaleString()}</span>
							),
						},
						{
							header: 'SGST',
							accessorKey: 'sgstAmount',
							cell: (item: any) => (
								<span>₹{item.sgstAmount?.toLocaleString()}</span>
							),
						},
						{
							header: 'IGST',
							accessorKey: 'igstAmount',
							cell: (item: any) => (
								<span>₹{item.igstAmount?.toLocaleString()}</span>
							),
						},
						{
							header: 'Total GST',
							accessorKey: 'totalGst',
							cell: (item: any) => (
								<span className="font-medium">₹{item.totalGst?.toLocaleString()}</span>
							),
						},
						{
							header: 'Grand Total',
							accessorKey: 'grandTotal',
							cell: (item: any) => (
								<span className="font-bold">₹{item.grandTotal?.toLocaleString()}</span>
							),
						},
					];
				}
				return [];

			default:
				return [];
		}
	}, [reportType]);

	const totals = useMemo(() => {
		const safeArray = Array.isArray(data) ? data : [];

		switch (reportType) {
			case 'party-ledger': {
				const ledgerData = safeArray as PartyLedgerEntry[];

				return {
					totalDebit: ledgerData.reduce(
						(sum, item) => sum + Number(item.debit_amount || 0),
						0
					),
					totalCredit: ledgerData.reduce(
						(sum, item) => sum + Number(item.credit_amount || 0),
						0
					),
				};
			}

			case 'project-cost': {
				const costData = safeArray as ProjectCostEntry[];

				return {
					totalDebit: costData.reduce(
						(sum, item) => sum + (item.totalDebit || 0),
						0
					),
					totalCredit: costData.reduce(
						(sum, item) => sum + (item.totalCredit || 0),
						0
					),
					netCost: costData.reduce(
						(sum, item) => sum + (item.netCost || 0),
						0
					),
				};
			}

			case 'payable':
			case 'receivable': {
				const amountData = safeArray as (PayableEntry | ReceivableEntry)[];

				return {
					totalAmount: amountData.reduce(
						(sum, item) => sum + (item.total || 0),
						0
					),
				};
			}

			case 'gst': {
				const gstData = safeArray as GstEntry[];

				return {
					totalAmount: gstData.reduce(
						(sum, item) => sum + (item.total || 0),
						0
					),
					totalGst: gstData.reduce(
						(sum, item) => sum + (item.gstTotal || 0),
						0
					),
				};
			}

			default:
				return {};
		}
	}, [data, reportType]);
	return (
		<div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
			<div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
				<div className="flex flex-col gap-1">
					<h2 className="text-xl md:text-2xl font-semibold tracking-tight">
						Reports
					</h2>
				</div>
			</div>

			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4">
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
							<div className="space-y-2">
								<Label>Report Type</Label>
								<InlineSelect
									value={reportType}
									onChange={(value) => setReportType(value as ReportType)}
									options={REPORT_TYPES}
									placeholder="Select report type"
								/>
							</div>

							{reportType === 'gst' && (
								<div className="space-y-2">
									<Label>GST Type</Label>
									<div className="flex gap-2">
										<Button
											variant={gstReportType === 'gstr1' ? 'default' : 'outline'}
											size="sm"
											onClick={() => setGstReportType('gstr1')}
										>
											GSTR-1
										</Button>
										<Button
											variant={gstReportType === 'gstr2' ? 'default' : 'outline'}
											size="sm"
											onClick={() => setGstReportType('gstr2')}
										>
											GSTR-2
										</Button>
										<Button
											variant={gstReportType === 'gstr3b' ? 'default' : 'outline'}
											size="sm"
											onClick={() => setGstReportType('gstr3b')}
										>
											GSTR-3B
										</Button>
									</div>
								</div>
							)}

							<div className="space-y-2">
								<Label>Start Date</Label>
								<Input
									type="date"
									value={startDate}
									onChange={(e) => setStartDate(e.target.value)}
								/>
							</div>

							<div className="space-y-2">
								<Label>End Date</Label>
								<Input
									type="date"
									value={endDate}
									onChange={(e) => setEndDate(e.target.value)}
								/>
							</div>

							{(reportType === 'party-ledger' || reportType === 'payable' || reportType === 'receivable') && (
								<div className="space-y-2">
									<Label>Party</Label>
									<DataTableFilter
										title="Party"
										options={partyOptions}
										selectedValues={selectedParty}
										onChange={(values) => setSelectedParty(values)}
									/>
								</div>
							)}

							{(reportType === 'party-ledger' || reportType === 'project-cost') && (
								<div className="space-y-2">
									<Label>Project</Label>
									<DataTableFilter
										title="Project"
										options={projectOptions}
										selectedValues={selectedProject}
										onChange={(values) => setSelectedProject(values)}
									/>
								</div>
							)}
						</div>

						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={handleExport} disabled={loading || data.length === 0}>
								<Download className="h-4 w-4 mr-2" />
								Export CSV
							</Button>
							<Button variant="outline" onClick={handlePrint} disabled={loading || data.length === 0}>
								<Printer className="h-4 w-4 mr-2" />
								Print
							</Button>
							<Button onClick={fetchReport} disabled={loading}>
								{loading ? 'Loading...' : 'Generate Report'}
							</Button>
						</div>
					</div>
				</CardHeader>

				<CardContent>
					{reportType === 'gst' && gstReportType === 'gstr3b' && data && data.summary ? (
						<div className="space-y-6">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<Card>
									<CardHeader><h3 className="font-semibold">Intra-State (CGST/SGST)</h3></CardHeader>
									<CardContent>
										<div className="space-y-2">
											<div className="flex justify-between"><span>Taxable Amount</span><span className="font-bold">₹{data.summary.purchases?.intraState?.taxableAmount?.toLocaleString() || 0}</span></div>
											<div className="flex justify-between"><span>CGST</span><span className="font-bold text-blue-600">₹{data.summary.purchases?.intraState?.cgst?.toLocaleString() || 0}</span></div>
											<div className="flex justify-between"><span>SGST</span><span className="font-bold text-purple-600">₹{data.summary.purchases?.intraState?.sgst?.toLocaleString() || 0}</span></div>
											<div className="flex justify-between border-t pt-2"><span>Total</span><span className="font-bold">₹{data.summary.purchases?.intraState?.total?.toLocaleString() || 0}</span></div>
										</div>
									</CardContent>
								</Card>
								<Card>
									<CardHeader><h3 className="font-semibold">Inter-State (IGST)</h3></CardHeader>
									<CardContent>
										<div className="space-y-2">
											<div className="flex justify-between"><span>Taxable Amount</span><span className="font-bold">₹{data.summary.purchases?.interState?.taxableAmount?.toLocaleString() || 0}</span></div>
											<div className="flex justify-between"><span>IGST</span><span className="font-bold text-orange-600">₹{data.summary.purchases?.interState?.igst?.toLocaleString() || 0}</span></div>
											<div className="flex justify-between border-t pt-2"><span>Total</span><span className="font-bold">₹{data.summary.purchases?.interState?.total?.toLocaleString() || 0}</span></div>
										</div>
									</CardContent>
								</Card>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<Card>
									<CardHeader><h3 className="font-semibold">Total Purchases</h3></CardHeader>
									<CardContent>
										<div className="space-y-2">
											<div className="flex justify-between"><span>Taxable Amount</span><span className="font-bold">₹{data.summary.purchases?.totalTaxable?.toLocaleString() || 0}</span></div>
											<div className="flex justify-between"><span>Total GST</span><span className="font-bold text-amber-600">₹{data.summary.purchases?.totalGst?.toLocaleString() || 0}</span></div>
										</div>
									</CardContent>
								</Card>
								<Card>
									<CardHeader><h3 className="font-semibold">Input Tax Credit (ITC)</h3></CardHeader>
									<CardContent>
										<div className="space-y-2">
											<div className="flex justify-between"><span>CGST ITC</span><span className="font-bold text-blue-600">₹{data.summary.itc?.cgst?.toLocaleString() || 0}</span></div>
											<div className="flex justify-between"><span>SGST ITC</span><span className="font-bold text-purple-600">₹{data.summary.itc?.sgst?.toLocaleString() || 0}</span></div>
											<div className="flex justify-between"><span>IGST ITC</span><span className="font-bold text-orange-600">₹{data.summary.itc?.igst?.toLocaleString() || 0}</span></div>
											<div className="flex justify-between border-t pt-2"><span>Total ITC</span><span className="font-bold text-green-600">₹{data.summary.itc?.total?.toLocaleString() || 0}</span></div>
										</div>
									</CardContent>
								</Card>
								<Card>
									<CardHeader><h3 className="font-semibold">Net GST Payable</h3></CardHeader>
									<CardContent>
										<div className="space-y-2">
											<div className="flex justify-between"><span>CGST</span><span className="font-bold">₹{data.summary.netLiability?.cgst?.toLocaleString() || 0}</span></div>
											<div className="flex justify-between"><span>SGST</span><span className="font-bold">₹{data.summary.netLiability?.sgst?.toLocaleString() || 0}</span></div>
											<div className="flex justify-between"><span>IGST</span><span className="font-bold">₹{data.summary.netLiability?.igst?.toLocaleString() || 0}</span></div>
											<div className="flex justify-between border-t pt-2 text-lg"><span>Total</span><span className="font-bold text-amber-600">₹{data.summary.netLiability?.total?.toLocaleString() || 0}</span></div>
										</div>
									</CardContent>
								</Card>
							</div>
						</div>
					) : (
						<DataTable
							data={data}
							columns={columns}
							loading={loading}
							pagination={{ page: 1, totalPages: 1, total: data.length }}
							searchPlaceholder={`Search ${REPORT_TYPES.find(r => r.value === reportType)?.label.toLowerCase() || 'results'}...`}
							emptyMessage={`No ${REPORT_TYPES.find(r => r.value === reportType)?.label.toLowerCase() || 'results'} found.`}
						/>
					)}

					{data.length > 0 && (
						<div className="mt-4 p-4 bg-muted/30 rounded-lg">
							<h4 className="font-semibold mb-2">Summary</h4>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								{reportType === 'party-ledger' && summary && (
									<>
										<div>
											<p className="text-sm text-muted-foreground">Total Debit</p>
											<p className="text-xl font-bold text-red-600">
												₹{summary.totalDebit?.toLocaleString() || 0}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Total Credit</p>
											<p className="text-xl font-bold text-green-600">
												₹{summary.totalCredit?.toLocaleString() || 0}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Not Sufficient</p>
											<p className="text-xl font-bold text-orange-600">
												{summary.notSufficientCount || 0}
											</p>
										</div>
									</>
								)}

								{reportType === 'project-cost' && (
									<>
										<div>
											<p className="text-sm text-muted-foreground">Total Debit</p>
											<p className="text-xl font-bold text-red-600">
												₹{(totals as any).totalDebit?.toLocaleString() || 0}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Total Credit</p>
											<p className="text-xl font-bold text-green-600">
												₹{(totals as any).totalCredit?.toLocaleString() || 0}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Net Cost</p>
											<p
												className={`text-xl font-bold ${(totals as any).netCost > 0 ? 'text-red-600' : 'text-green-600'
													}`}
											>
												₹{(totals as any).netCost?.toLocaleString() || 0}
											</p>
										</div>
									</>
								)}

								{(reportType === 'payable' || reportType === 'receivable') && (
									<>
										<div>
											<p className="text-sm text-muted-foreground">Total Amount</p>
											<p className="text-xl font-bold">
												₹{(totals as any).totalAmount?.toLocaleString() || 0}
											</p>
										</div>
									</>
								)}

								{reportType === 'gst' && (gstReportType === 'gstr1' || gstReportType === 'gstr2') && gstSummary && (
									<>
										<div>
											<p className="text-sm text-muted-foreground">Total Taxable</p>
											<p className="text-xl font-bold">
												₹{gstSummary.totalTaxable?.toLocaleString() || 0}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Total CGST</p>
											<p className="text-xl font-bold text-blue-600">
												₹{gstSummary.totalCgst?.toLocaleString() || 0}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Total SGST</p>
											<p className="text-xl font-bold text-purple-600">
												₹{gstSummary.totalSgst?.toLocaleString() || 0}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Total IGST</p>
											<p className="text-xl font-bold text-orange-600">
												₹{gstSummary.totalIgst?.toLocaleString() || 0}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Total GST</p>
											<p className="text-xl font-bold text-amber-600">
												₹{gstSummary.totalGst?.toLocaleString() || 0}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Grand Total</p>
											<p className="text-xl font-bold">
												₹{gstSummary.totalGrand?.toLocaleString() || 0}
											</p>
										</div>
									</>
								)}

								<div>
									<p className="text-sm text-muted-foreground">Records</p>
									<p className="text-xl font-bold">{data.length}</p>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Report Preview</DialogTitle>
						<DialogDescription>
							Preview of the selected report entry
						</DialogDescription>
					</DialogHeader>
					{previewEntry && (
						<div className="space-y-4">
							{Object.entries(previewEntry).map(([key, value]) => (
								<div key={key} className="flex justify-between border-b py-2">
									<span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
									<span>{String(value)}</span>
								</div>
							))}
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
