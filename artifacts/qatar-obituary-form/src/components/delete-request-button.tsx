// زر حذف طلب مع نافذة تأكيد. يُستعمل في قائمة الطلبات وصفحة تفاصيل الطلب.
import { useState, type MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDeleteRequest, useRequestKeys } from "@/lib/requests-api";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// الزر داخل بطاقة هي رابط: لا ننتقل لصفحة الطلب عند الضغط على الزر أو داخل النافذة.
const isolate = (event: MouseEvent) => {
  event.stopPropagation();
};

export function DeleteRequestButton({
  requestNumber,
  label,
  onDeleted,
  iconOnly = false,
  className,
}: {
  requestNumber: string;
  /** اسم المتوفى للعرض في نص التأكيد. */
  label: string;
  onDeleted?: () => void;
  iconOnly?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const remove = useDeleteRequest();
  const keys = useRequestKeys();

  const confirm = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    remove.mutate(
      { requestNumber },
      {
        onSuccess: () => {
          queryClient.removeQueries({ queryKey: keys.get(requestNumber) });
          void queryClient.invalidateQueries({ queryKey: keys.list() });
          toast.success("تم حذف الطلب");
          setOpen(false);
          onDeleted?.();
        },
        onError: () => toast.error("تعذر حذف الطلب، حاول مرة أخرى"),
      },
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!remove.isPending) setOpen(next); }}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={iconOnly ? "icon" : "sm"}
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}
          className={`gap-1.5 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive ${className ?? ""}`}
          aria-label={`حذف الطلب ${requestNumber}`}
        >
          <Trash2 className="h-4 w-4" />
          {!iconOnly && "حذف"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl" onClick={isolate}>
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle>حذف الطلب؟</AlertDialogTitle>
          <AlertDialogDescription className="leading-7">
            سيُحذف الطلب <span className="font-mono font-semibold text-foreground">{requestNumber}</span>
            {label ? <> ({label})</> : null} ولا يمكن التراجع عن ذلك.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:flex-row sm:justify-start">
          <Button type="button" variant="destructive" onClick={confirm} disabled={remove.isPending} className="gap-1.5">
            {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            نعم، احذف الطلب
          </Button>
          <AlertDialogCancel disabled={remove.isPending} className="mt-0">إلغاء</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
