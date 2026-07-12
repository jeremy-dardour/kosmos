import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: { name: string; description?: string }) => void;
  title: string;
  defaultValues?: { name: string; description?: string | null };
  isLoading?: boolean;
}

export function ItemFormDialog({
  open,
  onOpenChange,
  onSubmit,
  title,
  defaultValues,
  isLoading,
}: ItemFormDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [description, setDescription] = useState(
    defaultValues?.description ?? '',
  );

  const handleSubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({ name, description: description ?? undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('items.form.name')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('items.form.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('items.form.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={(isLoading ?? false) || !name.trim()}
            >
              {t('items.form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
