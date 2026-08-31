"use client";

import { useState, useEffect, useMemo } from "react";
import { Formik, Form, Field, ErrorMessage, useFormikContext } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import axios from "axios";
import { DataTable, Column } from "@/components/common/DataTable";
import { FormModal } from "@/components/common/FormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

function ProgressTracker({ onProgress }: { onProgress: (v: number) => void }) {
  const { values } = useFormikContext<{ name: string }>();
  const progress = useMemo(() => {
    let filled = 0;
    let total = 0;
    total++;
    if (values.name && values.name.toString().trim() !== "") filled++;
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  }, [values.name]);

  useEffect(() => {
    onProgress(progress);
  }, [progress, onProgress]);

  return null;
}

interface WorkType {
  id: string;
  name: string;
  is_active: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WorkTypeFormData {
  name: string;
  is_active: boolean;
}

const validationSchema = Yup.object().shape({
  name: Yup.string().required("Name is required").max(100),
  is_active: Yup.boolean().optional(),
});

export function WorkTypeClient() {
  const [data, setData] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkType | null>(null);

  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);
  const [sortField, setSortField] = useState<string | null>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [deleteItem, setDeleteItem] = useState<WorkType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
  });

  const fetchData = async (
    page = 1,
    searchValue = search,
    pageLimit = limit,
    sort = sortField,
    order = sortOrder,
  ) => {
    try {
      setLoading(true);

      const response = await axios.get("/api/work-type", {
        params: {
          page,
          limit: pageLimit,
          search: searchValue,
          sortField: sort,
          sortOrder: order,
        },
      });

      setData(response.data.data);

      setPagination({
        page: response.data.pagination.page,
        totalPages: response.data.pagination.pages,
      });
    } catch {
      toast.error("Failed to fetch work types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchData(1);
  }, [search, limit, sortField, sortOrder]);

  const handleSubmit = async (
    values: WorkTypeFormData,
    { resetForm }: { resetForm: () => void },
  ) => {
    try {
      if (editingItem) {
        await axios.put(`/api/work-type/${editingItem.id}`, values);
        toast.success("Work type updated successfully");
      } else {
        await axios.post("/api/work-type", values);
        toast.success("Work type created successfully");
      }

      setModalOpen(false);
      setEditingItem(null);
      resetForm();
      fetchData(pagination.page);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to save work type");
    }
  };

  const handleEdit = (item: WorkType) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = (item: WorkType) => {
    setDeleteItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;

    try {
      setDeleteLoading(true);

      await axios.delete(`/api/work-type/${deleteItem.id}`);

      toast.success("Work type deleted successfully");

      fetchData(pagination.page);
      setDeleteItem(null);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to delete work type");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setProgress(0);
    setModalOpen(true);
  };

  const columns: Column<WorkType>[] = [
    {
      header: "Name",
      accessorKey: "name",
      sortable: true,
    },
    {
      header: "Created At",
      accessorKey: "createdAt",
      sortable: true,
      cell: (item) =>
        new Date(item.createdAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
    },
  ];

  return (
    <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Work Type
          </h2>
        </div>
      </div>

      <DataTable
        data={data}
        columns={columns}
        loading={loading}
        pagination={pagination}
        onPageChange={(page) => fetchData(page)}
        onSearch={(value) => setSearch(value)}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
        }}
        onSortChange={(field, order) => {
          setSortField(field);
          setSortOrder(order);
        }}
        searchPlaceholder="Search by name..."
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        addLabel="Add"
      />
      <FormModal
        title={editingItem ? "Edit Work Type" : "Add Work Type"}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
          setProgress(0);
        }}
        loading={loading}
        progress={progress}
      >
        <Formik
          initialValues={{
            name: editingItem?.name || "",
            is_active: editingItem?.is_active ?? true,
          }}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ isSubmitting }) => (
            <>
              <ProgressTracker onProgress={setProgress} />
              <Form className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2 relative">
                    <Label>Name *</Label>
                    <Field as={Input}
                      name="name"
                      placeholder="Enter work type name"
                    />
                    <ErrorMessage
                      name="name"
                      component="div"
                      className="text-red-500 text-sm"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingItem
                      ? "Update"
                      : "Create"}
                </Button>
              </Form>
            </>
          )}
        </Formik>
      </FormModal>
      <Dialog
        open={!!deleteItem}
        onOpenChange={(open) => {
          if (!open) setDeleteItem(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>

          <DialogDescription className="py-4">
            Are you sure you want to delete <strong>{deleteItem?.name}</strong>?
          </DialogDescription>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
