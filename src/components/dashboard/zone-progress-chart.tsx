"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	ChartLegend,
	ChartLegendContent,
} from "@/components/ui/chart"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import axios from "axios"
import { Loader2 } from "lucide-react"

interface ZoneData {
	zoneId: string
	zoneName: string
	fileNo: number
	vardhiCount: number
	vardhiAmount: any
	estimationAmount: any
	estimationCount: number
	progress: number
}

interface ChartDataItem {
	zone: string
	vardhi: number
	estimation: number
	estimationAmount: number
	vardhiAmount: number
	progress: number
}

interface SummaryData {
	totalVardhi: number
	totalEstimation: number
	overallProgress: number
}

interface Zone {
	id: string
	name: string
	file_no: number
}

const months = [
	{ value: "January", label: "January" },
	{ value: "February", label: "February" },
	{ value: "March", label: "March" },
	{ value: "April", label: "April" },
	{ value: "May", label: "May" },
	{ value: "June", label: "June" },
	{ value: "July", label: "July" },
	{ value: "August", label: "August" },
	{ value: "September", label: "September" },
	{ value: "October", label: "October" },
	{ value: "November", label: "November" },
	{ value: "December", label: "December" },
]

const chartConfig = {
	vardhi: {
		label: "Vardhi",
		color: "hsl(210 100% 50%)",
	},
} satisfies ChartConfig

export function ZoneProgressChart() {
	const isMobile = useIsMobile()
	const currentMonthIndex = new Date().getMonth()
	const currentMonth = months[currentMonthIndex].value

	const [selectedMonth, setSelectedMonth] = React.useState(currentMonth)
	const [selectedZone, setSelectedZone] = React.useState<string>("all")
	const [chartData, setChartData] = React.useState<ChartDataItem[]>([])
	const [zones, setZones] = React.useState<Zone[]>([])
	const [summary, setSummary] = React.useState<SummaryData>({
		totalVardhi: 0,
		totalEstimation: 0,
		overallProgress: 0,
	})
	const [loading, setLoading] = React.useState(true)

	const fetchZones = async () => {
		try {
			const response = await axios.get('/api/zone-masters/list')
			setZones(response.data.data || [])
		} catch (error) {
			console.error('Failed to fetch zones:', error)
		}
	}

	const fetchChartData = async (month: string, zoneId: string) => {
		try {
			setLoading(true)
			const params = new URLSearchParams()
			params.set('month', month)
			if (zoneId && zoneId !== 'all') {
				params.set('zone_id', zoneId)
			}

			const response = await axios.get(`/api/billing/zone-progress?${params.toString()}`)

			const data = response.data.data || [];

			const chartDataFormatted = data.map((item: ZoneData) => ({
				zone: item.zoneName,
				vardhi: item.vardhiCount,
				vardhiAmount: item.vardhiAmount,
				estimation: item.estimationCount,
				estimationAmount: item.estimationAmount,
				progress: item.progress,
			}))

			setChartData(chartDataFormatted)
			setSummary(response.data.summary || {
				totalVardhi: 0,
				totalEstimation: 0,
				overallProgress: 0,
			})
		} catch (error) {
			console.error('Failed to fetch zone progress data:', error)
			setChartData([])
			setSummary({ totalVardhi: 0, totalEstimation: 0, overallProgress: 0 })
		} finally {
			setLoading(false)
		}
	}

	React.useEffect(() => {
		fetchZones()
	}, [])

	React.useEffect(() => {
		fetchChartData(selectedMonth, selectedZone)
	}, [selectedMonth, selectedZone])

	const handleMonthChange = (value: string) => {
		setSelectedMonth(value)
	}

	const handleZoneChange = (value: string) => {
		setSelectedZone(value)
	}

	return (
		<>
			<Card className="pt-0">
				<CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
					<div className="grid flex-1 gap-1">
						<CardTitle>Vardhi Progress</CardTitle>
						<CardDescription>
							Vardhi counts by zone for the selected month
						</CardDescription>
					</div>
					<Select value={selectedMonth} onValueChange={handleMonthChange}>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Select month" />
						</SelectTrigger>

						<SelectContent>
							{months.map((month) => (
								<SelectItem key={month.value} value={month.value}>
									{month.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardHeader>
				<CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
					{loading ? (
						<div className="flex items-center justify-center h-[300px]">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : chartData.length === 0 ? (
						<div className="flex items-center justify-center h-[300px] text-muted-foreground">
							No data available for the selected filters
						</div>
					) : (
						<div className="space-y-4">
							<ChartContainer
								config={chartConfig}
								className="aspect-auto h-[300px] w-full"
							>
								<BarChart data={chartData} accessibilityLayer>
									<CartesianGrid vertical={false} strokeDasharray="3 3" />
									<XAxis
										dataKey="zone"
										tickLine={false}
										axisLine={false}
										tickMargin={8}
										minTickGap={32}
										angle={isMobile ? -45 : 0}
										textAnchor={isMobile ? "end" : "middle"}
										interval={0}
									/>
									<ChartTooltip
										cursor={false}
										content={
											<ChartTooltipContent
												labelFormatter={(label) => label}
												indicator="dot"
											/>
										}
									/>
									<Bar
										dataKey="vardhi"
										fill="var(--color-vardhi)"
										radius={[4, 4, 0, 0]}
										maxBarSize={60}
									/>
									{/* <Bar
									dataKey="estimation"
									fill="var(--color-estimation)"
									radius={[4, 4, 0, 0]}
									maxBarSize={60}
								/> */}
									<ChartLegend
										content={<ChartLegendContent />}
										verticalAlign="top"
										wrapperStyle={{ paddingBottom: '16px' }}
									/>
								</BarChart>
							</ChartContainer>
						</div>
					)}
				</CardContent>
			</Card>
		</>
	)
}