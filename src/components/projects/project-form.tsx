"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFormik } from "formik";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InlineSelect } from "@/components/common/InlineSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ProjectDocumentUpload from "./ProjectDocumentUpload";
import { ProjectItemDetails } from "./ProjectItemDetails";

interface Project {
  id: string;
  name: string;
  unique_name: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number;
  status: string;
  year: string | null;
  tender_notice_no: string | null;
  project_no: string | null;
  work_type: string | null;
  sor_id: string | null;
  area: string | null;
  time_limit: string | null;
  project_estimation_cost: number | null;
  negotiation_price_id: string | null;
  negotiation_price_value: string | null;
  negotiation_type: string | null;
  tender_premium_id: string | null;
  tender_premium_value: string | null;
  tender_premium_type: string | null;
  loa_approved_no: string | null;
  loa_approved_date: string | null;
  project_end_date: string | null;
  time_limit_unit: string | null;
  work_order_date: string | null;
  project_approved_amount: number | null;
  agreement_no: string | null;
  locations?: Array<{
    id: string;
    location_id: string;
    location?: { id: string; name: string };
  }>;
  documents?: Array<{
    id: string;
    document_type: string;
    file_url: string;
    file_name: string;
    file_size?: number | null;
  }>;
  items?: Array<{
    id: string;
    capital_sor_id: string;
    size: string;
    rate: string | number;
    capitalSOR?: {
      id: string;
      item_name: string;
      uom: string;
      currentPrice: string;
    } | null;
  }>;
  main_item_execution_qty: string | null;
  progress_item_id: string | null;
  work_progress: string | null;
  department: string | null;
  place_of_work: string | null;
  estimate_amount: number | null;
  tender_amount: number | null;
  loa_date: string | null;
  time_limit_end: string | null;
  work_completion_date: string | null;
  cost_of_completion: number | null;
  time_period: string | null;
  remark: string | null;
  wizard_step?: number;
  is_completed: boolean;
  retention_money_details: string | null;
  retention_money_details_no: string | null;
  retention_money_details_start_date: string | null;
  retention_money_details_end_date: string | null;
  sd_amount: number | null;
  sd_no: string | null;
  sd_start_date: string | null;
  sd_end_date: string | null;
  // Hidden fields (kept for database compatibility but not shown in UI)
  // start_date: string | null; // Hidden - auto field for material tracking
  // end_date: string | null; // Hidden - depends on sales
  // description: string | null; // Hidden
  // place_of_work: string | null; // Hidden
  // estimate_amount: number | null; // Hidden
  // tender_amount: number | null; // Hidden
  // loa_date: string | null; // Hidden
  // time_limit_end: string | null; // Hidden
  // work_completion_date: string | null; // Hidden
  // cost_of_completion: number | null; // Hidden
  // Relations (for display purposes)
  negotiationPrice?: {
    name: string;
  };
}

interface ProjectFormProps {
  project?: Project | null | undefined;
  onSuccess: () => void;
  onCancel: () => void;
  onProjectUpdate?: (project: Project | null) => void;
  onProgress?: (progress: number) => void;
  uniqueName?: string;
  onUniqueNameChange?: (value: string) => void;
  onUniqueNameError?: (error: string | null) => void;
  tenderNoticeNo?: string;
  onTenderNoticeNoChange?: (value: string) => void;
  onTenderNoticeNoError?: (error: string | null) => void;
  projectName?: string;
  onProjectNameChange?: (value: string) => void;
  onProjectNameError?: (error: string | null) => void;
  allFieldsDisabled?: boolean;
  initialWizardStep?: number;
}

const validationSchema = Yup.object({
  name: Yup.string()
    .required("Project name is required")
    .min(1, "Project name is required"),
  unique_name: Yup.string()
    .required("Unique name is required")
    .min(1, "Unique name is required"),
  work_type: Yup.string().required("Work type is required"),
  sor_id: Yup.string().required("SOR is required"),
  department: Yup.string().required("Department is required"),
  area: Yup.string().required("Area is required"),
  locations: Yup.array().min(1, "At least one location is required"),
  negotiation_price_id: Yup.string(),
  negotiation_price_value: Yup.string(),
  tender_premium_id: Yup.string().required("Tender premium is required"),
  tender_premium_type: Yup.string(),
  tender_notice_no: Yup.string()
    .required("Tender Notice No is required")
    .min(1, "Tender Notice No is required"),
  tender_premium_value: Yup.string().when("tender_premium_id", {
    is: (val: string) => val && val !== "0",
    then: (schema) => schema.required("Tender premium value is required"),
    otherwise: (schema) => schema.notRequired(),
  }),
  project_estimation_cost: Yup.number()
    .required("Project estimation cost is required")
    .min(0, "Estimation cost must be positive")
    .typeError("Project estimation cost is required")
    .transform((value, original) => (original === "" ? undefined : value)),
  sd_amount: Yup.number()
    .required("SD amount is required")
    .min(0, "SD amount must be positive")
    .typeError("SD amount is required")
    .nullable()
    .transform((value, original) => (original === "" ? undefined : value)),
  sd_no: Yup.string().required("SD no is required"),
  sd_start_date: Yup.string().required("SD start date is required"),
  sd_end_date: Yup.string().required("SD end date is required"),
  retention_money_details: Yup.string().required("Retention money details is required"),
  retention_money_details_no: Yup.string().required("Retention money details no is required"),
  retention_money_details_start_date: Yup.string().required("Retention money details start date is required"),
  retention_money_details_end_date: Yup.string().required("Retention money details end date is required"),
  time_limit: Yup.string()
    .required("Time limit is required")
    .test(
      "max",
      "Time limit must be 1200 or less",
      (val) => !val || parseInt(val, 10) <= 1200,
    ),
  agreement_no: Yup.string(),
  loa_approved_no: Yup.string(),
  loa_approved_date: Yup.string(),
  project_end_date: Yup.string(),
  time_limit_unit: Yup.string(),
  work_order_date: Yup.string(),
  budget: Yup.number()
    .min(0, "Budget must be positive")
    .nullable()
    .transform((value, original) => (original === "" ? null : value)),
  project_approved_amount: Yup.number()
    .min(0, "Approved amount must be positive")
    .nullable()
    .transform((value, original) => (original === "" ? null : value)),
  estimate_amount: Yup.number()
    .min(0, "Estimate amount must be positive")
    .nullable()
    .transform((value, original) => (original === "" ? null : value)),
  tender_amount: Yup.number()
    .min(0, "Tender amount must be positive")
    .nullable()
    .transform((value, original) => (original === "" ? null : value)),
  cost_of_completion: Yup.number()
    .min(0, "Cost of completion must be positive")
    .nullable()
    .transform((value, original) => (original === "" ? null : value)),
});

// Map Negotiation Price display labels to stored values
function mapNegotiationPriceId(input: string | null | undefined): string {
  if (!input) return "-";
  const map: Record<string, string> = { Below: "-", Above: "+", Equal: "0" };
  return map[input] ?? input;
}

export function ProjectForm({
  project,
  onSuccess,
  onCancel,
  onProjectUpdate,
  onProgress,
  uniqueName,
  onUniqueNameChange,
  onUniqueNameError,
  tenderNoticeNo,
  onTenderNoticeNoChange,
  onTenderNoticeNoError,
  projectName,
  onProjectNameChange,
  onProjectNameError,
  allFieldsDisabled,
  initialWizardStep,
}: ProjectFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [tempDocIds, setTempDocIds] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(() => {
    // When editing a non-draft project missing agreement_no or work_order_date, start on step 2
    if (project && project.status !== 'DRAFT' && (!project.agreement_no || !project.work_order_date)) {
      return 2;
    }
    return initialWizardStep || 1;
  });
  const initialProjectItems =
    project?.items && project.items.length > 0
      ? project.items.map((item) => ({
          capital_sor_id: item.capital_sor_id,
          capitalSOR: item.capitalSOR
            ? {
                id: item.capitalSOR.id,
                item_name: item.capitalSOR.item_name,
                uom: item.capitalSOR.uom,
                currentPrice: item.capitalSOR.currentPrice,
              }
            : null,
          size: item.size || "",
          rate: item.rate?.toString() || "0",
        }))
      : [];

  const [progressItemIds, setProgressItemIds] = useState<string[]>([]);

  const initialProgressItemIds = useMemo(() => {
    const tracked = project?.items?.filter((i: any) => i.is_price_tracking) || [];
    if (tracked.length > 0) {
      return tracked.map((i: any) => i.capital_sor_id);
    }
    return [];
  }, [project?.items]);

  const formRef = useRef<HTMLFormElement>(null);
  const lastSavedValuesRef = useRef<string>("");
  const isAutoSavingRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tracked =
      project?.items?.filter((i: any) => i.is_price_tracking) || [];
    if (tracked.length > 0) {
      setProgressItemIds(tracked.map((i: any) => i.capital_sor_id));
    } else if (initialProjectItems.length > 0) {
      setProgressItemIds([initialProjectItems[0].capital_sor_id]);
    } else {
      setProgressItemIds([]);
    }
  }, [project?.id]);
  // Use draftId when project is being created via wizard, otherwise use the editing project's id
  const effectiveProjectId = draftId || project?.id || "";

  const handleTempDocUploaded = (
    documentType: string,
    tempDocId: string | null,
  ) => {
    setTempDocIds((prev) => ({
      ...prev,
      [documentType]: tempDocId || "",
    }));
  };

  const initialLocationIds =
    project?.locations && project.locations.length > 0
      ? project.locations.map((loc) => loc.location_id)
      : [];

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: project?.name || "",
      unique_name: project?.unique_name || "",
      budget: project?.budget?.toString() || "0",
      year: project?.year || "",
      tender_notice_no: project?.tender_notice_no || "",
      project_no: project?.project_no || "",
      work_type: project?.work_type || "",
      sor_id: project?.sor_id || "",
      area: project?.area || "",
      time_limit: project?.time_limit || "",
      project_estimation_cost:
        project?.project_estimation_cost?.toString() || "",
      negotiation_price_id: mapNegotiationPriceId(
        project?.negotiation_price_id,
      ),
      negotiation_price_value:
        mapNegotiationPriceId(project?.negotiation_price_id) === "0"
          ? "0"
          : project?.negotiation_price_value?.toString() || "",
      negotiation_type: project?.negotiation_type || "Amount",
      tender_premium_id: project?.tender_premium_id || "-",
      tender_premium_value: project?.tender_premium_value?.toString() || "",
      tender_premium_type: project?.tender_premium_type || "Amount",
      project_approved_amount:
        project?.project_approved_amount?.toString() || "",
      loa_approved_no: project?.loa_approved_no || "",
      loa_approved_date: project?.loa_approved_date
        ? new Date(project.loa_approved_date).toISOString().split("T")[0]
        : "",
      project_end_date: project?.project_end_date
        ? new Date(project.project_end_date).toISOString().split("T")[0]
        : "",
      time_limit_unit: project?.time_limit_unit || "",
      work_order_date: project?.work_order_date
        ? new Date(project.work_order_date).toISOString().split("T")[0]
        : "",
      agreement_no: project?.agreement_no || "",
      main_item_execution_qty: project?.main_item_execution_qty || "",
      work_progress: project?.work_progress || "",
      department: project?.department || "",
      time_period: project?.time_period || "",
      remark: project?.remark || "",
      retention_money_details: project?.retention_money_details || "",
      retention_money_details_no: project?.retention_money_details_no || "",
      retention_money_details_start_date:
        project?.retention_money_details_start_date
          ? new Date(project.retention_money_details_start_date)
              .toISOString()
              .split("T")[0]
          : "",
      retention_money_details_end_date:
        project?.retention_money_details_end_date
          ? new Date(project.retention_money_details_end_date)
              .toISOString()
              .split("T")[0]
          : "",
      sd_amount: project?.sd_amount?.toString() || "",
      sd_no: project?.sd_no || "",
      sd_start_date: project?.sd_start_date
        ? new Date(project.sd_start_date).toISOString().split("T")[0]
        : "",
      sd_end_date: project?.sd_end_date
        ? new Date(project.sd_end_date).toISOString().split("T")[0]
        : "",
      description: project?.description || "",
      start_date: project?.start_date
        ? new Date(project.start_date).toISOString().split("T")[0]
        : "",
      end_date: project?.end_date
        ? new Date(project.end_date).toISOString().split("T")[0]
        : "",
      status: project?.status || "NOT_STARTED",
      place_of_work: project?.place_of_work || "",
      estimate_amount: project?.estimate_amount?.toString() || "",
      tender_amount: project?.tender_amount?.toString() || "",
      loa_date: project?.loa_date
        ? new Date(project.loa_date).toISOString().split("T")[0]
        : "",
      time_limit_end: project?.time_limit_end
        ? new Date(project.time_limit_end).toISOString().split("T")[0]
        : "",
      work_completion_date: project?.work_completion_date
        ? new Date(project.work_completion_date).toISOString().split("T")[0]
        : "",
      cost_of_completion: project?.cost_of_completion?.toString() || "",
      locations: initialLocationIds,
      projectItems: initialProjectItems,
      progress_item_id: project?.progress_item_id || null,
      supervisor: project?.supervisor || "",
      officer: project?.officer || "",
      remarks: project?.remarks || "",
    },
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    validate: (values) => {
      const errors: Record<string, any> = {};

      const validItems =
        values.projectItems?.filter((item) => item && item.capital_sor_id) ||
        [];

      if (validItems.length === 0) {
        errors.projectItems = "At least one item is required";
      }

      if (values.projectItems && values.projectItems.length > 0) {
        const itemErrors: string[] = [];
        values.projectItems.forEach((item, index) => {
          if (item.capital_sor_id) {
            if (!item.size || item.size.trim() === "") {
              itemErrors[index] = "Size is required";
            } else if (parseFloat(item.size) <= 0) {
              itemErrors[index] = "Size must be greater than 0";
            }
          }
        });
        if (itemErrors.some((e) => e)) {
          errors.projectItems = itemErrors;
        }
      }

      const requiredDocTypes = [
        "TENDER_NIT",
        "WORK_ORDER",
        "ESTIMATE",
        "AGREEMENT",
        "LOA",
      ];
      requiredDocTypes.forEach((docType) => {
        const hasExistingDoc = project?.documents?.some(
          (d) => d.document_type === docType,
        );
        const hasTempDoc = !!tempDocIds[docType];
        if (!hasExistingDoc && !hasTempDoc) {
          errors[`doc_${docType}`] =
            `${docType.replace(/_/g, " ")} is required`;
        }
      });

      // Agreement No and Work Order Date required only when editing a non-draft project
      if (project && project.status !== 'DRAFT') {
        if (!values.agreement_no || values.agreement_no.trim() === "") {
          errors.agreement_no = "Agreement no is required";
        }
        if (!values.work_order_date || values.work_order_date.trim() === "") {
          errors.work_order_date = "Work order date is required";
        }
      }

      return errors;
    },
    onSubmit: async (values) => {
      const tempDocIdsList = Object.values(tempDocIds).filter(Boolean);

      const submitData: Record<string, any> = {
        name: values.name,
        unique_name: values.unique_name || undefined,
        description: values.description || undefined,
        start_date: values.start_date ? new Date(values.start_date) : undefined,
        end_date: values.end_date ? new Date(values.end_date) : undefined,
        budget: parseFloat(values.budget) || 0,
        status: values.status,
        year: values.year || undefined,
        tender_notice_no: values.tender_notice_no || undefined,
        project_no: values.project_no || undefined,
        work_type: values.work_type || undefined,
        sor_id: values.sor_id || undefined,
        area: values.area || undefined,
        location_ids: values.locations,
        time_limit: values.time_limit?.toString() || undefined,
        project_estimation_cost: values.project_estimation_cost
          ? parseFloat(values.project_estimation_cost)
          : undefined,
        negotiation_price_id:
          mapNegotiationPriceId(values.negotiation_price_id) || undefined,
        negotiation_price_value: values.negotiation_price_value?.toString() || "0",
        negotiation_type: values.negotiation_type || undefined,
        tender_premium_id: values.tender_premium_id || undefined,
        tender_premium_value: values.tender_premium_value?.toString() || undefined,
        tender_premium_type: values.tender_premium_type || undefined,
        project_approved_amount: values.project_approved_amount
          ? parseFloat(values.project_approved_amount)
          : undefined,
        loa_approved_no: values.loa_approved_no || undefined,
        loa_approved_date: values.loa_approved_date
          ? new Date(values.loa_approved_date)
          : undefined,
        project_end_date: values.project_end_date
          ? new Date(values.project_end_date)
          : undefined,
        time_limit_unit: values.time_limit_unit || undefined,
        work_order_date: values.work_order_date
          ? new Date(values.work_order_date)
          : undefined,
        agreement_no: values.agreement_no || undefined,
        main_item_execution_qty: values.main_item_execution_qty || undefined,
        work_progress: values.work_progress || undefined,
        department: values.department || undefined,
        place_of_work: values.place_of_work || undefined,
        estimate_amount: values.estimate_amount
          ? parseFloat(values.estimate_amount)
          : undefined,
        tender_amount: values.tender_amount
          ? parseFloat(values.tender_amount)
          : undefined,
        loa_date: values.loa_date ? new Date(values.loa_date) : undefined,
        time_limit_end: values.time_limit_end
          ? new Date(values.time_limit_end)
          : undefined,
        work_completion_date: values.work_completion_date
          ? new Date(values.work_completion_date)
          : undefined,
        cost_of_completion: values.cost_of_completion
          ? parseFloat(values.cost_of_completion)
          : undefined,
        time_period: values.time_period || undefined,
        remark: values.remark || undefined,
        is_completed: values.status === "COMPLETED",
        retention_money_details: values.retention_money_details || undefined,
        retention_money_details_no:
          values.retention_money_details_no || undefined,
        retention_money_details_start_date:
          values.retention_money_details_start_date
            ? new Date(values.retention_money_details_start_date)
            : undefined,
        retention_money_details_end_date:
          values.retention_money_details_end_date
            ? new Date(values.retention_money_details_end_date)
            : undefined,
        sd_amount: values.sd_amount ? parseFloat(values.sd_amount) : undefined,
        sd_no: values.sd_no || undefined,
        sd_start_date: values.sd_start_date
          ? new Date(values.sd_start_date)
          : undefined,
        sd_end_date: values.sd_end_date
          ? new Date(values.sd_end_date)
          : undefined,
        progress_item_id: progressItemIds[0] || null,
      };

      if (tempDocIdsList.length > 0) {
        submitData.temp_document_ids = tempDocIdsList;
      }

      if (values.projectItems) {
        submitData.project_items = values.projectItems
          .filter((item) => item.capital_sor_id)
          .map((item) => ({
            capital_sor_id: item.capital_sor_id,
            size: item.size || "",
            rate: parseFloat(item.rate) || 0,
            is_price_tracking: progressItemIds.includes(item.capital_sor_id),
          }));
      }

      setIsSubmitting(true);
      try {
        const targetId = project?.id || draftId;
        if (targetId) {
          await axios.put(`/api/projects/${targetId}`, submitData);
          toast.success(
            `Project saved successfully${values.tender_notice_no ? `. Tender Notice No: ${values.tender_notice_no}` : ""}`,
          );
        } else {
          const response = await axios.post("/api/projects", submitData);
          toast.success(
            `Project created successfully${values.tender_notice_no ? `. Tender Notice No: ${values.tender_notice_no}` : ""}`,
          );
          if (response.data.success && response.data.data) {
            onProjectUpdate?.(response.data.data);
          }
          if (response.data.success && response.data.data?.id) {
            const freshResponse = await axios.get(
              `/api/projects/${response.data.data.id}`,
            );
            if (freshResponse.data.success && freshResponse.data.data) {
              onProjectUpdate?.(freshResponse.data.data);
            }
          }
        }
        onSuccess();
      } catch (error) {
        toast.error(
          (error as any).response?.data?.message || "Failed to save project",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  useEffect(() => {
    if (typeof uniqueName === "string") {
      formik.setFieldValue("unique_name", uniqueName);
    }
  }, [uniqueName]);

  useEffect(() => {
    if (typeof tenderNoticeNo === "string") {
      formik.setFieldValue("tender_notice_no", tenderNoticeNo);
    }
  }, [tenderNoticeNo]);

  useEffect(() => {
    if (onUniqueNameError) {
      onUniqueNameError(
        formik.submitCount > 0 && formik.errors.unique_name
          ? formik.errors.unique_name
          : null,
      );
    }
  }, [formik.errors.unique_name, formik.submitCount]);

  useEffect(() => {
    if (onUniqueNameChange) {
      onUniqueNameChange(project?.unique_name || "");
    }
  }, []);

  useEffect(() => {
    if (onTenderNoticeNoError) {
      onTenderNoticeNoError(
        formik.submitCount > 0 && formik.errors.tender_notice_no
          ? formik.errors.tender_notice_no
          : null,
      );
    }
  }, [formik.errors.tender_notice_no, formik.submitCount]);

  useEffect(() => {
    if (onTenderNoticeNoChange) {
      onTenderNoticeNoChange(project?.tender_notice_no || "");
    }
  }, []);

  useEffect(() => {
    if (typeof projectName === "string") {
      formik.setFieldValue("name", projectName);
    }
  }, [projectName]);

  useEffect(() => {
    if (onProjectNameError) {
      onProjectNameError(
        formik.submitCount > 0 && formik.errors.name
          ? formik.errors.name
          : null,
      );
    }
  }, [formik.errors.name, formik.submitCount]);

  useEffect(() => {
    if (onProjectNameChange) {
      onProjectNameChange(project?.name || "");
    }
  }, []);

  const prevTempDocIdsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (
      JSON.stringify(prevTempDocIdsRef.current) !== JSON.stringify(tempDocIds)
    ) {
      prevTempDocIdsRef.current = tempDocIds;
      formik.validateForm().catch(() => {});
    }
  }, [tempDocIds]);

  const [departmentOptions, setDepartmentOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [locationOptions, setLocationOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [workTypeOptions, setWorkTypeOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [sorOptions, setSorOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [areaOptions, setAreaOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await axios.get("/api/departments");
        const data = response.data.data || response.data;
        const options = (Array.isArray(data) ? data : [])
          .filter((item: any) => item.name !== "PURCHASE")
          .map((item: any) => ({
          label: item.name,
          value: item.id,
        }));
        setDepartmentOptions(options);
      } catch (error: any) {
        console.error("Failed to fetch departments:", error);
        toast.error(
          error?.response?.data?.message || "Failed to load departments",
        );
      }
    };
    fetchDepartments();
  }, []);

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await axios.get("/api/locations");
        const data = response.data.data || response.data;
        const options = (Array.isArray(data) ? data : []).map((item: any) => ({
          label: item.name,
          value: item.id,
        }));
        setLocationOptions(options);
      } catch (error: any) {
        console.error("Failed to fetch locations:", error);
        toast.error(
          error?.response?.data?.message || "Failed to load locations",
        );
      }
    };
    fetchLocations();
  }, []);

  // Fetch work types from WorkType table
  useEffect(() => {
    const fetchWorkTypes = async () => {
      try {
        const response = await axios.get(
          "/api/project-work-types?limit=999999999",
        );
        const data = response.data.data || response.data;
        if (Array.isArray(data) && data.length > 0) {
          const workTypeOptionsFromApi = data.map((item: any) => ({
            label: item.title,
            value: item.id,
          }));
          // Merge with default work types, avoiding duplicates

          setWorkTypeOptions(workTypeOptionsFromApi);
        }
      } catch (error: any) {
        console.error("Failed to fetch work types:", error);
        toast.error(
          error?.response?.data?.message || "Failed to load work types",
        );
      }
    };
    fetchWorkTypes();
  }, []);

  // Fetch SOR items
  useEffect(() => {
    const fetchSorItems = async () => {
      try {
        const response = await axios.get("/api/sor-items?limit=999999999");
        const data = response.data.data || response.data;
        if (Array.isArray(data) && data.length > 0) {
          const options = data
            .filter((item: any) => item.name !== "OTHER ITEM")
            .map((item: any) => ({
            label: item.name,
            value: item.id,
          }));
          setSorOptions(options);
        }
      } catch (error: any) {
        console.error("Failed to fetch SOR items:", error);
        toast.error(
          error?.response?.data?.message || "Failed to load SOR items",
        );
      }
    };
    fetchSorItems();
  }, []);

  // Refresh SOR and Department options when returning from Item Master tab
  useEffect(() => {
    const refreshOptions = () => {
      axios.get("/api/sor-items?limit=999999999").then((res) => {
        const data = res.data.data || res.data;
        if (Array.isArray(data)) {
          setSorOptions(data
            .filter((item: any) => item.name !== "OTHER ITEM")
            .map((item: any) => ({ label: item.name, value: item.id })));
        }
      }).catch(() => {});
      axios.get("/api/departments").then((res) => {
        const data = res.data.data || res.data;
        if (Array.isArray(data)) {
          setDepartmentOptions(data
            .filter((item: any) => item.name !== "PURCHASE")
            .map((item: any) => ({ label: item.name, value: item.id })));
        }
      }).catch(() => {});
    };
    window.addEventListener('focus', refreshOptions);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshOptions();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'im-refresh') refreshOptions();
    };
    window.addEventListener('storage', handleStorage);
    try {
      const bc = new BroadcastChannel('item-master-sync');
      bc.onmessage = refreshOptions;
    } catch {}
    return () => {
      window.removeEventListener('focus', refreshOptions);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Fetch areas
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await axios.get("/api/project-areas?limit=999999999");
        const data = response.data.data || response.data;
        if (Array.isArray(data) && data.length > 0) {
          const areaOptionsFromApi = data.map((item: any) => ({
            label: item.title,
            value: item.id,
          }));
          setAreaOptions(areaOptionsFromApi);
        }
      } catch (error: any) {
        console.error("Failed to fetch areas:", error);
        toast.error(error?.response?.data?.message || "Failed to load areas");
      }
    };
    fetchAreas();
  }, []);

  // Auto-generate financial year if not provided
  useEffect(() => {
    if (!formik.values.year && (!project || !project.year)) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      let financialYear;
      if (currentMonth >= 4) {
        financialYear = `${currentYear}-${currentYear + 1}`;
      } else {
        financialYear = `${currentYear - 1}-${currentYear}`;
      }

      formik.setFieldValue("year", financialYear);
    }
  }, [project, formik.values.year]);

  // Track form completion progress
  useEffect(() => {
    const values = formik.values;
    let filled = 0;
    let total = 0;

    // Only count fields that are actually visible and can be filled by the user
    const visibleFields = [
      "name",
      "unique_name",
      "tender_notice_no",
      "project_no",
      "sor_id",
      "department",
      "area",
      "work_type",
      "project_estimation_cost",
      "agreement_no",
      "time_limit",
      "work_order_date",
      "loa_approved_no",
      "loa_approved_date",
      "sd_amount",
      "sd_no",
      "sd_start_date",
      "sd_end_date",
      "project_approved_amount",
      "retention_money_details",
      "retention_money_details_no",
      "retention_money_details_start_date",
      "retention_money_details_end_date",
      "project_end_date",
      "supervisor",
      "officer",
      "remarks",
    ];

    visibleFields.forEach((field) => {
      total++;
      const val = (values as any)[field];
      if (val && val.toString().trim() !== "") {
        filled++;
      }
    });

    total++;
    if (values.locations && values.locations.length > 0) {
      filled++;
    }

    total++;
    const validItems =
      values.projectItems?.filter((item: any) => item && item.capital_sor_id) ||
      [];
    if (validItems.length > 0) {
      filled++;
    }

    // Tender premium
    const tpValFilled =
      values.tender_premium_value &&
      values.tender_premium_value.toString().trim() !== "";
    if (values.tender_premium_id || tpValFilled) {
      total++;
      if (values.tender_premium_id) {
        filled++;
        if (values.tender_premium_id !== "0") {
          total++;
          if (tpValFilled) {
            filled++;
          }
        }
      } else {
        filled++;
      }
    }

    // Negotiation price (optional - only count if filled)
    if (values.negotiation_price_id && values.negotiation_price_id !== "-") {
      total++;
      filled++;
      if (values.negotiation_price_id !== "0") {
        total++;
        if (
          values.negotiation_price_value &&
          values.negotiation_price_value.toString().trim() !== ""
        ) {
          filled++;
        }
      }
    }

    const docTypes = [
      "TENDER_NIT",
      "ESTIMATE",
      "LOA",
      "AGREEMENT",
      "WORK_ORDER",
    ];
    docTypes.forEach((docType) => {
      total++;
      const hasExistingDoc = project?.documents?.some(
        (d) => d.document_type === docType,
      );
      const hasTempDoc = !!tempDocIds[docType];
      if (hasTempDoc || hasExistingDoc) {
        filled++;
      }
    });

    const result = total > 0 ? Math.round((filled / total) * 100) : 0;
    onProgress?.(result);
  }, [formik.values, tempDocIds, project, onProgress]);

  // Ref to track if project number has been generated
  const projectNoGenerated = useRef(false);

  // Auto-calculate project approved amount based on project estimation cost, tender premium, and negotiation price
  useEffect(() => {
    const baseAmount = parseFloat(formik.values.project_estimation_cost) || 0;

    const calcEffect = (
      operation: string | undefined,
      rawValue: number,
      type: string | undefined,
      total: number,
    ): number => {
      if (!operation || operation === "0" || rawValue <= 0) return 0;
      let effectiveValue = rawValue;
      if (type === "Percentage") {
        effectiveValue = (total * rawValue) / 100;
      }
      return operation === "-" ? -effectiveValue : effectiveValue;
    };

    const tpEffect = calcEffect(
      formik.values.tender_premium_id,
      parseFloat(formik.values.tender_premium_value) || 0,
      formik.values.tender_premium_type,
      baseAmount,
    );

    const npEffect = calcEffect(
      formik.values.negotiation_price_id,
      parseFloat(formik.values.negotiation_price_value) || 0,
      formik.values.negotiation_type,
      baseAmount,
    );

    const hasNegotiationPrice =
      formik.values.negotiation_price_id &&
      (formik.values.negotiation_price_id !== "-" ||
       parseFloat(formik.values.negotiation_price_value) > 0);
    const approved = Math.round(hasNegotiationPrice
      ? baseAmount + npEffect
      : baseAmount + tpEffect);
    formik.setFieldValue("project_approved_amount", approved.toString());

    const sdAmount = Math.round((approved * 5) / 100);
    formik.setFieldValue("sd_amount", sdAmount.toString());

    if (approved > 4000000) {
      const retentionAmount = Math.round((approved * 2.5) / 100);
      formik.setFieldValue("retention_money_details", retentionAmount.toString());
    } else {
      formik.setFieldValue("retention_money_details", "0");
    }
  }, [
    formik.values.project_estimation_cost,
    formik.values.tender_premium_id,
    formik.values.tender_premium_value,
    formik.values.tender_premium_type,
    formik.values.negotiation_price_id,
    formik.values.negotiation_price_value,
    formik.values.negotiation_type,
  ]);

  // Auto-calculate Project End Date based on LOA Approved Date, Time Limit, and unit
  useEffect(() => {
    const loaDate = formik.values.loa_approved_date;
    const timeLimit = Math.min(
      parseInt(formik.values.time_limit, 10) || 0,
      1200,
    );
    const unit = formik.values.time_limit_unit;

    if (loaDate && timeLimit > 0) {
      const date = new Date(loaDate);
      if (!isNaN(date.getTime())) {
        if (unit === "Year") {
          date.setFullYear(date.getFullYear() + timeLimit);
        } else {
          date.setMonth(date.getMonth() + timeLimit);
        }
        formik.setFieldValue(
          "project_end_date",
          date.toISOString().split("T")[0],
        );
        return;
      }
    }
    formik.setFieldValue("project_end_date", "");
  }, [
    formik.values.loa_approved_date,
    formik.values.time_limit,
    formik.values.time_limit_unit,
  ]);
  // Auto-generate project number
  useEffect(() => {
    const generateProjectNo = async () => {
      if (projectNoGenerated.current) return;
      if (formik.values.project_no) return;
      if (project?.project_no) return;
      if (!formik.values.year) return;

      const parts = formik.values.year.split("-");
      if (parts.length !== 2) return;

      const shortYear = `${parts[0].slice(-2)}-${parts[1].slice(-2)}`;

      try {
        const response = await axios.get("/api/projects?limit=500");
        const projects = response.data.data || [];

        let lastNumber = 0;
        const pattern = new RegExp(
          `^(\\d+)//${shortYear.replace("-", "\\-")}$`,
        );

        for (const proj of projects) {
          if (proj.project_no) {
            const match = proj.project_no.match(pattern);
            if (match) {
              const num = parseInt(match[1]) || 0;
              if (num > lastNumber) lastNumber = num;
            }
          }
        }

        const nextNumber = String(lastNumber + 1).padStart(2, "0");
        projectNoGenerated.current = true;
        formik.setFieldValue("project_no", `${nextNumber}//${shortYear}`);
      } catch {
        projectNoGenerated.current = true;
        formik.setFieldValue("project_no", `01//${shortYear}`);
      }
    };

    generateProjectNo();
  }, [formik.values.year, project]);

  // Fetch project to refresh documents after upload
  const fetchProject = async (projectId: string) => {
    try {
      const response = await axios.get(`/api/projects/${projectId}`);
      if (response.data.success && response.data.data) {
        // Update the editingProject state in parent
        onProjectUpdate?.(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching project:", error);
    }
  };

  const handleInlineSelectChange =
    (name: string) => (value: string | string[]) => {
      formik.setFieldValue(
        name,
        Array.isArray(value) ? value[0] || "" : value || "",
      );
      // Trigger immediate auto-save for SOR/Department changes so they persist
      // even if the user closes the modal before the 400ms safety net fires
      if (name === 'sor_id' || name === 'department') {
        setTimeout(() => doSaveRef.current?.(), 50);
      }
    };

  const handleLocationsChange = (value: string | string[]) => {
    formik.setFieldValue(
      "locations",
      Array.isArray(value) ? value : value ? [value] : [],
    );
  };

  const handleUpperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    formik.setFieldValue(name, value.toUpperCase());
  };

  const handleWizardInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const upperValue = value.toUpperCase();
    formik.setFieldValue(name, upperValue);
    if (name === "unique_name" && onUniqueNameChange)
      onUniqueNameChange(upperValue);
    if (name === "tender_notice_no" && onTenderNoticeNoChange)
      onTenderNoticeNoChange(upperValue);
    if (name === "name" && onProjectNameChange) onProjectNameChange(upperValue);
  };

  const validateStep = async (step: number): Promise<boolean> => {
    const errors = await formik.validateForm();

    let fieldsToCheck: string[] = [];
    switch (step) {
      case 1:
        fieldsToCheck = [
          "name",
          "unique_name",
          "tender_notice_no",
          "area",
          "work_type",
          "locations",
        ];
        break;
      case 2:
        fieldsToCheck = [
          "project_estimation_cost",
          "tender_premium_id",
          "loa_approved_date",
          "time_limit",
          "agreement_no",
        ];
        break;
      case 3:
        fieldsToCheck = [
          "sd_amount",
          "sd_no",
          "sd_start_date",
          "sd_end_date",
          "retention_money_details_no",
          "retention_money_details_start_date",
          "retention_money_details_end_date",
          "work_order_date",
        ];
        break;
    }

    let hasError = false;
    for (const field of fieldsToCheck) {
      if ((errors as any)[field]) {
        hasError = true;
        formik.setFieldTouched(field, true, true);
      }
    }

    if (step === 3) {
      const requiredDocTypes = [
        "TENDER_NIT",
        "ESTIMATE",
        "LOA",
        "AGREEMENT",
        "WORK_ORDER",
      ];
      requiredDocTypes.forEach((docType) => {
        const hasExistingDoc = project?.documents?.some(
          (d) => d.document_type === docType,
        );
        const hasTempDoc = !!tempDocIds[docType];
        if (!hasExistingDoc && !hasTempDoc) {
          hasError = true;
        }
      });
    }

    return !hasError;
  };

  const buildSubmitPayload = () => {
    const values = formik.values;
    const tempDocIdsList = Object.values(tempDocIds).filter(Boolean);
    const submitData: Record<string, any> = {
      name: values.name,
      unique_name: values.unique_name || undefined,
      tender_notice_no: values.tender_notice_no || undefined,
      work_type: values.work_type || undefined,
      area: values.area || undefined,
      sor_id: values.sor_id || undefined,
      department: values.department || undefined,
      year: values.year || undefined,
      project_no: values.project_no || undefined,
    };
    if (currentStep === 1) {
      submitData.location_ids = values.locations;
    }
    if (currentStep >= 2) {
      submitData.location_ids = values.locations;
      submitData.project_estimation_cost = values.project_estimation_cost
        ? parseFloat(values.project_estimation_cost)
        : undefined;
      submitData.negotiation_price_id =
        mapNegotiationPriceId(values.negotiation_price_id) || undefined;
      submitData.negotiation_price_value = values.negotiation_price_value?.toString() || "0";
      submitData.negotiation_type = values.negotiation_type || undefined;
      submitData.tender_premium_id = values.tender_premium_id || undefined;
      submitData.tender_premium_value = values.tender_premium_value?.toString() || undefined;
      submitData.tender_premium_type = values.tender_premium_type || undefined;
      submitData.project_approved_amount = values.project_approved_amount
        ? parseFloat(values.project_approved_amount)
        : undefined;
      submitData.loa_approved_no = values.loa_approved_no || undefined;
      submitData.loa_approved_date = values.loa_approved_date
        ? new Date(values.loa_approved_date)
        : undefined;
      submitData.project_end_date = values.project_end_date
        ? new Date(values.project_end_date)
        : undefined;
      submitData.time_limit_unit = values.time_limit_unit || undefined;
      submitData.work_order_date = values.work_order_date
        ? new Date(values.work_order_date)
        : undefined;
      submitData.agreement_no = values.agreement_no || undefined;
      submitData.main_item_execution_qty = values.main_item_execution_qty || undefined;
      submitData.work_progress = values.work_progress || undefined;
      submitData.time_limit = values.time_limit?.toString() || undefined;
      submitData.place_of_work = values.place_of_work || undefined;
      submitData.estimate_amount = values.estimate_amount
        ? parseFloat(values.estimate_amount)
        : undefined;
      submitData.tender_amount = values.tender_amount
        ? parseFloat(values.tender_amount)
        : undefined;
      submitData.loa_date = values.loa_date ? new Date(values.loa_date) : undefined;
      submitData.time_limit_end = values.time_limit_end
        ? new Date(values.time_limit_end)
        : undefined;
      submitData.work_completion_date = values.work_completion_date
        ? new Date(values.work_completion_date)
        : undefined;
      submitData.cost_of_completion = values.cost_of_completion
        ? parseFloat(values.cost_of_completion)
        : undefined;
      submitData.time_period = values.time_period || undefined;
      submitData.remark = values.remark || undefined;
      submitData.is_completed = values.status === "COMPLETED";
      submitData.retention_money_details = values.retention_money_details || undefined;
      submitData.retention_money_details_no =
        values.retention_money_details_no || undefined;
      submitData.retention_money_details_start_date =
        values.retention_money_details_start_date
          ? new Date(values.retention_money_details_start_date)
          : undefined;
      submitData.retention_money_details_end_date =
        values.retention_money_details_end_date
          ? new Date(values.retention_money_details_end_date)
          : undefined;
      submitData.sd_amount = values.sd_amount ? parseFloat(values.sd_amount) : undefined;
      submitData.sd_no = values.sd_no || undefined;
      submitData.sd_start_date = values.sd_start_date
        ? new Date(values.sd_start_date)
        : undefined;
      submitData.sd_end_date = values.sd_end_date
        ? new Date(values.sd_end_date)
        : undefined;
      submitData.budget = parseFloat(values.budget) || 0;
      submitData.description = values.description || undefined;
      submitData.start_date = values.start_date
        ? new Date(values.start_date)
        : undefined;
      submitData.end_date = values.end_date ? new Date(values.end_date) : undefined;
      submitData.status = values.status;
      submitData.progress_item_id = progressItemIds[0] || null;
    }
    submitData.supervisor = values.supervisor || undefined;
    submitData.officer = values.officer || undefined;
    submitData.remarks = values.remarks || undefined;
    if (values.projectItems) {
      submitData.project_items = values.projectItems
        .filter((item) => item.capital_sor_id)
        .map((item) => ({
          capital_sor_id: item.capital_sor_id,
          size: item.size || "",
          rate: parseFloat(item.rate) || 0,
          is_price_tracking: progressItemIds.includes(item.capital_sor_id),
        }));
    }
    if (currentStep >= 3) {
      submitData.location_ids = values.locations;
      if (tempDocIdsList.length > 0) {
        submitData.temp_document_ids = tempDocIdsList;
      }
    }
    return submitData;
  };

  const handleSaveNext = async () => {
    const valid = await validateStep(currentStep);
    if (!valid) return;

    const isDraftSave = currentStep < 3;
    const payload = buildSubmitPayload();
    payload.wizard_step = currentStep + 1;

    setIsSubmitting(true);
    isSaveNextRef.current = true;
    try {
      const targetId = project?.id || draftId;
      if (targetId) {
        await axios.put(`/api/projects/${targetId}`, payload);
      } else {
        const response = await axios.post("/api/projects", payload);
        if (response.data.success && response.data.data?.id) {
          setDraftId(response.data.data.id);
          draftIdRef.current = response.data.data.id;
          localStorage.setItem("project-draft-id", response.data.data.id);
        }
      }
      setCurrentStep((prev) => prev + 1);
    } catch (error) {
      toast.error(
        (error as any).response?.data?.message || "Failed to save draft",
      );
    } finally {
      setIsSubmitting(false);
      isSaveNextRef.current = false;
    }
  };

  const isSubmittingRef = useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;
  const draftIdRef = useRef(draftId);
  draftIdRef.current = draftId;
  const isSaveNextRef = useRef(false);
  const progressItemIdsRef = useRef(progressItemIds);
  progressItemIdsRef.current = progressItemIds;

  const doSaveRef = useRef<(() => void) | null>(null);

  doSaveRef.current = () => {
    if (isAutoSavingRef.current || isSubmittingRef.current || isSaveNextRef.current) return;

    const currentValuesStr = JSON.stringify(formik.values);
    if (currentValuesStr === lastSavedValuesRef.current) return;

    const targetId = project?.id || draftIdRef.current;
    const payload = buildSubmitPayload();
    // Don't POST a new project without a name or unique_name — avoids unique constraint violations
    if (!targetId && !payload.name && !payload.unique_name) return;
    payload.wizard_step = currentStepRef.current;

    isAutoSavingRef.current = true;
    const savePromise = targetId
      ? axios.put(`/api/projects/${targetId}`, payload)
      : axios.post("/api/projects", payload).then((response) => {
          if (response.data.success && response.data.data?.id) {
            setDraftId(response.data.data.id);
            draftIdRef.current = response.data.data.id;
            localStorage.setItem("project-draft-id", response.data.data.id);
          }
        });

    savePromise
      .then(() => {
        lastSavedValuesRef.current = currentValuesStr;
      })
      .catch(async (error) => {
        console.error('Auto-save failed:', error);
        toast.error(
          (error as any).response?.data?.message || 'Auto-save failed'
        );
        // If POST fails because a draft with this name already exists (P2002),
        // recover by finding and using the existing draft
        if (!targetId && error?.response?.status === 400 &&
            (error?.response?.data?.message?.toLowerCase().includes('already exists') ||
             error?.response?.data?.message?.toLowerCase().includes('unique constraint'))) {
          try {
            const check = await axios.get('/api/projects?status=DRAFT&limit=1&sortOrder=asc');
            if (check.data.success && check.data.data && check.data.data.length > 0) {
              const existing = check.data.data[0];
              setDraftId(existing.id);
              draftIdRef.current = existing.id;
              localStorage.setItem('project-draft-id', existing.id);
            }
          } catch {}
        }
      })
      .finally(() => {
        isAutoSavingRef.current = false;
      });
  };

  const lastValuesStrRef = useRef(JSON.stringify(formik.values));

  // Blur-based auto-save: triggers immediately when focus leaves a field.
  // Uses setTimeout(0) so portal-based dropdowns (SelectContent rendered outside
  // the form) have time to update formik.values before the save reads them.
  useEffect(() => {
    const formEl = formRef.current;
    if (!formEl) return;

    const handleFocusOut = () => {
      setTimeout(() => {
        doSaveRef.current?.();
      }, 0);
    };

    formEl.addEventListener('focusout', handleFocusOut);
    return () => {
      formEl.removeEventListener('focusout', handleFocusOut);
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []);

  // Value-change safety net: catches saves missed by blur (e.g., programmatic
  // value changes, portal dropdown selections where focusout doesn't reach the form).
  useEffect(() => {
    const currentStr = JSON.stringify(formik.values);
    if (currentStr === lastValuesStrRef.current) return;
    lastValuesStrRef.current = currentStr;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      doSaveRef.current?.();
    }, 400);
  }, [formik.values]);

  const handlePrevious = () => {
    setCurrentStep((prev) => prev - 1);
  };

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-6">
      {/* Wizard Stepper */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${currentStep >= 1 ? "bg-blue-500 text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              1
            </div>
            <span
              className={`text-xs font-medium text-center ${currentStep >= 1 ? "text-blue-500" : "text-muted-foreground"}`}
            >
              Basic Info
            </span>
          </div>
          <div
            className={`flex-1 h-0.5 mx-2 sm:mx-4 -mt-[21px] ${currentStep >= 2 ? "bg-blue-500" : "bg-muted"}`}
          />
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${currentStep >= 2 ? "bg-blue-500 text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              2
            </div>
            <span
              className={`text-xs font-medium text-center ${currentStep >= 2 ? "text-blue-500" : "text-muted-foreground"}`}
            >
              Estimation, LOA & Pricing
            </span>
          </div>
          <div
            className={`flex-1 h-0.5 mx-2 sm:mx-4 -mt-[21px] ${currentStep >= 3 ? "bg-blue-500" : "bg-muted"}`}
          />
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${currentStep >= 3 ? "bg-blue-500 text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              3
            </div>
            <span
              className={`text-xs font-medium text-center ${currentStep >= 3 ? "text-blue-500" : "text-muted-foreground"}`}
            >
              Item Details & Documents
            </span>
          </div>
        </div>
      </div>

      {currentStep === 1 && (
        <div className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="wiz-unique-name">Unique Name *</Label>
              <Input
                id="wiz-unique-name"
                name="unique_name"
                value={formik.values.unique_name || ""}
                onChange={handleWizardInputChange}
                onBlur={formik.handleBlur}
                placeholder="ENTER UNIQUE NAME"
                style={{ textTransform: "uppercase" }}
              />
              {formik.touched.unique_name && formik.errors.unique_name && (
                <p className="text-xs text-red-500">
                  {formik.errors.unique_name}
                </p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="wiz-tender-notice-no">Tender Notice No *</Label>
              <Input
                id="wiz-tender-notice-no"
                name="tender_notice_no"
                value={formik.values.tender_notice_no || ""}
                onChange={handleWizardInputChange}
                onBlur={formik.handleBlur}
                placeholder="ENTER TENDER NOTICE NO"
                disabled={allFieldsDisabled}
                style={{ textTransform: "uppercase" }}
              />
              {formik.touched.tender_notice_no &&
                formik.errors.tender_notice_no && (
                  <p className="text-xs text-red-500">
                    {formik.errors.tender_notice_no}
                  </p>
                )}
            </div>
            
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="wiz-project-name">Project Name *</Label>
              <Input
                id="wiz-project-name"
                name="name"
                value={formik.values.name || ""}
                onChange={handleWizardInputChange}
                onBlur={formik.handleBlur}
                placeholder="ENTER PROJECT NAME"
                disabled={allFieldsDisabled}
                style={{ textTransform: " uppercase" }}
              />
              {formik.touched.name && formik.errors.name && (
                <p className="text-xs text-red-500">{formik.errors.name}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="year">Financial Year (Auto-generated)</Label>
              <Input
                id="year"
                name="year"
                value={formik.values.year}
                readOnly
                disabled={allFieldsDisabled}
                className="bg-gray-50"
                placeholder="Auto-generated based on current date"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="project_no">Project No. (Auto-generated)</Label>
              <Input
                id="project_no"
                name="project_no"
                value={formik.values.project_no}
                readOnly
                disabled={allFieldsDisabled}
                className="bg-gray-50"
                placeholder="Auto-generates on year selection"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="area">Area *</Label>
              <InlineSelect
                value={formik.values.area || ""}
                onChange={handleInlineSelectChange("area")}
                placeholder="SELECT AREA"
                options={areaOptions}
                onAddNew={async (newValue) => {
                  try {
                    const response = await axios.post("/api/project-areas", {
                      name: newValue,
                    });
                    const createdArea = response.data.data || response.data;
                    setAreaOptions((prev: any) => [
                      ...prev,
                      { label: createdArea.title, value: createdArea.id },
                    ]);
                    return { id: createdArea.id, label: createdArea.title };
                  } catch (error: any) {
                    throw new Error(
                      error?.response?.data?.message
                        ? error?.response?.data?.message
                        : "Failed to create area",
                    );
                  }
                }}
              />
              {formik.touched.area && formik.errors.area && (
                <p className="text-xs text-red-500">{formik.errors.area}</p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="work_type">Work Type *</Label>
              <InlineSelect
                value={formik.values.work_type || ""}
                onChange={handleInlineSelectChange("work_type")}
                placeholder="SELECT WORK TYPE"
                options={workTypeOptions}
                onAddNew={async (newValue) => {
                  try {
                    const response = await axios.post(
                      "/api/project-work-types",
                      { name: newValue },
                    );
                    const createdWorkType = response.data.data || response.data;
                    setWorkTypeOptions((prev: any) => [
                      ...prev,
                      {
                        label: createdWorkType.title,
                        value: createdWorkType.id,
                      },
                    ]);
                    return {
                      id: createdWorkType.id,
                      label: createdWorkType.title,
                    };
                  } catch (error: any) {
                    throw new Error(
                      error?.response?.data?.message
                        ? error?.response?.data?.message
                        : "Failed to create work type",
                    );
                  }
                }}
              />
              {formik.touched.work_type && formik.errors.work_type && (
                <p className="text-xs text-red-500">
                  {formik.errors.work_type}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="location">Locations *</Label>
              <InlineSelect
                value={formik.values.locations || []}
                onChange={handleLocationsChange}
                placeholder="SELECT LOCATIONS"
                options={locationOptions}
                onAddNew={async (newValue) => {
                  try {
                    const response = await axios.post("/api/locations", {
                      name: newValue,
                    });
                    const newLocation = response.data.data || response.data;
                    setLocationOptions((prev) => [
                      ...prev,
                      { label: newLocation.name, value: newLocation.id },
                    ]);
                    formik.setFieldValue("locations", [
                      ...(formik.values.locations || []),
                      newLocation.id,
                    ]);
                    return { id: newLocation.id, label: newLocation.name };
                  } catch (error: any) {
                    throw new Error(
                      error?.response?.data?.message ||
                        "Failed to create location",
                    );
                  }
                }}
                multiple
              />
              {formik.touched.locations && formik.errors.locations && (
                <p className="text-xs text-red-500">
                  {formik.errors.locations}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="project_estimation_cost">
                Project Estimation Cost *
              </Label>
              <Input
                id="project_estimation_cost"
                name="project_estimation_cost"
                type="number"
                value={formik.values.project_estimation_cost}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="ENTER ESTIMATION COST"
                disabled={allFieldsDisabled}
                className={
                  formik.touched.project_estimation_cost &&
                  formik.errors.project_estimation_cost
                    ? ""
                    : ""
                }
              />
              {formik.touched.project_estimation_cost &&
                formik.errors.project_estimation_cost && (
                  <p className="text-xs text-red-500">
                    {formik.errors.project_estimation_cost}
                  </p>
                )}
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="tender_premium_id">Tender Premium *</Label>
              <div className="flex">
                <div className="space-y-2 flex-1">
                  <Select
                    value={formik.values.tender_premium_id || "-"}
                    onValueChange={(value) => {
                      formik.setFieldValue("tender_premium_id", value);
                      if (value === "0") {
                        formik.setFieldValue("tender_premium_value", "0");
                      }
                    }}
                    onOpenChange={(open) => {
                      if (!open)
                        formik.setFieldTouched("tender_premium_id", true);
                    }}
                    disabled={allFieldsDisabled}
                  >
                    <SelectTrigger
                      className={
                        formik.touched.tender_premium_id &&
                        formik.errors.tender_premium_id
                          ? "rounded-tr-none rounded-br-none "
                          : "rounded-tr-none rounded-br-none"
                      }
                    >
                      <SelectValue placeholder="Select operation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-">Below (-)</SelectItem>
                      <SelectItem value="+">Above (+)</SelectItem>
                      <SelectItem value="0">Equal (0)</SelectItem>
                    </SelectContent>
                  </Select>
                  {formik.touched.tender_premium_id &&
                    formik.errors.tender_premium_id && (
                      <p className="text-xs text-red-500">
                        {formik.errors.tender_premium_id}
                      </p>
                    )}
                </div>
                <div className="space-y-2 flex-1">
                  <Input
                    name="tender_premium_value"
                    type="number"
                    placeholder="Enter value"
                    value={formik.values.tender_premium_value || ""}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    disabled={
                      allFieldsDisabled ||
                      formik.values.tender_premium_id === "0"
                    }
                    className={
                      formik.touched.tender_premium_value &&
                      formik.errors.tender_premium_value
                        ? " rounded-none border-l-0 border-r-0"
                        : "rounded-none border-l-0 border-r-0"
                    }
                  />
                  {formik.touched.tender_premium_value &&
                    formik.errors.tender_premium_value && (
                      <p className="text-xs text-red-500">
                        {formik.errors.tender_premium_value}
                      </p>
                    )}
                </div>
                <div className="space-y-2 flex-1">
                  <Select
                    value={formik.values.tender_premium_type || "Amount"}
                    onValueChange={(value) =>
                      formik.setFieldValue("tender_premium_type", value)
                    }
                    disabled={allFieldsDisabled}
                  >
                    <SelectTrigger className="rounded-tl-none rounded-bl-none">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Amount">Amount</SelectItem>
                      <SelectItem value="Percentage">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="negotiation_price_id">Negotiation Price</Label>
              <div className="flex w-full">
                <div className="space-y-2 flex-1">
                  <Select
                    value={formik.values.negotiation_price_id || ""}
                    onValueChange={(value) => {
                      formik.setFieldValue("negotiation_price_id", value);
                      if (value === "0") {
                        formik.setFieldValue("negotiation_price_value", "0");
                      }
                    }}
                    onOpenChange={(open) => {
                      if (!open)
                        formik.setFieldTouched("negotiation_price_id", true);
                    }}
                    disabled={allFieldsDisabled}
                  >
                    <SelectTrigger
                      className={
                        formik.touched.negotiation_price_id &&
                        formik.errors.negotiation_price_id
                          ? " rounded-tr-none rounded-br-none"
                          : "rounded-tr-none rounded-br-none"
                      }
                    >
                      <SelectValue placeholder="Select operation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-">Below (-)</SelectItem>
                      <SelectItem value="+">Above (+)</SelectItem>
                      <SelectItem value="0">Equal (0)</SelectItem>
                    </SelectContent>
                  </Select>
                  {formik.touched.negotiation_price_id &&
                    formik.errors.negotiation_price_id && (
                      <p className="text-xs text-red-500">
                        {formik.errors.negotiation_price_id}
                      </p>
                    )}
                </div>
                <div className="space-y-2 flex-1">
                  {formik.values.negotiation_price_id && (
                    <Input
                      name="negotiation_price_value"
                      type="number"
                      placeholder="Enter value"
                      value={formik.values.negotiation_price_value || ""}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    disabled={allFieldsDisabled}
                      className={
                        formik.touched.negotiation_price_value &&
                        formik.errors.negotiation_price_value
                          ? " rounded-none border-l-0"
                          : " rounded-none border-l-0"
                      }
                    />
                  )}
                </div>
                <div className="space-y-2 flex-1">
                  {formik.values.negotiation_price_id && (
                    <Select
                      value={formik.values.negotiation_type || "Amount"}
                      onValueChange={(value) =>
                        formik.setFieldValue("negotiation_type", value)
                      }
                    disabled={allFieldsDisabled}
                    >
                      <SelectTrigger className="rounded-tl-none rounded-bl-none">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Amount">Amount</SelectItem>
                        <SelectItem value="Percentage">Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 relative">
              <Label htmlFor="project_approved_amount">
                Project Approved Amount
              </Label>
              <Input
                id="project_approved_amount"
                name="project_approved_amount"
                type="number"
                value={formik.values.project_approved_amount}
                readOnly
                disabled={allFieldsDisabled}
                className="bg-gray-50"
                placeholder="AUTO-CALCULATED BASED ON TENDER PREMIUM AND NEGOTIATION PRICE"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="agreement_no">Agreement No *</Label>
              <Input
                id="agreement_no"
                name="agreement_no"
                value={formik.values.agreement_no || ""}
                onChange={handleUpperChange}
                onBlur={formik.handleBlur}
                placeholder="Enter agreement number"
                disabled={allFieldsDisabled}
                className={
                  formik.touched.agreement_no && formik.errors.agreement_no
                    ? ""
                    : ""
                }
                style={{ textTransform: "uppercase" }}
              />
              {formik.touched.agreement_no && formik.errors.agreement_no && (
                <p className="text-xs text-red-500">
                  {formik.errors.agreement_no}
                </p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="loa_approved_no">LOA Approved No.</Label>
              <Input
                id="loa_approved_no"
                name="loa_approved_no"
                value={formik.values.loa_approved_no || ""}
                onChange={handleUpperChange}
                onBlur={formik.handleBlur}
                placeholder="Enter LOA approved number"
                disabled={allFieldsDisabled}
                className={
                  formik.touched.loa_approved_no &&
                  formik.errors.loa_approved_no
                    ? ""
                    : ""
                }
                style={{ textTransform: "uppercase" }}
              />
              {formik.touched.loa_approved_no &&
                formik.errors.loa_approved_no && (
                  <p className="text-xs text-red-500">
                    {formik.errors.loa_approved_no}
                  </p>
                )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="loa_approved_date">LOA Approved Date</Label>
              <Input
                id="loa_approved_date"
                name="loa_approved_date"
                type="date"
                value={formik.values.loa_approved_date || ""}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={allFieldsDisabled}
                className={
                  formik.touched.loa_approved_date &&
                  formik.errors.loa_approved_date
                    ? ""
                    : ""
                }
              />
              {formik.touched.loa_approved_date &&
                formik.errors.loa_approved_date && (
                  <p className="text-xs text-red-500">
                    {formik.errors.loa_approved_date}
                  </p>
                )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="time_limit">Time Limit *</Label>
              <div className="flex">
                <Input
                  id="time_limit"
                  name="time_limit"
                  type="number"
                  min="1"
                  max="1200"
                  value={formik.values.time_limit || ""}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Enter value"
                  disabled={allFieldsDisabled}
                  className={`flex-1 rounded-tr-none rounded-br-none ${formik.touched.time_limit && formik.errors.time_limit ? "" : ""}`}
                />
                <Select
                  value={formik.values.time_limit_unit || "Month"}
                  onValueChange={(value) =>
                    formik.setFieldValue("time_limit_unit", value)
                  }
                  disabled={allFieldsDisabled}
                >
                  <SelectTrigger className="w-28 border-l-0 rounded-tl-none rounded-bl-none">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Month">Month</SelectItem>
                    <SelectItem value="Year">Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formik.touched.time_limit && formik.errors.time_limit && (
                <p className="text-xs text-red-500">
                  {formik.errors.time_limit}
                </p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="project_end_date">Project End Date <span className="text-red-500">(as per LOA)</span></Label>
              <Input
                id="project_end_date"
                name="project_end_date"
                type="date"
                value={formik.values.project_end_date || ""}
                readOnly
                disabled={allFieldsDisabled}
                className="bg-gray-50"
              />
            </div>

          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label>SOR *</Label>
              <InlineSelect
                value={formik.values.sor_id || ""}
                onChange={handleInlineSelectChange("sor_id")}
                placeholder="SELECT SOR"
                options={sorOptions}
                disabled={allFieldsDisabled}
                onAddNew={async (newValue) => {
                  try {
                    const response = await axios.post("/api/sor-items", {
                      name: newValue,
                    });
                    const created = response.data.data || response.data;
                    // Clear items when SOR changes via "Add New"
                    formik.setFieldValue("projectItems", []);
                    setSorOptions((prev: any) => [
                      ...prev,
                      { label: created.name, value: created.id },
                    ]);
                    return { id: created.id, label: created.name };
                  } catch (error: any) {
                    throw new Error(
                      error?.response?.data?.message ||
                        "Failed to create SOR item",
                    );
                  }
                }}
                className={
                  formik.touched.sor_id && formik.errors.sor_id ? "" : ""
                }
              />
              {formik.touched.sor_id && formik.errors.sor_id && (
                <p className="text-xs text-red-500">{formik.errors.sor_id}</p>
              )}
            </div>
            <div className="space-y-2 relative ">
              <Label>Department *</Label>
              <InlineSelect
                value={formik.values.department || ""}
                onChange={handleInlineSelectChange("department")}
                placeholder="SELECT DEPARTMENT"
                options={departmentOptions}
                disabled={allFieldsDisabled}
                onAddNew={async (newValue) => {
                  try {
                    const response = await axios.post("/api/departments", {
                      name: newValue,
                    });
                    const created = response.data.data || response.data;
                    // Clear items when Department changes via "Add New"
                    formik.setFieldValue("projectItems", []);
                    setDepartmentOptions((prev: any) => [
                      ...prev,
                      { label: created.name, value: created.id },
                    ]);
                    return { id: created.id, label: created.name };
                  } catch (error: any) {
                    throw new Error(
                      error?.response?.data?.message ||
                        "Failed to create Department",
                    );
                  }
                }}
                className={
                  formik.touched.department && formik.errors.department
                    ? ""
                    : ""
                }
              />
              {formik.touched.department && formik.errors.department && (
                <p className="text-xs text-red-500">
                  {formik.errors.department}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <ProjectItemDetails
              values={formik.values.projectItems || []}
              setFieldValue={(name, value) => formik.setFieldValue(name, value)}
              errors={formik.errors.projectItems as string | undefined}
              touched={formik.touched.projectItems as boolean | undefined}
              selectedProgressItemIds={progressItemIds}
              onProgressItemIdsChange={(ids) => setProgressItemIds(ids)}
              sor_id={formik.values.sor_id}
              department_id={formik.values.department}
              disabled={allFieldsDisabled}
              asOfDate={(project as any)?.createdAt || null}
              projectStatus={project?.status || null}
              purchaseEntryCount={(project as any)?.purchaseEntryCount ?? 0}
              initialProgressItemIds={initialProgressItemIds}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="space-y-2 relative">
              <Label htmlFor="sd_no">SD No</Label>
              <Input
                id="sd_no"
                name="sd_no"
                value={formik.values.sd_no || ""}
                onChange={handleUpperChange}
                onBlur={formik.handleBlur}
                placeholder="Enter SD number"
                disabled={allFieldsDisabled}
                className={
                  formik.touched.sd_no && formik.errors.sd_no ? "" : ""
                }
                style={{ textTransform: "uppercase" }}
              />
              {formik.touched.sd_no && formik.errors.sd_no && (
                <p className="text-xs text-red-500">{formik.errors.sd_no}</p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="sd_amount">SD Amount</Label>
              <Input
                id="sd_amount"
                name="sd_amount"
                type="number"
                value={formik.values.sd_amount || ""}
                readOnly
                disabled={allFieldsDisabled}
                className="bg-gray-50"
                placeholder="AUTO-CALCULATED (5% OF APPROVED AMOUNT)"
              />
              {formik.touched.sd_amount && formik.errors.sd_amount && (
                <p className="text-xs text-red-500">
                  {formik.errors.sd_amount}
                </p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="sd_start_date">SD Start Date</Label>
              <Input
                id="sd_start_date"
                name="sd_start_date"
                type="date"
                value={formik.values.sd_start_date || ""}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={allFieldsDisabled}
                className={
                  formik.touched.sd_start_date && formik.errors.sd_start_date
                    ? ""
                    : ""
                }
              />
              {formik.touched.sd_start_date && formik.errors.sd_start_date && (
                <p className="text-xs text-red-500">
                  {formik.errors.sd_start_date}
                </p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="sd_end_date">SD End Date</Label>
              <Input
                id="sd_end_date"
                name="sd_end_date"
                type="date"
                value={formik.values.sd_end_date || ""}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={allFieldsDisabled || !formik.values.sd_start_date}
                min={
                  formik.values.sd_start_date
                    ? new Date(new Date(formik.values.sd_start_date).getTime() + 86400000).toISOString().split("T")[0]
                    : undefined
                }
                className={
                  formik.touched.sd_end_date && formik.errors.sd_end_date
                    ? ""
                    : ""
                }
              />
              {formik.touched.sd_end_date && formik.errors.sd_end_date && (
                <p className="text-xs text-red-500">
                  {formik.errors.sd_end_date}
                </p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="retention_money_details_no">
                Retention Money Details No
              </Label>
              <Input
                id="retention_money_details_no"
                name="retention_money_details_no"
                value={formik.values.retention_money_details_no || ""}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Enter retention money details no"
                disabled={allFieldsDisabled}
              />
              {formik.touched.retention_money_details_no && formik.errors.retention_money_details_no && (
                <p className="text-xs text-red-500">{formik.errors.retention_money_details_no}</p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="retention_money_details">
                Retention Money Details Amount
              </Label>
              <Input
                id="retention_money_details"
                name="retention_money_details"
                value={formik.values.retention_money_details || ""}
                readOnly
                disabled={allFieldsDisabled}
                className="bg-gray-50"
                placeholder="AUTO-CALCULATED (2.5% OF APPROVED AMOUNT)"
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="retention_money_details_start_date">
                Retention Money Details Start Date
              </Label>
              <Input
                id="retention_money_details_start_date"
                name="retention_money_details_start_date"
                type="date"
                value={formik.values.retention_money_details_start_date || ""}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={allFieldsDisabled}
              />
              {formik.touched.retention_money_details_start_date && formik.errors.retention_money_details_start_date && (
                <p className="text-xs text-red-500">{formik.errors.retention_money_details_start_date}</p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="retention_money_details_end_date">
                Retention Money Details End Date
              </Label>
              <Input
                id="retention_money_details_end_date"
                name="retention_money_details_end_date"
                type="date"
                value={formik.values.retention_money_details_end_date || ""}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={allFieldsDisabled || !formik.values.retention_money_details_start_date}
                min={
                  formik.values.retention_money_details_start_date
                    ? new Date(new Date(formik.values.retention_money_details_start_date).getTime() + 86400000).toISOString().split("T")[0]
                    : undefined
                }
              />
              {formik.touched.retention_money_details_end_date && formik.errors.retention_money_details_end_date && (
                <p className="text-xs text-red-500">{formik.errors.retention_money_details_end_date}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="space-y-2 relative ">
              <Label htmlFor="work_order_date">Work Order Date</Label>
              <Input
                id="work_order_date"
                name="work_order_date"
                type="date"
                value={formik.values.work_order_date || ""}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={allFieldsDisabled}
                className={
                  formik.touched.work_order_date &&
                  formik.errors.work_order_date
                    ? ""
                    : ""
                }
              />
              {formik.touched.work_order_date &&
                formik.errors.work_order_date && (
                  <p className="text-xs text-red-500">
                    {formik.errors.work_order_date}
                  </p>
                )}
            </div>
            <div className="space-y-2 relative">
              <Label>
                Supervisor
              </Label>
              <Input
                name="supervisor"
                value={formik.values.supervisor}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Enter supervisor name"
                disabled={allFieldsDisabled}
              />
            </div>
            <div className="space-y-2 relative">
              <Label>
                Officer
              </Label>
              <Input
                name="officer"
                value={formik.values.officer}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Enter officer name"
                disabled={allFieldsDisabled}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mt-6">
          <div className="space-y-2 relative">
              <Label>
                Remarks
              </Label>
              <textarea
                name="remarks"
                value={formik.values.remarks}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Enter remarks"
                disabled={allFieldsDisabled}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 !text-[11px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-sm font-medium text-muted-foreground">
                Tender Documents (PDF Upload) *
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <ProjectDocumentUpload
                key={`tender-nit-${effectiveProjectId || "new"}`}
                projectId={effectiveProjectId}
                documentType="TENDER_NIT"
                label="Tender NIT"
                error={(formik.errors as any)["doc_TENDER_NIT"]}
                currentFiles={
                  project?.documents?.filter(
                    (d) => d.document_type === "TENDER_NIT",
                  ) || []
                }
                onSuccess={() => {
                  if (project?.id) fetchProject(project.id);
                }}
                onTempDocUploaded={(_documentType, tempDocId) =>
                  handleTempDocUploaded("TENDER_NIT", tempDocId)
                }
                tempDocId={tempDocIds["TENDER_NIT"]}
                disabled={allFieldsDisabled}
              />
              <ProjectDocumentUpload
                key={`estimate-${effectiveProjectId || "new"}`}
                projectId={effectiveProjectId}
                documentType="ESTIMATE"
                label="Estimate"
                error={(formik.errors as any)["doc_ESTIMATE"]}
                currentFiles={
                  project?.documents?.filter(
                    (d) => d.document_type === "ESTIMATE",
                  ) || []
                }
                onSuccess={() => {
                  if (project?.id) fetchProject(project.id);
                }}
                onTempDocUploaded={(_documentType, tempDocId) =>
                  handleTempDocUploaded("ESTIMATE", tempDocId)
                }
                tempDocId={tempDocIds["ESTIMATE"]}
                disabled={allFieldsDisabled}
              />
              <ProjectDocumentUpload
                key={`loa-${effectiveProjectId || "new"}`}
                projectId={effectiveProjectId}
                documentType="LOA"
                label="LOA"
                error={(formik.errors as any)["doc_LOA"]}
                currentFiles={
                  project?.documents?.filter(
                    (d) => d.document_type === "LOA",
                  ) || []
                }
                onSuccess={() => {
                  if (project?.id) fetchProject(project.id);
                }}
                onTempDocUploaded={(_documentType, tempDocId) =>
                  handleTempDocUploaded("LOA", tempDocId)
                }
                tempDocId={tempDocIds["LOA"]}
                disabled={allFieldsDisabled}
              />
              <ProjectDocumentUpload
                key={`agreement-${effectiveProjectId || "new"}`}
                projectId={effectiveProjectId}
                documentType="AGREEMENT"
                label="Agreement"
                error={(formik.errors as any)["doc_AGREEMENT"]}
                currentFiles={
                  project?.documents?.filter(
                    (d) => d.document_type === "AGREEMENT",
                  ) || []
                }
                onSuccess={() => {
                  if (project?.id) fetchProject(project.id);
                }}
                onTempDocUploaded={(_documentType, tempDocId) =>
                  handleTempDocUploaded("AGREEMENT", tempDocId)
                }
                tempDocId={tempDocIds["AGREEMENT"]}
                disabled={allFieldsDisabled}
              />
              <ProjectDocumentUpload
                key={`work-order-${effectiveProjectId || "new"}`}
                projectId={effectiveProjectId}
                documentType="WORK_ORDER"
                label="Work Order"
                error={(formik.errors as any)["doc_WORK_ORDER"]}
                currentFiles={
                  project?.documents?.filter(
                    (d) => d.document_type === "WORK_ORDER",
                  ) || []
                }
                onSuccess={() => {
                  if (project?.id) fetchProject(project.id);
                }}
                onTempDocUploaded={(_documentType, tempDocId) =>
                  handleTempDocUploaded("WORK_ORDER", tempDocId)
                }
                tempDocId={tempDocIds["WORK_ORDER"]}
                disabled={allFieldsDisabled}
              />
            </div>
          </div>

          {(formik.values.projectItems || []).length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b mb-3">
                Totals Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Project Approved Amount
                  </p>
                  <p className="text-xl font-bold text-primary">
                    ₹
                    {(
                      parseFloat(formik.values.project_approved_amount) ||
                      0
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
                {(() => {
                  const checkedItem = (
                    formik.values.projectItems || []
                  ).find(
                    (item: any) =>
                      item.capital_sor_id ===
                      (progressItemIds[0] || null),
                  );
                  return checkedItem ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Checked Item Name
                      </p>
                      <p className="text-xl font-bold text-primary break-words">
                        {checkedItem.capitalSOR?.item_name || 'N/A'}
                      </p>
                    </div>
                  ) : null;
                })()}
                {(() => {
                  const checkedItem = (
                    formik.values.projectItems || []
                  ).find(
                    (item: any) =>
                      item.capital_sor_id ===
                      (progressItemIds[0] || null),
                  );
                  const checkedItemQty = checkedItem
                    ? parseFloat(checkedItem.size) || 0
                    : 0;
                  const sqm = checkedItemQty;
                  const brs = sqm / 9.29;
                  return sqm > 0 ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          SQM
                        </p>
                        <p className="text-xl font-bold text-primary">
                          {sqm.toLocaleString("en-IN", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 10,
                          })}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          BRS (SQM ÷ 9.29)
                        </p>
                        <p className="text-xl font-bold text-primary">
                          {brs.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </>
                  ) : null;
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          {currentStep > 1 && (
            <Button type="button" variant="outline" onClick={handlePrevious}>
              Previous
            </Button>
          )}
          {currentStep < 3 ? (
            <Button type="button" onClick={handleSaveNext} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save & Next
            </Button>
          ) : (
            <Button
              type="button"
              disabled={isSubmitting || allFieldsDisabled}
              onClick={() => formik.submitForm()}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Project
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
