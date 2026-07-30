import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { ReactNode } from 'react';

interface FormDialogProperties {
  title: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Fired on form submit (default already prevented). */
  onSubmit: () => void;
  isValid: boolean;
  isPending: boolean;
  submitLabel: string;
  pendingLabel: string;
  cancelLabel: string;
  children: ReactNode;
}

/**
 * Shared shell for the single-form management dialogs (workstream, project):
 * dialog chrome, a vertical field stack, and a Cancel/Save footer whose submit
 * button reflects validity and pending state. Callers supply only the fields.
 */
export const FormDialog = ({
  title,
  isOpen,
  onOpenChange,
  onSubmit,
  isValid,
  isPending,
  submitLabel,
  pendingLabel,
  cancelLabel,
  children,
}: FormDialogProperties) => (
  <Dialog open={isOpen} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>
            {cancelLabel}
          </DialogClose>
          <Button type="submit" size="sm" disabled={!isValid || isPending}>
            {isPending ? pendingLabel : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
);
