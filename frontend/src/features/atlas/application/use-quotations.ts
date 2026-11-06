import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { ManufacturerOption, Quotation, QuotationDetail, QuotationFields } from '../domain/quotation';
import { atlasKeys } from './atlas.keys';
import { useQuotationsGateway } from './quotations-gateway-context';

/** Every manufacturer to choose from, asked for once the form opens. */
export function useManufacturerOptions(enabled: boolean) {
  const gateway = useQuotationsGateway();
  return useQuery<ManufacturerOption[], AppError>({
    queryKey: atlasKeys.manufacturerList(),
    queryFn: () => gateway.manufacturers(),
    enabled,
    staleTime: 60_000,
  });
}

/** Suspends until the list arrives: Quotation Changes' tabs (ADR 0013). */
export function useQuotationList(state: 'waiting' | 'decided') {
  const gateway = useQuotationsGateway();
  return useSuspenseQuery<Quotation[], AppError>({
    queryKey: atlasKeys.quotationList(state, null),
    queryFn: () => gateway.list(state),
  });
}

/** One Spec ID's waiting quotations, on its manufacturers screen. It never suspends: the screen draws without them. */
export function useSpecIdQuotations(specId: string) {
  const gateway = useQuotationsGateway();
  return useQuery<Quotation[], AppError>({
    queryKey: atlasKeys.quotationList('waiting', specId),
    queryFn: () => gateway.list('waiting', specId),
  });
}

/** One quotation's trail, asked for only once opened. */
export function useQuotation(id: string, enabled: boolean) {
  const gateway = useQuotationsGateway();
  return useQuery<QuotationDetail, AppError>({
    queryKey: atlasKeys.quotation(id),
    queryFn: () => gateway.get(id),
    enabled,
  });
}

/** How many waiting quotations an admin may decide, for the sidebar's badge. Asked only for an admin; never suspends. */
export function useQuotationWaitingCount(isAdmin: boolean) {
  const gateway = useQuotationsGateway();
  return useQuery<number, AppError>({
    queryKey: atlasKeys.quotationWaitingCount(),
    queryFn: () => gateway.waitingCount(),
    enabled: isAdmin,
    staleTime: 30_000,
  });
}

/** Adds a quotation, or, given `editing`, replaces one from the version read. Only the quotations change. */
export function useSendQuotation() {
  const gateway = useQuotationsGateway();
  const queryClient = useQueryClient();
  return useMutation<Quotation, AppError, { specId: string; fields: QuotationFields; editing: Quotation | null }>({
    mutationFn: ({ specId, fields, editing }) =>
      editing === null ? gateway.add(specId, fields) : gateway.edit(editing.id, fields, editing.version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasKeys.quotations() }),
  });
}

/**
 * Admins only: approves the version read. Its quote joins the Spec ID's, and a
 * new manufacturer may join the list, so everything Atlas holds is asked for again.
 */
export function useApproveQuotation() {
  const gateway = useQuotationsGateway();
  const queryClient = useQueryClient();
  return useMutation<Quotation, AppError, { id: string; version: number }>({
    mutationFn: ({ id, version }) => gateway.approve(id, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasKeys.all }),
  });
}

/** Admins only: rejects with a reason. Only the quotations change. */
export function useRejectQuotation() {
  const gateway = useQuotationsGateway();
  const queryClient = useQueryClient();
  return useMutation<Quotation, AppError, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => gateway.reject(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasKeys.quotations() }),
  });
}

/** Whoever added it takes back a waiting quotation. Only the quotations change. */
export function useWithdrawQuotation() {
  const gateway = useQuotationsGateway();
  const queryClient = useQueryClient();
  return useMutation<Quotation, AppError, { id: string }>({
    mutationFn: ({ id }) => gateway.withdraw(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasKeys.quotations() }),
  });
}
