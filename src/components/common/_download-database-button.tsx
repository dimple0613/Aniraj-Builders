"use client"

import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { useState } from "react"

export function DownloadDatabaseButton() {
    const { data: session } = useSession()
    const [isDownloading, setIsDownloading] = useState(false)

    const isSuperAdmin = session?.user?.role === 'SuperAdmin'

    if (!isSuperAdmin) return null

    const handleDownload = async () => {
        setIsDownloading(true)
        try {
            const response = await fetch('/api/admin/backup/download')
            if (!response.ok) {
                const errorData = await response.json().catch(() => null)
                throw new Error(errorData?.message || 'Backup failed')
            }
            const blob = await response.blob()
            const contentDisposition = response.headers.get('Content-Disposition')
            let filename = 'database-backup.sql'
            const match = contentDisposition?.match(/filename="(.+?)"/)
            if (match) filename = match[1]
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            a.remove()
        } catch (err: any) {
            alert(err?.message || 'Failed to download database backup')
        } finally {
            setIsDownloading(false)
        }
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            disabled={isDownloading}
            title={isDownloading ? 'Backing up database...' : 'Download Database'}
        >
            <DownloadIcon className="h-5 w-5" />
        </Button>
    )
}
