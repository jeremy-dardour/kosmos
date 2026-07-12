import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useGetItems,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} from '@/api/hooks/use-items';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { ItemFormDialog } from './item-form-dialog';

interface ItemData {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
}

export function ItemsPage() {
  const { t } = useTranslation();
  const { data: items, isLoading } = useGetItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ItemData | null>(null);

  const handleCreate = (data: { name: string; description?: string }) => {
    createItem.mutate(
      { body: data },
      { onSuccess: () => setCreateOpen(false) },
    );
  };

  const handleUpdate = (data: { name: string; description?: string }) => {
    if (!editItem) return;
    updateItem.mutate(
      { params: { path: { id: editItem.id } }, body: data },
      { onSuccess: () => setEditItem(null) },
    );
  };

  const handleDelete = (id: string) => {
    if (!globalThis.confirm(t('items.confirmDelete'))) return;
    deleteItem.mutate({ params: { path: { id } } });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('items.title')}</h1>
        <Button onClick={() => setCreateOpen(true)}>{t('items.create')}</Button>
      </div>

      {isLoading ? (
        <p>Loading...</p>
      ) : items?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('items.table.header.name')}</TableHead>
              <TableHead>{t('items.table.header.description')}</TableHead>
              <TableHead>{t('items.table.header.createdAt')}</TableHead>
              <TableHead className="w-[120px]">
                {t('items.table.header.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items as ItemData[]).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.description ?? '—'}</TableCell>
                <TableCell>
                  {new Date(item.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditItem(item)}
                    >
                      {t('items.edit')}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                    >
                      {t('items.delete')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground">{t('items.table.noData')}</p>
      )}

      <ItemFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        title={t('items.create')}
        isLoading={createItem.isPending}
      />

      {editItem && (
        <ItemFormDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditItem(null);
          }}
          onSubmit={handleUpdate}
          title={t('items.edit')}
          defaultValues={editItem}
          isLoading={updateItem.isPending}
        />
      )}
    </div>
  );
}
