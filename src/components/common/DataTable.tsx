'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  ChevronsLeft,
  ChevronDown,
  ChevronsRight,
} from 'lucide-react'

/* ---------------- Types ---------------- */

export interface Column<T = any> {
  header: string
  accessorKey?: keyof T | string
  cell?: (item: T) => React.ReactNode
  sortable?: boolean
  hidden?: boolean
  width?: string | number
  minWidth?: string | number
  maxWidth?: string | number
  cellClassName?: string
}

export interface DataTablePagination {
  page: number
  totalPages: number
  total?: number
  limit?: number
}

export interface DataTableProps<T = any> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean

  // CRUD actions
  onAdd?: () => void
  onEdit?: (item: T) => void
  onEditCondition?: (item: T) => boolean
  onDelete?: (item: T) => void
  onView?: (item: T) => void

  // UI customization
  title?: string
  searchPlaceholder?: string
  addLabel?: string
  emptyMessage?: string
  className?: string

  // Pagination
  pagination?: DataTablePagination
  onPageChange?: (page: number) => void
  onLimitChange?: (limit: number) => void

  // Show add button only on last page
  showAddOnlyOnLastPage?: boolean

  // Disable add button
  addDisabled?: boolean

  // Sorting and filtering
  onSearch?: (value: string) => void
  onSortChange?: (field: string, order: 'asc' | 'desc') => void
  filters?: React.ReactNode
  enableColumnResizing?: boolean
  enableColumnVisibility?: boolean

  // Selection
  selectable?: boolean
  onSelect?: (items: T[]) => void
  selectedItems?: T[]

  // Row styling
  getRowClassName?: (item: T) => string

  // Extra actions in actions dropdown
  extraActions?: (item: T) => { label: string; icon: React.ReactNode; onClick: () => void; className?: string }[]
}

export interface DataTableRef<T = any> {
  refresh: () => void
  getSelectedItems: () => T[]
  clearSelection: () => void
  exportData: (format?: 'csv' | 'excel') => void
}

/* ---------------- Component ---------------- */

export function DataTable<T extends { id: string } = { id: string }>({
  data,
  columns,
  loading = false,
  title,
  onAdd,
  onEdit,
  onDelete,
  onView,
  onEditCondition,
  searchPlaceholder = 'Search...',
  addLabel = 'Add',
  emptyMessage = 'No results found.',
  pagination,
  onPageChange,
  onLimitChange,
  onSearch,
  onSortChange,
  filters,
  enableColumnVisibility = true,
  selectable = false,
  onSelect,
  selectedItems = [],
  showAddOnlyOnLastPage = false,
  addDisabled = false,
  getRowClassName,
  extraActions,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(new Set())

  const [visibleColumns, setVisibleColumns] = useState(
    columns.map((c) => ({ ...c, hidden: c.hidden ?? false }))
  )

  useEffect(() => {
    setVisibleColumns(columns.map((c) => ({ ...c, hidden: c.hidden ?? false })))
  }, [columns])

  useEffect(() => {
    if (selectable && selectedItems) {
      setLocalSelectedIds(new Set(selectedItems.map(item => item.id)))
    }
  }, [selectedItems])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(data.map(item => item.id))
      setLocalSelectedIds(allIds)
      onSelect?.(data)
    } else {
      setLocalSelectedIds(new Set())
      onSelect?.([])
    }
  }

  const handleSelectRow = (item: T, checked: boolean) => {
    const newSelected = new Set(localSelectedIds)
    if (checked) {
      newSelected.add(item.id)
    } else {
      newSelected.delete(item.id)
    }
    setLocalSelectedIds(newSelected)
    const selectedItems = data.filter(i => newSelected.has(i.id))
    onSelect?.(selectedItems)
  }

  /* ---------------- Sorting ---------------- */

  const handleSort = (key?: string, sortable?: boolean) => {
    if (!sortable || !key) return

    const newOrder =
      sortKey === key && sortDir === 'asc' ? 'desc' : 'asc'

    setSortKey(key)
    setSortDir(newOrder)

    onSortChange?.(key, newOrder)
  }

  /* ---------------- Render ---------------- */

  return (
    <div className="flex flex-col gap-4 w-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full justify-between  w-full">
          {/* Title */}
          {title && <h2 className="text-lg font-semibold shrink-0">{title}</h2>}
          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-[150px] lg:w-[250px] order-[1]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                onSearch?.(e.target.value)
              }}
              className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input min-w-0 rounded-md border bg-transparent px-3 py-1  shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-8 w-[150px] lg:w-[250px] pl-10 w-full"
            />
          </div>
          <div className="flex items-center gap-2 order-[2] sm:w-auto sm:order-[4] sm:ml-auto">
            {onAdd && (!showAddOnlyOnLastPage || (pagination && pagination.page === pagination.totalPages)) && (
              <Button onClick={onAdd} size="sm" disabled={addDisabled} className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{addLabel}</span>
                {/* <span className="sm:hidden">+</span> */}
              </Button>
            )}
          </div>
          {filters} {/* ✅ custom filters render here */}
        </div>


      </div>

      {/* Table Container */}
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 bg-background z-10 [&_tr]:border-b">
            <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
              {selectable && (
                <TableHead className="text-foreground h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] w-[40px]">
                  <Checkbox
                    checked={data.length > 0 && localSelectedIds.size === data.length}
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
                    className="[&_svg]:h-3.5 [&_svg]:w-3.5"
                  />
                </TableHead>
              )}
              {visibleColumns
                .filter((c) => !c.hidden)
                .map((col, idx) => (
                  <TableHead
                    key={idx}
                    onClick={() =>
                      handleSort(
                        col.accessorKey as string,
                        col.sortable
                      )
                    }
                    className={`${col.accessorKey == "actions" ? "text-foreground h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right" : "text-foreground h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]"}
                     ${col.sortable ? 'cursor-pointer select-none' : ''}
                    `}
                  >
                    {
                      col.accessorKey == "actions" ? col.header :
                        <div className="flex items-center gap-1">
                          {col.header}
                          {col.sortable && (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </div>
                    }
                  </TableHead>
                ))}

              {(onEdit || onDelete || onView) && (
                <TableHead className="text-foreground h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody className='[&_tr:last-child]:border-0'>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors" key={idx}>
                  {visibleColumns
                    .filter((c) => !c.hidden)
                    .map((_, i) => (
                      <TableCell key={i} className='p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]'>
                        <Skeleton className="h-4 w-full max-w-[150px]" />
                      </TableCell>
                    ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                <TableCell
                  colSpan={
                    visibleColumns.filter((c) => !c.hidden).length +
                    (selectable ? 1 : 0) +
                    ((onEdit || onDelete || onView) ? 1 : 0)
                  }
                  className="p-4 md:p-8 align-middle text-center [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow 
                  className={`hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors ${getRowClassName ? getRowClassName(item) : ''}`} 
                  key={item.id}
                >
                  {selectable && (
                    <TableCell className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
                      <Checkbox
                        checked={localSelectedIds.has(item.id)}
                        onCheckedChange={(checked) => handleSelectRow(item, checked === true)}
                        className="[&_svg]:h-3.5 [&_svg]:w-3.5"
                      />
                    </TableCell>
                  )}
                  {visibleColumns
                    .filter((c) => !c.hidden)
                    .map((col, idx) => (
                      <TableCell className={`${col.accessorKey == "actions" ? "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right" : `p-2 align-middle ${col.cellClassName || 'whitespace-nowrap'} [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]`}`} key={idx}>
                        <span className="block">
                          {col.cell
                            ? col.cell(item)
                            : col.accessorKey
                              ? String(
                                (item as any)[col.accessorKey]
                              )
                              : null}
                        </span>
                      </TableCell>
                    ))}

                  {(onEdit || onDelete || onView) && (
                    <TableCell className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onView && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className='h-8 w-8' onClick={() => onView(item)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Project Details</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className='h-8 w-8'>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onEdit && (!onEditCondition || onEditCondition(item)) && (
                            <DropdownMenuItem
                              onClick={() => onEdit(item)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}

                          {extraActions && extraActions(item).map((action, i) => (
                            <DropdownMenuItem key={i} onClick={action.onClick} className={action.className}>
                              {action.icon}
                              {action.label}
                            </DropdownMenuItem>
                          ))}

                          {(onEdit || onDelete) && <DropdownMenuSeparator />}

                          {onDelete && (
                            <DropdownMenuItem
                              onClick={() => onDelete(item)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      {pagination && (
        <div className="flex items-center justify-between px-2">
          <div className="text-muted-foreground flex-1 text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </div>

          <div className="flex items-center space-x-6 lg:space-x-8">
            {/* Rows per page */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">
                Rows per page
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 h-8 w-[70px]"
                  >
                    <span>{rowsPerPage}</span>
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {[5, 10, 20, 30, 50].map((size) => (
                    <DropdownMenuItem
                      key={size}
                      onClick={() => {
                        setRowsPerPage(size)
                        onLimitChange?.(size)
                      }}
                    >
                      {size}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Pagination Buttons */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                className="items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 hidden size-8 lg:flex"
                onClick={() => onPageChange?.(1)}
                disabled={pagination.page === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-8"
                onClick={() =>
                  onPageChange?.(pagination.page - 1)
                }
                disabled={pagination.page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  onPageChange?.(pagination.page + 1)
                }
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-8"
                disabled={
                  pagination.page === pagination.totalPages
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 hidden size-8 lg:flex"
                onClick={() =>
                  onPageChange?.(pagination.totalPages)
                }
                disabled={
                  pagination.page === pagination.totalPages
                }
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
