"use client"

import { useState, useEffect, useRef } from "react"

import "ckeditor5/ckeditor5.css"
import "ckeditor5/ckeditor5-content.css"
import "ckeditor5/ckeditor5-editor.css"

const editorStyles = `
  .ck-content iframe {
    width: 100% !important;
    border: none;
    display: block;
    min-height: 500px;
  }
  .ck-content .ck-widget iframe {
    width: 100% !important;
  }
  .ck-content p:has(iframe) {
    width: 100%;
  }
  .ck-content img {
    max-width: 100%;
    height: auto;
  }
  .ck-content .image {
    width: 100%;
  }
  .ck-content .image img {
    max-width: 100%;
    width: 100%;
    height: auto;
  }
  .ck-content h1 {
    font-size: 2em !important;
    font-weight: bold !important;
    margin: 0.67em 0 !important;
  }
  .ck-content h2 {
    font-size: 1.5em !important;
    font-weight: bold !important;
    margin: 0.75em 0 !important;
  }
  .ck-content h3 {
    font-size: 1.17em !important;
    font-weight: bold !important;
    margin: 0.83em 0 !important;
  }
`

interface CKEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  uploadUrl?: string
}

export function CKEditor({ value, onChange, placeholder, uploadUrl }: CKEditorProps) {
  const [CKEditorInstance, setCKEditorInstance] = useState<any>(null)
  const [CKEditorComponent, setCKEditorComponent] = useState<any>(null)
  const editorRef = useRef<any>(null)

  useEffect(() => {
    const styleId = "cke-correspondence-styles"
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style")
      style.id = styleId
      style.textContent = editorStyles
      document.head.appendChild(style)
    }
  }, [])

  useEffect(() => {
    Promise.all([
      import("ckeditor5"),
      import("@ckeditor/ckeditor5-react"),
    ]).then(([ckeditor, reactModule]) => {
      const {
        ClassicEditor, Plugin, ButtonView, Essentials, Paragraph,
        Bold, Italic, Underline, Strikethrough, Alignment, List, Indent,
        BlockQuote, Heading, Link, LinkImage, Image, ImageToolbar,
        ImageUpload, ImageCaption, ImageStyle, ImageResize, ImageInsert,
        Table, TableToolbar, SourceEditing, Fullscreen, Undo,
        GeneralHtmlSupport, IframeElementSupport,
      } = ckeditor as any

      class CorrespondenceUploadAdapter {
        loader: any
        uploadUrl: string

        constructor(loader: any, url: string) {
          this.loader = loader
          this.uploadUrl = url
        }

        upload() {
          return this.loader.file.then((file: File) => {
            const formData = new FormData()
            formData.append("file", file)

            return fetch(this.uploadUrl, { method: "POST", body: formData })
              .then(res => res.json())
              .then(data => ({ default: data.url }))
          })
        }

        abort() {}
      }

      class CorrespondenceFileHandler extends Plugin {
        static get pluginName() { return "CorrespondenceFileHandler" }
        static get requires() { return ["FileRepository"] }

        init() {
          const editor = this.editor as any
          const url = editor.config.get("correspondenceUploadUrl") as string
          if (!url) return

          editor.plugins.get("FileRepository").createUploadAdapter = (loader: any) => {
            return new CorrespondenceUploadAdapter(loader, url)
          }

          this._handlePdfInput(editor, url)
          this._registerPdfButton(editor, url)
        }

        _handlePdfInput(editor: any, uploadUrl: string) {
          const viewDocument = editor.editing.view.document

          this.listenTo(viewDocument, "clipboardInput", (event: any, data: any) => {
            const dt = data.dataTransfer
            if (!dt || !dt.files || dt.files.length === 0) return

            const files = Array.from(dt.files) as File[]
            const pdfFiles = files.filter(f => f.type === "application/pdf")
            if (pdfFiles.length === 0) return

            event.stop()

            for (const file of pdfFiles) {
              this._uploadAndInsertPdf(editor, file, uploadUrl)
            }
          })
        }

        _registerPdfButton(editor: any, uploadUrl: string) {
          editor.ui.componentFactory.add("uploadPdf", (locale: any) => {
            const button = new ButtonView(locale)
            button.set({
              label: "PDF",
              tooltip: true,
              withText: true,
            })
            button.on("execute", () => {
              const input = document.createElement("input")
              input.type = "file"
              input.accept = "application/pdf"
              input.onchange = async () => {
                const file = input.files?.[0]
                if (file) {
                  await this._uploadAndInsertPdf(editor, file, uploadUrl)
                }
              }
              input.click()
            })
            return button
          })
        }

        async _uploadAndInsertPdf(editor: any, file: File, uploadUrl: string) {
          try {
            const pdfjsLib = await import("pdfjs-dist")
            const version = (pdfjsLib as any).version
            ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
              `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`

            const arrayBuffer = await file.arrayBuffer()
            const pdfDoc = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise

            const uploadPage = async (pageNum: number): Promise<string | null> => {
              try {
                const page = await pdfDoc.getPage(pageNum)
                const scale = 1.5
                const viewport = page.getViewport({ scale })

                const canvas = document.createElement("canvas")
                canvas.width = viewport.width
                canvas.height = viewport.height
                const ctx = canvas.getContext("2d")!
                await page.render({ canvasContext: ctx, viewport }).promise

                const blob = await new Promise<Blob | null>((resolve) => {
                  canvas.toBlob((b) => resolve(b), "image/png")
                })
                if (!blob) return null

                const imageFile = new File([blob], `page_${pageNum}.png`, { type: "image/png" })
                const formData = new FormData()
                formData.append("file", imageFile)

                const res = await fetch(uploadUrl, { method: "POST", body: formData })
                const data = await res.json()
                return data.url || null
              } catch {
                return null
              }
            }

            const uploadTasks: Promise<string | null>[] = []
            for (let i = 1; i <= pdfDoc.numPages; i++) {
              uploadTasks.push(uploadPage(i))
            }

            const results = await Promise.all(uploadTasks)
            const pageUrls = results.filter((u): u is string => u !== null)

            if (pageUrls.length > 0) {
              const pageHtml = pageUrls
                .map((pageUrl: string) =>
                  `<img src="${pageUrl}" alt="PDF Page" style="width:100%;display:block;">`
                )
                .join("")

              editor.model.change(() => {
                const viewFragment = editor.data.processor.toView(pageHtml)
                const modelFragment = editor.data.toModel(viewFragment)
                editor.model.insertContent(modelFragment)
              })
            }
          } catch (err) {
            console.error("PDF render failed, falling back to iframe", err)

            try {
              const formData = new FormData()
              formData.append("file", file)
              const res = await fetch(uploadUrl, { method: "POST", body: formData })
              const data = await res.json()
              if (data.url) {
                const html = `<div style="width:100%;"><iframe src="${data.url}" width="100%" height="600px" style="width:100%;border:none;display:block;"></iframe></div>`

                editor.model.change(() => {
                  const viewFragment = editor.data.processor.toView(html)
                  const modelFragment = editor.data.toModel(viewFragment)
                  editor.model.insertContent(modelFragment)
                })
              }
            } catch (fallbackErr) {
              console.error("PDF upload fallback also failed", fallbackErr)
            }
          }
        }
      }

      setCKEditorComponent(() => reactModule.CKEditor)

      setCKEditorInstance(() => {
        return class CustomEditor extends ClassicEditor {
          static builtinPlugins = [
            Essentials,
            Paragraph,
            Bold,
            Italic,
            Underline,
            Strikethrough,
            Alignment,
            List,
            Indent,
            BlockQuote,
            Heading,
            Link,
            LinkImage,
            Image,
            ImageToolbar,
            ImageUpload,
            ImageCaption,
            ImageStyle,
            ImageResize,
            ImageInsert,
            Table,
            TableToolbar,
            SourceEditing,
            Fullscreen,
            Undo,
            GeneralHtmlSupport,
            IframeElementSupport,
            CorrespondenceFileHandler,
          ]

          static defaultConfig = {
            toolbar: {
              items: [
                "undo", "redo", "|",
                "heading", "|",
                "bold", "italic", "underline", "strikethrough", "|",
                "alignment", "|",
                "bulletedList", "numberedList", "|",
                "outdent", "indent", "|",
                "blockQuote", "link", "|",
                "insertImage", "uploadPdf", "insertTable", "|",
                "sourceEditing", "fullscreen",
              ],
            },
            heading: {
              options: [
                { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
                { model: "heading1", view: "h1", title: "Heading 1", class: "ck-heading_heading1" },
                { model: "heading2", view: "h2", title: "Heading 2", class: "ck-heading_heading2" },
                { model: "heading3", view: "h3", title: "Heading 3", class: "ck-heading_heading3" },
              ],
            },
            placeholder: placeholder || "Enter document content...",
            licenseKey: "GPL",
            correspondenceUploadUrl: uploadUrl || "",
            htmlSupport: {
              allow: [
                {
                  name: "iframe",
                  attributes: true,
                  styles: true,
                },
                {
                  name: "div",
                  attributes: true,
                  styles: true,
                },
              ],
              htmlIframeSandbox: false,
            },
            image: {
              toolbar: [
                "imageStyle:alignLeft",
                "imageStyle:alignCenter",
                "imageStyle:alignRight",
                "|",
                "imageTextAlternative",
                "linkImage",
              ],
              insert: {
                integrations: ["url", "upload"],
              },
              resizeOptions: [
                { name: "resizeImage:original", label: "Original", value: null },
                { name: "resizeImage:50", label: "50%", value: "50" },
                { name: "resizeImage:75", label: "75%", value: "75" },
              ],
            },
            table: {
              contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
            },
          }
        }
      })
    })
  }, [placeholder, uploadUrl])

  if (!CKEditorInstance || !CKEditorComponent) {
    return (
      <div className="border rounded-md p-4 text-sm text-muted-foreground bg-muted/20">
        Loading editor...
      </div>
    )
  }

  return (
    <CKEditorComponent
      editor={CKEditorInstance}
      data={value}
      onChange={(_event: any, editor: any) => {
        const data = editor.getData()
        onChange(data)
      }}
    />
  )
}
