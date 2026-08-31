"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Plus, Save, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CKEditor } from "@/components/ui/ckeditor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Labels } from "../ui/labels"

interface CorrespondenceProps {
  project: {
    id: string
    name: string
    project_no?: string | null
    loa_approved_no?: string | null
  }
}

interface SectionData {
  id: string
  dbId?: string
  srNo: number
  date: string
  type: string
  docketNo: string
  subject: string
  documentContent: string
  documents: File[]
  saved: boolean
  saving: boolean
}

function formatToday(): string {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export function Correspondence({ project }: CorrespondenceProps) {
  const [sections, setSections] = useState<SectionData[]>([])
  const [accordionKey, setAccordionKey] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await axios.get(`/api/projects/${project.id}/correspondence`)
        if (res.data.success && res.data.data) {
          const mapped: SectionData[] = res.data.data.map((r: any) => ({
            id: `db-${r.id}`,
            dbId: r.id,
            srNo: r.sr_no,
            date: formatToday(),
            type: r.type || "",
            docketNo: r.docket_no || "",
            subject: r.subject || "",
            documentContent: r.document_content || "",
            documents: [],
            saved: true,
            saving: false,
          }))
          setSections(mapped)
          setAccordionKey((k) => k + 1)
        }
      } catch (err) {
        console.error("Failed to load correspondence", err)
      } finally {
        setLoading(false)
      }
    }
    fetchRecords()
  }, [project.id])

  const addSection = () => {
    const srNo = sections.length + 1
    const newSection: SectionData = {
      id: `section-${Date.now()}`,
      srNo,
      date: formatToday(),
      type: "",
      docketNo: "",
      subject: "",
      documentContent: "",
      documents: [],
      saved: false,
      saving: false,
    }
    setSections((prev) => [newSection, ...prev])
    setAccordionKey((k) => k + 1)
  }

  const updateSection = (id: string, updates: Partial<SectionData>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }

  const handleSave = async (section: SectionData) => {
    updateSection(section.id, { saving: true })

    try {
      const payload = {
        sr_no: section.srNo,
        type: section.type,
        docket_no: section.docketNo,
        subject: section.subject,
        document_content: section.documentContent,
      }

      if (section.dbId) {
        await axios.put(`/api/projects/${project.id}/correspondence`, {
          id: section.dbId,
          ...payload,
        })
      } else {
        const res = await axios.post(`/api/projects/${project.id}/correspondence`, payload)
        updateSection(section.id, { dbId: res.data.data.id, saved: true, saving: false })
        return
      }

      updateSection(section.id, { saved: true, saving: false })
    } catch (err) {
      console.error("Failed to save correspondence", err)
      updateSection(section.id, { saving: false })
    }
  }

  const headerLabel = (s: SectionData): string => {
    if (s.saved && s.subject) {
      const docNo = s.type === "As Submitted" && s.docketNo ? s.docketNo : `DOC-${String(s.srNo).padStart(3, "0")}`
      return `${s.srNo}//${s.date}//${docNo}//${s.subject}`
    }
    return `${s.srNo}//${s.date}//---//---`
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Correspondence</h1>
          <p className="text-muted-foreground mt-1">AB-OW/{project.loa_approved_no || '---'}</p>
        </div>
        <Button onClick={addSection} className="gap-2">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <Accordion key={accordionKey} type="multiple" className="w-full space-y-3" defaultValue={sections.length > 0 ? [sections[0].id] : []}>
        {sections.map((section) => (
          <AccordionItem key={section.id} value={section.id} className="border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-semibold font-mono text-left hover:no-underline">
              {headerLabel(section)}
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 relative">
                    <Label htmlFor={`type-${section.id}`}>Type</Label>
                    <Select
                      value={section.type}
                      onValueChange={(val) => updateSection(section.id, { type: val })}
                    >
                      <SelectTrigger id={`type-${section.id}`}>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Grievances">Grievances</SelectItem>
                        <SelectItem value="As Submitted">As Submitted</SelectItem>
                        <SelectItem value="Reply">Reply</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {section.type === "As Submitted" && (
                    <div className="space-y-2 relative">
                      <Label htmlFor={`docket-${section.id}`}>Docket No.</Label>
                      <Input
                        id={`docket-${section.id}`}
                        value={section.docketNo}
                        onChange={(e) => updateSection(section.id, { docketNo: e.target.value })}
                        placeholder="Enter docket number"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor={`subject-${section.id}`}>Subject</Label>
                  <Input
                    id={`subject-${section.id}`}
                    value={section.subject}
                    onChange={(e) => updateSection(section.id, { subject: e.target.value })}
                    placeholder="Enter subject"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <div className="space-y-2 relative">
                  <Label htmlFor={`content-${section.id}`}>Document Content</Label>
                  <CKEditor
                    value={section.documentContent}
                    onChange={(val) => updateSection(section.id, { documentContent: val })}
                    placeholder="Enter document content..."
                    uploadUrl={`/api/projects/${project.id}/correspondence/upload`}
                  />
                </div>
                

                  </div>
                <div className="pt-2">
                  <Button
                    onClick={() => handleSave(section)}
                    disabled={section.saving}
                    className="gap-2"
                    size="sm"
                  >
                    {section.saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {section.saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
