import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';

export function useGetItems() {
  return $api.useQuery('get', '/api/items');
}

export function useGetItem(id: string) {
  return $api.useQuery('get', '/api/items/{id}', {
    params: { path: { id } },
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return $api.useMutation('post', '/api/items', {
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['get', '/api/items'],
      });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return $api.useMutation('patch', '/api/items/{id}', {
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['get', '/api/items'],
      });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return $api.useMutation('delete', '/api/items/{id}', {
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['get', '/api/items'],
      });
    },
  });
}
