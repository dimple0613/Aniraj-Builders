"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Upload,
  File,
  Image,
  Download,
  FileText,
  CloudUpload,
} from "lucide-react";
import { VardhiFormData } from "@/types/vardhi";
import { useState, useRef, useEffect } from "react";
import axios from "axios";

interface FileUploadRowProps {
  label: string;
  fieldName: string;
  field: string;
  values: VardhiFormData;
  setFieldValue: any;
  accept: string;
  maxSize: string;
  helperText: string;
  vardhiId?: string | null;
  companySlug?: string;
  disabled?: boolean;
  isZoneRole?: boolean;
}

interface VardhiAttachmentFile {
  id?: string;
  file_path: string;
  file_name?: string;
  file_size?: number | null;
  mime_type?: string | null;
  created_at?: string;
  uploading?: boolean;
  progress?: number;
}

interface UploadingFile {
  name: string;
  progress: number;
  uploading: boolean;
  batchIndex: number;
  file: File;
  cancelToken?: { cancel: () => void };
}

function FileUploadRow({
  label,
  fieldName,
  field,
  values,
  setFieldValue,
  accept,
  maxSize,
  helperText,
  vardhiId,
  companySlug,
  disabled = false,
  isZoneRole = false,
}: FileUploadRowProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const existingFileIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentFilesVal = (values[field as keyof VardhiFormData] as VardhiAttachmentFile[] | undefined) || [];
    currentFilesVal.forEach(f => {
      if (f.id) existingFileIdsRef.current.add(f.id);
    });
  }, []);
  const currentFiles =
    (values[field as keyof VardhiFormData] as
      | VardhiAttachmentFile[]
      | undefined) || [];

  const currentVardhiId = vardhiId || "";

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxBytes = parseSize(maxSize);
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxBytes) {
        invalidFiles.push(`${file.name} (too large)`);
        continue;
      }
      if (!validateFileType(file, accept)) {
        invalidFiles.push(`${file.name} (invalid type)`);
        continue;
      }
      validFiles.push(file);
    }

    if (invalidFiles.length > 0) {
      toast.error(`Skipped: ${invalidFiles.join(", ")}`);
    }

    if (validFiles.length === 0) return;

    const startingIndex = uploadingFiles.length;
    const newUploadingFiles = validFiles.map((file, idx) => ({
      name: file.name,
      progress: 0,
      uploading: true,
      batchIndex: startingIndex + idx,
      file: file,
    }));
    setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const batchIndex = startingIndex + i;

      const CancelToken = axios.CancelToken;
      let cancelFn: (() => void) | undefined;

      setUploadingFiles((prev) =>
        prev.map(
          (f): UploadingFile =>
            f.batchIndex === batchIndex
              ? { ...f, cancelToken: { cancel: () => cancelFn?.() } }
              : f,
        ),
      );

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("field", field);
        formData.append("vardhi_id", currentVardhiId);
        if (companySlug) {
          formData.append("company_slug", companySlug);
        }

        const response = await axios.post("/api/upload/vardhi", formData, {
          cancelToken: new CancelToken((c) => {
            cancelFn = c;
          }),
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.batchIndex === batchIndex ? { ...f, progress } : f,
              ),
            );
          },
        });

        if (response.data.success) {
          const newFile: VardhiAttachmentFile = {
            id: response.data.data.attachmentId,
            file_path: response.data.data.url,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            created_at: new Date().toISOString(),
          };
          setFieldValue(field, (prev: VardhiAttachmentFile[]) => [
            ...(prev || []),
            newFile,
          ]);
          setUploadingFiles((prev) =>
            prev.filter((f) => f.batchIndex !== batchIndex),
          );
          toast.success(`${file.name} uploaded successfully`);
        } else {
          setUploadingFiles((prev) =>
            prev.filter((f) => f.batchIndex !== batchIndex),
          );
          toast.error(response.data.message || "Upload failed");
        }
      } catch (error: any) {
        if (axios.isCancel(error)) {
          setUploadingFiles((prev) =>
            prev.filter((f) => f.batchIndex !== batchIndex),
          );
          toast.info(`${file.name} upload cancelled`);
        } else {
          setUploadingFiles((prev) =>
            prev.filter((f) => f.batchIndex !== batchIndex),
          );
          toast.error(
            error.response?.data?.message || `Failed to upload ${file.name}`,
          );
        }
      }
    }

    if (event.target) event.target.value = "";
  };

  const handleCancelUpload = (batchIndex: number) => {
    const fileToCancel = uploadingFiles.find(
      (f) => f.batchIndex === batchIndex,
    );
    if (fileToCancel?.cancelToken) {
      fileToCancel.cancelToken.cancel();
    }
    setUploadingFiles((prev) =>
      prev.filter((f) => f.batchIndex !== batchIndex),
    );
  };

  const handleRemove = async (index: number) => {
    const fileToRemove = currentFiles[index];
    if (!fileToRemove) return;

    try {
      if (currentVardhiId && fileToRemove.id) {
        await axios.delete(
          `/api/vardhi/${currentVardhiId}/attachments?attachmentId=${fileToRemove.id}`,
        );
      }

      const updatedFiles = currentFiles.filter((_, i) => i !== index);
      setFieldValue(field, updatedFiles);
      toast.success(`File removed`);
    } catch (error) {
      const updatedFiles = currentFiles.filter((_, i) => i !== index);
      setFieldValue(field, updatedFiles);
      toast.success(`File removed (local only)`);
    }
  };

  const isImage = (url: string) => {
    const cleanUrl = url.split("?")[0].toLowerCase();
    return (
      cleanUrl.endsWith(".jpg") ||
      cleanUrl.endsWith(".jpeg") ||
      cleanUrl.endsWith(".png")
    );
  };

  const getFileName = (url: string) => {
    if (!url) return "File";
    const parts = url.split("/");
    return parts[parts.length - 1]?.split("?")[0] || "File";
  };

  const isUploading = uploadingFiles.length > 0;
  const allFiles = [
    ...currentFiles,
    ...uploadingFiles.map((f) => ({
      file_path: "",
      file_name: f.name,
      file_size: f.file?.size || 0,
      mime_type: f.file?.type || "",
      uploading: true,
      progress: f.progress,
      batchIndex: f.batchIndex,
    })),
  ];

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileType = (filename: string, mimeType: string) => {
    if (mimeType.includes("pdf") || filename.endsWith(".pdf")) return "PDF";
    if (
      mimeType.includes("image") ||
      /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)
    )
      return "Image";
    if (mimeType.includes("zip") || filename.endsWith(".zip")) return "Archive";
    if (
      mimeType.includes("word") ||
      filename.endsWith(".doc") ||
      filename.endsWith(".docx")
    )
      return "Word";
    if (
      mimeType.includes("excel") ||
      filename.endsWith(".xls") ||
      filename.endsWith(".xlsx")
    )
      return "Excel";
    if (mimeType.includes("json") || filename.endsWith(".json")) return "JSON";
    return "File";
  };

  const getFileIcon = (filename: string, mimeType: string) => {
    if (mimeType.includes("pdf") || filename.endsWith(".pdf"))
      return <FileText className="h-4 w-4" />;
    if (
      mimeType.includes("image") ||
      /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)
    )
      return <Image className="h-4 w-4" />;
    if (mimeType.includes("zip") || filename.endsWith(".zip"))
      return <File className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const handleRemoveAll = () => {
    setFieldValue(field, []);
    setUploadingFiles([]);
    toast.success("All files removed");
  };

  const handleRemoveUploading = (batchIndex: number) => {
    const fileToCancel = uploadingFiles.find(
      (f) => f.batchIndex === batchIndex,
    );
    if (fileToCancel?.cancelToken) {
      fileToCancel.cancelToken.cancel();
    }
    setUploadingFiles((prev) =>
      prev.filter((f) => f.batchIndex !== batchIndex),
    );
  };

  return (
    <tr>
      <td className="border-r align-top ">
        <div className="">
          {/* Dropzone */}
          <div className="relative rounded-lg border border-dashed p-6 text-center transition-colors border-muted-foreground/25 hover:border-muted-foreground/50 hidden">
            <input
              type="file"
              accept={accept}
              name={fieldName}
              onChange={handleFileChange}
              multiple
              className="sr-only"
              id={`file-input-${field}`}
              disabled={disabled}
            />
            <label
              htmlFor={`file-input-${field}`}
              className="flex flex-col items-center gap-4 cursor-pointer"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted transition-colors border-muted-foreground/25">
                <CloudUpload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Drop files here or{" "}
                  <span className="text-primary underline-offset-4 hover:underline">
                    browse files
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{helperText}</p>
              </div>
            </label>
          </div>

          {/* File List */}

          <div className="">
            <div className="p-2 bg-slate-100 font-bol flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {label} : Files ({allFiles.length})
              </h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    document.getElementById(`file-input-${field}`)?.click()
                  }
                  disabled={isUploading || disabled}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Add files
                </Button>
                {!isZoneRole && allFiles.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAll}
                    disabled={isUploading || disabled}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove all
                  </Button>
                )}
              </div>
            </div>
            {allFiles.length > 0 && (
              <div className="p-2 ">
                <div className="rounded-lg border overflow-auto max-h-[250px]">
                  <table className="w-full caption-bottom text-sm">
                    <thead className="border-b bg-muted sticky top">
                      <tr className="text-xs text-muted-foreground">
                        <th className="px-4 text-left font-normal h-9">Name</th>
                        <th className="px-4 text-left font-normal h-9">Type</th>
                        <th className="px-4 text-left font-normal h-9">Size</th>
                        <th className="px-4 text-right font-normal h-9 w-[100px]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allFiles.map((file: any, index: number) => {
                        const isUploadingFile = file.uploading;
                        const fileType = getFileType(
                          file.file_name || file.name,
                          file.mime_type || "",
                        );

                        return (
                          <tr
                            key={
                              isUploadingFile
                                ? file.batchIndex
                                : file.id || index
                            }
                            className="border-b transition-colors hover:bg-muted/50"
                          >
                            <td className="p-4 align-middle py-2">
                              <div className="flex items-center gap-2">
                                <div className="size-8 shrink-0 flex items-center justify-center text-muted-foreground/80">
                                  {isUploadingFile ? (
                                    file.file?.type?.startsWith("image/") ? (
                                      <img
                                        src={URL.createObjectURL(file.file)}
                                        alt=""
                                        className="size-8 object-cover rounded"
                                      />
                                    ) : (
                                      <FileText className="h-4 w-4" />
                                    )
                                  ) : (
                                    getFileIcon(
                                      file.file_name || "",
                                      file.mime_type || "",
                                    )
                                  )}
                                </div>
                                <p className="truncate text-sm font-medium w-1/2">
                                  {file.file_name || file.name}
                                </p>
                              </div>
                            </td>
                            <td className="p-4 align-middle py-2">
                              <span className="inline-flex items-center justify-center border bg-secondary text-secondary-foreground rounded-md px-2.5 h-6 text-xs">
                                {fileType}
                              </span>
                            </td>
                            <td className="p-4 align-middle py-2 text-sm text-muted-foreground">
                              {isUploadingFile ? (
                                <div className="flex items-center gap-2">
                                  <span>
                                    {formatFileSize(file.file?.size || 0)}
                                  </span>
                                  <span className="text-xs text-blue-600">
                                    ({file.progress}%)
                                  </span>
                                </div>
                              ) : (
                                formatFileSize(file.file_size || 0)
                              )}
                            </td>
                            <td className="p-4 align-middle py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {!isUploadingFile && (
                                  <a
                                    href={file.file_path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>
                                  </a>
                                )}
                                {(!isZoneRole || isUploadingFile || !file.id || !existingFileIdsRef.current.has(file.id)) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    className="h-8 w-8 p-0"
                                    onClick={() =>
                                      isUploadingFile
                                        ? handleRemoveUploading(file.batchIndex)
                                        : handleRemove(index)
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/(\d+)\s*(MB|KB)?/i);
  if (!match) return 5 * 1024 * 1024;

  const value = parseInt(match[1]);
  const unit = (match[2] || "MB").toUpperCase();

  if (unit === "KB") return value * 1024;
  if (unit === "MB") return value * 1024 * 1024;
  return value;
}

function validateFileType(file: File, accept: string): boolean {
  const allowedTypes = accept.split(",").map((t) => t.trim().toLowerCase());
  const fileType = file.type.toLowerCase();
  const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();

  return allowedTypes.some((type) => {
    if (type.startsWith(".")) {
      return fileExtension === type;
    }
    if (type.includes("/")) {
      const [category, subtype] = type.split("/");
      if (subtype === "*") {
        return fileType.startsWith(category + "/");
      }
      return fileType === type;
    }
    return false;
  });
}

export default function Attachments({
  values,
  setFieldValue,
  vardhi,
  companySlug,
  isZoneRole = false,
}: any) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">
        Attachments
      </h3>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm border-collapse">
            <tbody className="divide-y">
              <FileUploadRow
                label="Site Photography"
                fieldName="site_photography"
                field="site_photography"
                values={values}
                setFieldValue={setFieldValue}
                accept="image/jpeg,image/jpg,image/png"
                maxSize="5MB"
                helperText="Mobile taken JPG/PNG photo"
                vardhiId={vardhi?.id}
                companySlug={companySlug}
                isZoneRole={isZoneRole}
              />
              <FileUploadRow
                label="Site Clear Photo"
                fieldName="site_clear_photo"
                field="site_clear_photo"
                values={values}
                setFieldValue={setFieldValue}
                accept="image/jpeg,image/jpg,image/png"
                maxSize="5MB"
                helperText="Mobile taken JPG/PNG photo"
                vardhiId={vardhi?.id}
                companySlug={companySlug}
                isZoneRole={isZoneRole}
              />
              <FileUploadRow
                label="Store Report"
                fieldName="other_attachment"
                field="other_attachment"
                values={values}
                setFieldValue={setFieldValue}
                accept=".pdf,image/jpeg,image/jpg,image/png"
                maxSize="5MB"
                helperText="PDF or mobile taken JPG/PNG photo"
                vardhiId={vardhi?.id}
                companySlug={companySlug}
                isZoneRole={isZoneRole}
              />
              <FileUploadRow
                label="Other PDF"
                fieldName="report_pdf"
                field="report_pdf"
                values={values}
                setFieldValue={setFieldValue}
                accept=".pdf"
                maxSize="5MB"
                helperText="Upload PDF only"
                vardhiId={vardhi?.id}
                companySlug={companySlug}
                isZoneRole={isZoneRole}
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
