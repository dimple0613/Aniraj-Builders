"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { Textarea } from "../ui/textarea";
import { useCompanyContext } from "@/lib/company-context";

const SIDEBAR_MODULES = [
  {
    section: "Home",
    items: ["Dashboard", "Taskboard"],
  },
  {
    section: "Maintenance",
    items: ["Maintenance SOR", "Vardhi Master", "Vardhi Summary", "Bill Tracking", "Zone", "Work Type", "Employee"],
  },
  {
    section: "Capital",
    items: ["Item Master", "Projects", "Parties", "Bank Book", "Cash Book", "Purchase Entries", "Attendance", "Subcontractor", "Documents"],
  },
  {
    section: "HRMS",
    items: ["Employees", "Leave", "Salary Components", "Employee Salaries", "Financial Years", "Payroll Runs", "Payslips", "Reimbursement Requests"],
  },
  {
    section: "Admin",
    items: ["User Management", "Account Management", "Company Management"],
  },
  {
    section: "Reports",
    items: ["Party Ledger", "Project Cost", "Payable", "Receivable", "GST Report", "Sales Report"],
  },
];

interface ApprovedByRangeFormData {
  name: string;
  amount_from: string;
  amount_to: string;
  field_name: string;
}

interface CompanyFormData {
  company_name: string;
  slug: string;
  plan: string;
  status: string;
  logo: string;
  address: string;
  gstin_uin: string;
  state_name: string;
  state_code: string;
  contact: string;
  hsn_sac: string;
  bill_to: string;
  buyer_name: string;
  buyer_address: string;
  buyer_gstin_uin: string;
  buyer_state_name: string;
  buyer_state_code: string;
  cgst_rate: string;
  sgst_rate: string;
  income_tax_rate: string;
  labour_cess_rate: string;
  cgst_tds_rate: string;
  sgst_tds_rate: string;
  additional_deposit: string;
  bank_name: string;
  branch_name: string;
  ifsc_code: string;
  account_holder_name: string;
  swift_code: string;
  account_no: string;
  module_access: string[];
  approved_by_ranges: ApprovedByRangeFormData[];
}

const initialFormData: CompanyFormData = {
  company_name: "",
  slug: "",
  plan: "BASIC",
  status: "ACTIVE",
  logo: "",
  address: "",
  gstin_uin: "",
  state_name: "",
  state_code: "",
  contact: "",
  hsn_sac: "",
  bill_to: "",
  buyer_name: "",
  buyer_address: "",
  buyer_gstin_uin: "",
  buyer_state_name: "",
  buyer_state_code: "",
  cgst_rate: "",
  sgst_rate: "",
  income_tax_rate: "",
  labour_cess_rate: "",
  cgst_tds_rate: "",
  sgst_tds_rate: "",
  additional_deposit: "",
  bank_name: "",
  branch_name: "",
  ifsc_code: "",
  account_holder_name: "",
  swift_code: "",
  account_no: "",
  module_access: SIDEBAR_MODULES.flatMap((g) => g.items),
  approved_by_ranges: [],
};

function validateGSTIN(value: string): boolean {
  if (!value) return true;
  const gstinRegex =
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[A-Z0-9]{1}$/;
  return gstinRegex.test(value);
}

function validateIFSC(value: string): boolean {
  if (!value) return true;
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(value);
}

interface CompanyFormProps {
  mode: "add" | "edit";
  onSuccess?: () => void;
}

const validationSchema = Yup.object({
  company_name: Yup.string()
    .required("Company name is required")
    .min(2, "Company name must be at least 2 characters"),
  slug: Yup.string()
    .required("Slug is required")
    .matches(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),
  contact: Yup.string(),
  gstin_uin: Yup.string()
    .matches(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[A-Z0-9]{1}$/,
      "Invalid GSTIN format",
    )
    .optional(),
  state_name: Yup.string(),
  state_code: Yup.string(),
  hsn_sac: Yup.string(),
  status: Yup.string(),
  plan: Yup.string(),
  address: Yup.string(),
  bill_to: Yup.string(),
  buyer_name: Yup.string(),
  buyer_address: Yup.string(),
  buyer_gstin_uin: Yup.string()
    .matches(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[A-Z0-9]{1}$/,
      "Invalid GSTIN format",
    )
    .optional(),
  buyer_state_name: Yup.string(),
  buyer_state_code: Yup.string(),
  cgst_rate: Yup.number().min(0).max(100).optional(),
  sgst_rate: Yup.number().min(0).max(100).optional(),
  income_tax_rate: Yup.number().min(0).max(100).optional(),
  labour_cess_rate: Yup.number().min(0).max(100).optional(),
  cgst_tds_rate: Yup.number().min(0).max(100).optional(),
  sgst_tds_rate: Yup.number().min(0).max(100).optional(),
  additional_deposit: Yup.number().min(0).max(100).optional(),
  bank_name: Yup.string(),
  branch_name: Yup.string(),
  ifsc_code: Yup.string()
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format")
    .optional(),
  account_holder_name: Yup.string(),
  swift_code: Yup.string(),
  account_no: Yup.string(),
});

export function CompanyForm({ mode, onSuccess }: CompanyFormProps) {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const userCompanyId = (session?.user as any)?.company_id;
  const id = mode === "edit" ? (params.id as string) : undefined;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(mode === "edit");
  const [accessDenied, setAccessDenied] = useState(false);
  const [formData, setFormData] = useState<CompanyFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [approvedByErrors, setApprovedByErrors] = useState<Record<string, string>>({});
  const { refreshCurrentCompany } = useCompanyContext();

  const progress = useMemo(() => {
    let filled = 0;
    let total = 0;

    const basicFields = [
      formData.company_name,
      formData.slug,
      formData.contact,
      formData.gstin_uin,
      formData.state_name,
      formData.state_code,
      formData.hsn_sac,
      formData.address,
      formData.logo,
    ];
    basicFields.forEach((field) => {
      total++;
      if (field && field.toString().trim() !== "") filled++;
    });

    const buyerFields = [
      formData.buyer_name,
      formData.buyer_gstin_uin,
      formData.buyer_state_name,
      formData.buyer_state_code,
      formData.buyer_address,
    ];
    buyerFields.forEach((field) => {
      total++;
      if (field && field.toString().trim() !== "") filled++;
    });

    const taxFields = [
      formData.cgst_rate,
      formData.sgst_rate,
      formData.income_tax_rate,
      formData.labour_cess_rate,
      formData.cgst_tds_rate,
      formData.sgst_tds_rate,
      formData.additional_deposit,
    ];
    taxFields.forEach((field) => {
      total++;
      if (field && parseFloat(field) > 0) filled++;
    });

    const bankFields = [
      formData.bank_name,
      formData.branch_name,
      formData.ifsc_code,
      formData.account_holder_name,
      formData.swift_code,
      formData.account_no,
    ];
    bankFields.forEach((field) => {
      total++;
      if (field && field.toString().trim() !== "") filled++;
    });

    return total > 0 ? Math.round((filled / total) * 100) : 0;
  }, [formData, mode]);

  const fetchCompany = useCallback(async () => {
    if (mode !== "edit" || !id) return;

    try {
      setFetching(true);
      const response = await axios.get(`/api/companies/${id}`);
      const data = response.data;
      setFormData({
        company_name: data.company_name || "",
        slug: data.slug || "",
        plan: data.plan || "BASIC",
        status: data.status || "ACTIVE",
        logo: data.logo || "",
        address: data.address || "",
        gstin_uin: data.gstin_uin || "",
        state_name: data.state_name || "",
        state_code: data.state_code || "",
        contact: data.contact || "",
        hsn_sac: data.hsn_sac || "",
        bill_to: data.bill_to || "",
        buyer_name: data.buyer_name || "",
        buyer_address: data.buyer_address || "",
        buyer_gstin_uin: data.buyer_gstin_uin || "",
        buyer_state_name: data.buyer_state_name || "",
        buyer_state_code: data.buyer_state_code || "",
        cgst_rate: data.cgst_rate?.toString() || "",
        sgst_rate: data.sgst_rate?.toString() || "",
        income_tax_rate: data.income_tax_rate?.toString() || "",
        labour_cess_rate: data.labour_cess_rate?.toString() || "",
        cgst_tds_rate: data.cgst_tds_rate?.toString() || "",
        sgst_tds_rate: data.sgst_tds_rate?.toString() || "",
        additional_deposit: data.additional_deposit?.toString() || "",
        bank_name: data.bank_name || "",
        branch_name: data.branch_name || "",
        ifsc_code: data.ifsc_code || "",
        account_holder_name: data.account_holder_name || "",
        swift_code: data.swift_code || "",
        account_no: data.account_no || "",
        module_access: Array.isArray(data.module_access)
          ? data.module_access
          : SIDEBAR_MODULES.flatMap((g) => g.items),
        approved_by_ranges: Array.isArray(data.approved_by_ranges)
          ? data.approved_by_ranges.map((r: any) => ({
              name: String(r.name || ""),
              amount_from: r.amount_from?.toString() || "",
              amount_to: r.amount_to?.toString() || "",
              field_name: String(r.field_name || ""),
            }))
          : [],
      });
    } catch {
      toast.error("Failed to fetch company details");
      router.push("/company");
    } finally {
      setFetching(false);
    }
  }, [id, mode, router]);

  useEffect(() => {
    if (mode === "edit" && session && role && id) {
      if (role !== "SuperAdmin" && role !== "Admin") {
        setAccessDenied(true);
        setFetching(false);
        return;
      }
      if (role === "Admin" && userCompanyId !== id) {
        setAccessDenied(true);
        setFetching(false);
        return;
      }
      fetchCompany();
    } else if (mode === "add" && session && role !== "SuperAdmin") {
      setAccessDenied(true);
    }
  }, [id, session, role, userCompanyId, mode, fetchCompany]);

  if (accessDenied) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            {mode === "add"
              ? "Access denied. Only SuperAdmin can add new companies."
              : "Access denied. You can only edit your own company."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleChange = (field: keyof CompanyFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleModuleToggle = (module: string) => {
    setFormData((prev) => {
      const current = prev.module_access;
      const next = current.includes(module)
        ? current.filter((m) => m !== module)
        : [...current, module];
      return { ...prev, module_access: next };
    });
  };

  const handleSectionToggle = (section: string) => {
    const sectionModules = SIDEBAR_MODULES.find((g) => g.section === section)?.items || [];
    setFormData((prev) => {
      const allSelected = sectionModules.every((m) => prev.module_access.includes(m));
      const next = allSelected
        ? prev.module_access.filter((m) => !sectionModules.includes(m))
        : [...new Set([...prev.module_access, ...sectionModules])];
      return { ...prev, module_access: next };
    });
  };

  const handleApprovedByChange = (
    index: number,
    field: keyof ApprovedByRangeFormData,
    value: string,
  ) => {
    setFormData((prev) => {
      const next = [...prev.approved_by_ranges];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, approved_by_ranges: next };
    });
    setApprovedByErrors((prev) => ({
      ...prev,
      [`${index}-${field}`]: "",
      [`${index}-range`]: "",
      [`${index}-overlap`]: "",
      approved_by_ranges: "",
    }));
  };

  const handleAddApprovedBy = () => {
    setFormData((prev) => ({
      ...prev,
      approved_by_ranges: [
        ...prev.approved_by_ranges,
        { name: "", amount_from: "", amount_to: "", field_name: "" },
      ],
    }));
    setApprovedByErrors((prev) => ({ ...prev, approved_by_ranges: "" }));
  };

  const handleRemoveApprovedBy = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      approved_by_ranges: prev.approved_by_ranges.filter((_, i) => i !== index),
    }));
    setApprovedByErrors((prev) => {
      const next: Record<string, string> = {};
      Object.keys(prev).forEach((key) => {
        if (!key.startsWith(`${index}-`)) {
          next[key] = prev[key];
        }
      });
      // Re-key errors after removal
      const rekeyed: Record<string, string> = {};
      Object.keys(next).forEach((key) => {
        if (/^(\d+)-(name|amount_from|amount_to|range|overlap)$/.test(key)) {
          const oldIdx = parseInt(key.split("-")[0]);
          if (oldIdx > index) {
            const newKey = key.replace(/^\d+/, String(oldIdx - 1));
            rekeyed[newKey] = next[key];
          } else {
            rekeyed[key] = next[key];
          }
        } else {
          rekeyed[key] = next[key];
        }
      });
      return rekeyed;
    });
  };

  const validateApprovedByRanges = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};
    const ranges = formData.approved_by_ranges;

    if (!ranges || ranges.length === 0) {
      newErrors.approved_by_ranges = "At least one Approved By configuration is required";
      return newErrors;
    }

    const parsed: { name: string; amount_from: number; amount_to: number }[] = [];

    ranges.forEach((row, i) => {
      if (!row.name.trim()) {
        newErrors[`${i}-name`] = "Name is required";
      }
      const from = row.amount_from === "" ? NaN : parseFloat(row.amount_from);
      const to = row.amount_to === "" ? NaN : parseFloat(row.amount_to);

      if (row.amount_from === "" || isNaN(from)) {
        newErrors[`${i}-amount_from`] = "Amount From is required";
      }
      if (row.amount_to === "" || isNaN(to)) {
        newErrors[`${i}-amount_to`] = "Amount To is required";
      }

      if (!isNaN(from) && !isNaN(to)) {
        if (from > to) {
          newErrors[`${i}-range`] = "Amount From must be less than or equal to Amount To";
        }
        if (row.name.trim()) {
          parsed.push({ name: row.name.trim(), amount_from: from, amount_to: to });
        }
      }
    });

    if (Object.keys(newErrors).length === 0) {
      for (let i = 0; i < parsed.length; i++) {
        for (let j = i + 1; j < parsed.length; j++) {
          if (
            parsed[i].amount_from <= parsed[j].amount_to &&
            parsed[j].amount_from <= parsed[i].amount_to
          ) {
            newErrors[`${i}-overlap`] = "Ranges cannot overlap";
            newErrors[`${j}-overlap`] = "Ranges cannot overlap";
          }
        }
      }
    }

    return newErrors;
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      newErrors.company_name = "Company name is required";
    }
    if (!formData.slug.trim()) {
      newErrors.slug = "Slug is required";
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug =
        "Slug must contain only lowercase letters, numbers, and hyphens";
    }
    if (formData.gstin_uin && !validateGSTIN(formData.gstin_uin)) {
      newErrors.gstin_uin = "Invalid GSTIN format";
    }
    if (formData.ifsc_code && !validateIFSC(formData.ifsc_code)) {
      newErrors.ifsc_code = "Invalid IFSC code format";
    }
    if (formData.buyer_gstin_uin && !validateGSTIN(formData.buyer_gstin_uin)) {
      newErrors.buyer_gstin_uin = "Invalid GSTIN format";
    }

    const approvedByErrors = validateApprovedByRanges();

    setErrors(newErrors);
    setApprovedByErrors(approvedByErrors);
    return Object.keys(newErrors).length === 0 && Object.keys(approvedByErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);

      let response;

      if (mode === "edit" && id) {
        response = await axios.put(`/api/companies/${id}`, formData);
        toast.success("Company updated successfully");
        refreshCurrentCompany();
      } else {
        response = await axios.post("/api/companies", formData);
        toast.success("Company created successfully");
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/company");
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.error ||
          `Failed to ${mode === "edit" ? "update" : "create"} company`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const formDataFile = new FormData();
      formDataFile.append("file", file);

      try {
        const response = await axios.post("/api/upload", formDataFile, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        handleChange("logo", response.data.url);
        toast.success("Image uploaded successfully");
      } catch {
        toast.error("Failed to upload image");
      }
    }
  };

  if (fetching) {
    return (
      <div className="container mx-auto py-6 max-w-6xl flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isEdit = mode === "edit";

  return (
    <div className="h-full flex flex-col gap-4 md:gap-6 w-full">
      <div className=" -mt-[1.5rem] -ml-[1.5rem] -mr-[1.5rem]">
        <div className="w-full h-1.5 bg-muted rounded-full bg-red-500 overflow-hidden mb-4 w-[calc(100%+3rem)]">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
      {!isEdit ? (
        <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
              Add Company
            </h2>
            <p className="text-muted-foreground text-sm">
              Create a new company account
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
              Edit Company
            </h2>
            <p className="text-muted-foreground text-sm">
              Update company information
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                name="company_name"
                value={formData.company_name}
                onChange={(e) => handleChange("company_name", e.target.value)}
                placeholder="Enter company name"
                required
              />
              {errors.company_name && (
                <p className="text-xs text-red-500">{errors.company_name}</p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={(e) =>
                  handleChange(
                    "slug",
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  )
                }
                placeholder="company-slug"
                required
              />
              {errors.slug && (
                <p className="text-xs text-red-500">{errors.slug}</p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="contact">Contact</Label>
              <Input
                id="contact"
                name="contact"
                value={formData.contact}
                onChange={(e) => handleChange("contact", e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="gstin_uin">GSTIN/UIN</Label>
              <Input
                id="gstin_uin"
                value={formData.gstin_uin}
                onChange={(e) =>
                  handleChange("gstin_uin", e.target.value.toUpperCase())
                }
                placeholder="29AABCU9603R1ZM"
              />
              {errors.gstin_uin && (
                <p className="text-xs text-red-500">{errors.gstin_uin}</p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="state_name">State Name</Label>
              <Input
                id="state_name"
                value={formData.state_name}
                onChange={(e) => handleChange("state_name", e.target.value)}
                placeholder="Maharashtra"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="state_code">State Code</Label>
              <Input
                id="state_code"
                value={formData.state_code}
                onChange={(e) => handleChange("state_code", e.target.value)}
                placeholder="27"
              />
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="hsn_sac">HSN/SAC</Label>
              <Input
                id="hsn_sac"
                value={formData.hsn_sac}
                onChange={(e) => handleChange("hsn_sac", e.target.value)}
                placeholder="HSN/SAC code"
              />
            </div>
            <div className="space-y-2 relative">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                  <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                  <SelectItem value="TRIAL">TRIAL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 relative">
              <Label>Plan</Label>
              <Select
                value={formData.plan}
                onValueChange={(value) => handleChange("plan", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASIC">BASIC</SelectItem>
                  <SelectItem value="PRO">PRO</SelectItem>
                  <SelectItem value="ENTERPRISE">ENTERPRISE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="logo">Logo</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
              />
              {formData.logo && (
                <img
                  src={formData.logo}
                  alt="Logo"
                  className="w-20 h-20 rounded object-cover mt-2"
                />
              )}
            </div>

            <div className="space-y-2 relative md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Full address"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">
            Buyer (Bill To)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* <div className="space-y-2">
                        <Label htmlFor="bill_to">Bill To</Label>
                        <Input
                            id="bill_to"
                            value={formData.bill_to}
                            onChange={(e) => handleChange('bill_to', e.target.value)}
                            placeholder="Billing name"
                        />
                    </div> */}
            <div className="space-y-2 relative">
              <Label htmlFor="buyer_name">Buyer Name</Label>
              <Input
                id="buyer_name"
                value={formData.buyer_name}
                onChange={(e) => handleChange("buyer_name", e.target.value)}
                placeholder="Contact person name"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="buyer_gstin_uin">Buyer GSTIN/UIN</Label>
              <Input
                id="buyer_gstin_uin"
                value={formData.buyer_gstin_uin}
                onChange={(e) =>
                  handleChange("buyer_gstin_uin", e.target.value.toUpperCase())
                }
                placeholder="29AABCU9603R1ZM"
              />
              {errors.buyer_gstin_uin && (
                <p className="text-xs text-red-500">{errors.buyer_gstin_uin}</p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="buyer_state_name">Buyer State Name</Label>
              <Input
                id="buyer_state_name"
                value={formData.buyer_state_name}
                onChange={(e) =>
                  handleChange("buyer_state_name", e.target.value)
                }
                placeholder="State name"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="buyer_state_code">Buyer State Code</Label>
              <Input
                id="buyer_state_code"
                value={formData.buyer_state_code}
                onChange={(e) =>
                  handleChange("buyer_state_code", e.target.value)
                }
                placeholder="State code"
              />
            </div>
            <div className="space-y-2 relative md:col-span-3">
              <Label htmlFor="buyer_address">Buyer Address</Label>
              <Textarea
                id="buyer_address"
                value={formData.buyer_address}
                onChange={(e) => handleChange("buyer_address", e.target.value)}
                placeholder="Full billing address"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">
            Tax Rates
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="cgst_rate">CGST (%)</Label>
              <Input
                id="cgst_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.cgst_rate}
                onChange={(e) => handleChange("cgst_rate", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="sgst_rate">SGST (%)</Label>
              <Input
                id="sgst_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.sgst_rate}
                onChange={(e) => handleChange("sgst_rate", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="income_tax_rate">Income Tax (%)</Label>
              <Input
                id="income_tax_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.income_tax_rate}
                onChange={(e) =>
                  handleChange("income_tax_rate", e.target.value)
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="labour_cess_rate">Labour Cess (%)</Label>
              <Input
                id="labour_cess_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.labour_cess_rate}
                onChange={(e) =>
                  handleChange("labour_cess_rate", e.target.value)
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="cgst_tds_rate">CGST (TDS) (%)</Label>
              <Input
                id="cgst_tds_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.cgst_tds_rate}
                onChange={(e) => handleChange("cgst_tds_rate", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="sgst_tds_rate">SGST (TDS) (%)</Label>
              <Input
                id="sgst_tds_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.sgst_tds_rate}
                onChange={(e) => handleChange("sgst_tds_rate", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="additional_deposit">Additional Deposit (%)</Label>
              <Input
                id="additional_deposit"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.additional_deposit}
                onChange={(e) =>
                  handleChange("additional_deposit", e.target.value)
                }
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">
            Approved By
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure who approves bills based on the final total amount.
          </p>
          <div className="space-y-4">
            {formData.approved_by_ranges.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start border rounded-lg p-4"
              >
                <div className="space-y-2 relative">
                  <Label htmlFor={`approved_by_name_${i}`}>Name *</Label>
                  <Input
                    id={`approved_by_name_${i}`}
                    value={row.name}
                    onChange={(e) => handleApprovedByChange(i, "name", e.target.value)}
                    placeholder="e.g. Exe"
                    className={
                      approvedByErrors[`${i}-name`] ? "border-red-500" : ""
                    }
                  />
                  {approvedByErrors[`${i}-name`] && (
                    <p className="text-xs text-red-500">
                      {approvedByErrors[`${i}-name`]}
                    </p>
                  )}
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor={`approved_by_from_${i}`}>Amount From *</Label>
                  <Input
                    id={`approved_by_from_${i}`}
                    type="number"
                    min="0"
                    value={row.amount_from}
                    onChange={(e) =>
                      handleApprovedByChange(i, "amount_from", e.target.value)
                    }
                    placeholder="0.00"
                    className={
                      approvedByErrors[`${i}-amount_from`] ||
                      approvedByErrors[`${i}-range`] ||
                      approvedByErrors[`${i}-overlap`]
                        ? "border-red-500"
                        : ""
                    }
                  />
                  {approvedByErrors[`${i}-amount_from`] && (
                    <p className="text-xs text-red-500">
                      {approvedByErrors[`${i}-amount_from`]}
                    </p>
                  )}
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor={`approved_by_to_${i}`}>Amount To *</Label>
                  <Input
                    id={`approved_by_to_${i}`}
                    type="number"
                    min="0"
                    value={row.amount_to}
                    onChange={(e) =>
                      handleApprovedByChange(i, "amount_to", e.target.value)
                    }
                    placeholder="0.00"
                    className={
                      approvedByErrors[`${i}-amount_to`] ||
                      approvedByErrors[`${i}-range`] ||
                      approvedByErrors[`${i}-overlap`]
                        ? "border-red-500"
                        : ""
                    }
                  />
                  {approvedByErrors[`${i}-amount_to`] && (
                    <p className="text-xs text-red-500">
                      {approvedByErrors[`${i}-amount_to`]}
                    </p>
                  )}
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor={`approved_by_field_name_${i}`}>Approved By Field Name</Label>
                  <Input
                    id={`approved_by_field_name_${i}`}
                    value={row.field_name}
                    onChange={(e) =>
                      handleApprovedByChange(i, "field_name", e.target.value)
                    }
                    placeholder="e.g. BMC"
                  />
                </div>
                <div className="flex flex-col gap-1 items-start md:pt-[10px]">
                  <div className="flex items-center gap-2">
                    {formData.approved_by_ranges.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveApprovedBy(i)}
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                  {approvedByErrors[`${i}-range`] && (
                    <p className="text-xs text-red-500">
                      {approvedByErrors[`${i}-range`]}
                    </p>
                  )}
                  {approvedByErrors[`${i}-overlap`] && (
                    <p className="text-xs text-red-500">
                      {approvedByErrors[`${i}-overlap`]}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddApprovedBy}
            >
              <Plus className="h-4 w-4" />
              Add Approved By
            </Button>
            {approvedByErrors.approved_by_ranges && (
              <p className="text-xs text-red-500">
                {approvedByErrors.approved_by_ranges}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">
            Bank Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input
                id="bank_name"
                value={formData.bank_name}
                onChange={(e) => handleChange("bank_name", e.target.value)}
                placeholder="Bank name"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="branch_name">Branch Name</Label>
              <Input
                id="branch_name"
                value={formData.branch_name}
                onChange={(e) => handleChange("branch_name", e.target.value)}
                placeholder="Branch name"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="ifsc_code">IFSC Code</Label>
              <Input
                id="ifsc_code"
                value={formData.ifsc_code}
                onChange={(e) =>
                  handleChange("ifsc_code", e.target.value.toUpperCase())
                }
                placeholder="SBIN0001234"
              />
              {errors.ifsc_code && (
                <p className="text-xs text-red-500">{errors.ifsc_code}</p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="account_holder_name">Account Holder Name</Label>
              <Input
                id="account_holder_name"
                value={formData.account_holder_name}
                onChange={(e) =>
                  handleChange("account_holder_name", e.target.value)
                }
                placeholder="Account holder name"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="swift_code">SWIFT Code</Label>
              <Input
                id="swift_code"
                value={formData.swift_code}
                onChange={(e) =>
                  handleChange("swift_code", e.target.value.toUpperCase())
                }
                placeholder="SWIFT code"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="account_no">Account Number</Label>
              <Input
                id="account_no"
                value={formData.account_no}
                onChange={(e) => handleChange("account_no", e.target.value)}
                placeholder="Account number"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">
            Module Access
          </h3>
          <p className="text-sm text-muted-foreground">
            Select which sidebar modules this company can access.
          </p>
          <div className="space-y-4">
            {SIDEBAR_MODULES.map((group) => {
              const allSelected = group.items.every((m) => formData.module_access.includes(m));
              const someSelected = group.items.some((m) => formData.module_access.includes(m));
              return (
                <div key={group.section} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`section-${group.section}`}
                      checked={allSelected}
                      onCheckedChange={() => handleSectionToggle(group.section)}
                    />
                    <label
                      htmlFor={`section-${group.section}`}
                      className="text-sm font-medium leading-none cursor-pointer select-none"
                    >
                      {group.section}
                    </label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pl-6">
                    {group.items.map((module) => (
                      <div key={module} className="flex items-center gap-2">
                        <Checkbox
                          id={`module-${module}`}
                          checked={formData.module_access.includes(module)}
                          onCheckedChange={() => handleModuleToggle(module)}
                        />
                        <label
                          htmlFor={`module-${module}`}
                          className="text-sm leading-none cursor-pointer select-none"
                        >
                          {module}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Update Company" : "Save Company"}
          </Button>
        </div>
      </form>
    </div>
  );
}
