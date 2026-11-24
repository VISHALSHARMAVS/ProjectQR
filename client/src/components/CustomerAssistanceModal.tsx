import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { Modal } from './ui';

export type ServiceType = 'WATER' | 'CUTLERY' | 'BILL' | 'WAITER';

interface Props {
  token: string;
  tableLabel?: string;
  isOpen: boolean;
  onClose: () => void;
}

const serviceOptions: { type: ServiceType; label: string; icon: string; desc: string }[] = [
  { type: 'WATER', icon: '💧', label: 'Drinking Water', desc: 'Fresh water refill or glasses' },
  { type: 'CUTLERY', icon: '🍴', label: 'Extra Cutlery', desc: 'Spoons, forks, or extra plates' },
  { type: 'BILL', icon: '🧾', label: 'Request the Bill', desc: 'Ready to pay at table or counter' },
  { type: 'WAITER', icon: '🙋', label: 'Call Waiter', desc: 'Staff assistance for questions/ordering' }
];

export function CustomerAssistanceModal({ token, tableLabel = 'Your table', isOpen, onClose }: Props) {
  const [selectedType, setSelectedType] = useState<ServiceType>('WATER');
  const [notes, setNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const requestMutation = useMutation({
    mutationFn: async () => {
      return api.post('/customer/service-request', {
        token,
        type: selectedType,
        notes: notes.trim()
      });
    },
    onSuccess: () => {
      setStatusMessage({
        type: 'success',
        text: 'Request sent to staff! Someone from the team will attend your table shortly.'
      });
      setNotes('');
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === 'REQUEST_COOLDOWN') {
        setStatusMessage({
          type: 'info',
          text: err.message || 'Your request was already sent to staff. Someone is already on their way!'
        });
      } else {
        const msg = err instanceof ApiError ? err.message : 'Could not reach staff. Please try again.';
        setStatusMessage({ type: 'error', text: msg });
      }
    }
  });

  if (!isOpen) return null;

  return (
    <Modal
      title="Table Assistance"
      onClose={() => {
        if (!requestMutation.isPending) {
          setStatusMessage(null);
          onClose();
        }
      }}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Need something at <strong>{tableLabel}</strong>? Choose an option and staff will be notified instantly.
        </p>

        {statusMessage ? (
          <div
            className={`notice ${statusMessage.type === 'success' ? 'success' : ''}`}
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              background:
                statusMessage.type === 'success'
                  ? 'var(--soft-green)'
                  : statusMessage.type === 'info'
                  ? 'var(--soft-orange)'
                  : 'rgba(239, 68, 68, 0.15)',
              color:
                statusMessage.type === 'success'
                  ? 'var(--green)'
                  : statusMessage.type === 'info'
                  ? 'var(--orange)'
                  : 'var(--red)',
              border:
                statusMessage.type === 'success'
                  ? '1px solid var(--green)'
                  : statusMessage.type === 'info'
                  ? '1px solid var(--orange)'
                  : '1px solid var(--red)'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              {statusMessage.type === 'success' ? '✓ Request Received' : statusMessage.type === 'info' ? 'ℹ️ Already Notified' : '✕ Error'}
            </div>
            <div style={{ fontSize: 13 }}>{statusMessage.text}</div>
            <button
              type="button"
              className="btn small"
              style={{ marginTop: 12 }}
              onClick={() => {
                setStatusMessage(null);
                onClose();
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              requestMutation.mutate();
            }}
            style={{ display: 'grid', gap: 14 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {serviceOptions.map((opt) => {
                const isSelected = selectedType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setSelectedType(opt.type)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: isSelected ? '2px solid var(--green)' : '1px solid var(--line)',
                      background: isSelected ? 'var(--soft-green)' : 'var(--paper)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all .15s ease'
                    }}
                  >
                    <span style={{ fontSize: 22, marginBottom: 4 }}>{opt.icon}</span>
                    <strong style={{ fontSize: 13, color: isSelected ? 'var(--green)' : 'var(--ink)' }}>
                      {opt.label}
                    </strong>
                    <span className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="field">
              <label htmlFor="service-notes" style={{ fontSize: 12, fontWeight: 600 }}>
                Special instruction <span className="muted">(optional)</span>
              </label>
              <input
                id="service-notes"
                className="input"
                placeholder="e.g. Warm water / 2 extra glasses"
                maxLength={100}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="toolbar" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                className="btn secondary"
                onClick={onClose}
                disabled={requestMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn"
                disabled={requestMutation.isPending}
              >
                {requestMutation.isPending && <span className="btn-spinner" aria-hidden="true" />}
                {requestMutation.isPending ? 'Sending…' : 'Notify Staff'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
