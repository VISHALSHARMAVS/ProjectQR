import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

export function useOrderSocket(
  enabled = true,
  onNewOrder?: () => void,
  onServiceRequest?: (req: unknown) => void,
  onTableVacated?: (payload: unknown) => void
) {
  const queryClient = useQueryClient();
  const onNewOrderRef = useRef(onNewOrder);
  const onServiceRequestRef = useRef(onServiceRequest);
  const onTableVacatedRef = useRef(onTableVacated);
  useEffect(() => { onNewOrderRef.current = onNewOrder; }, [onNewOrder]);
  useEffect(() => { onServiceRequestRef.current = onServiceRequest; }, [onServiceRequest]);
  useEffect(() => { onTableVacatedRef.current = onTableVacated; }, [onTableVacated]);
  useEffect(() => {
    if (!enabled) return;
    const socket = io({ withCredentials: true, reconnection: true, reconnectionAttempts: Infinity });
    const sync = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['customer-session'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-order'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['table-cart'] });
      void queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['service-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['floor-map'] });
    };
    socket.on('connect', sync);
    socket.on('order:new', () => {
      onNewOrderRef.current?.();
      sync();
    });
    socket.on('table-cart:updated', () => {
      void queryClient.invalidateQueries({ queryKey: ['table-cart'] });
    });
    socket.on('service-request:new', (payload) => {
      onServiceRequestRef.current?.(payload);
      void queryClient.invalidateQueries({ queryKey: ['service-requests'] });
    });
    socket.on('order:status', sync);
    socket.on('table:clearing_needed', sync);
    socket.on('table:vacated', (payload) => {
      onTableVacatedRef.current?.(payload);
      sync();
    });
    return () => { socket.disconnect(); };
  }, [enabled, queryClient]);
}
