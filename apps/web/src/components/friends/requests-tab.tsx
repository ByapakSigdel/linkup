'use client';

import { useState } from 'react';
import { Inbox, Send, Check, X, Clock, Mail } from 'lucide-react';
import { Card, Button, Avatar, Badge, Spinner } from '@/components/ui';
import api from '@/lib/api';
import { useToastStore } from '@/stores/toast-store';
import type { ReceivedInvitation, SentInvitation } from './types';

interface RequestsTabProps {
  invitations: ReceivedInvitation[];
  sent: SentInvitation[];
  loading: boolean;
  onChanged: () => void;
}

function errorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response
      ?.data?.error?.message ?? fallback
  );
}

function ReceivedRow({
  invite,
  onChanged,
}: {
  invite: ReceivedInvitation;
  onChanged: () => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  const name =
    invite.fromUser?.displayName ??
    invite.fromCouple?.coupleName ??
    'A LinkUp user';
  const subtitle = invite.fromUser?.username
    ? `@${invite.fromUser.username}`
    : invite.fromCouple?.coupleName
      ? 'Couple'
      : undefined;
  const avatarSrc =
    invite.fromUser?.avatarUrl ?? invite.fromCouple?.coupleAvatarUrl ?? undefined;

  const accept = async () => {
    setAccepting(true);
    try {
      await api.post(`/friends/${invite.id}/accept`);
      useToastStore.getState().push({
        title: 'Friend added',
        body: `You and ${name} are now connected.`,
        variant: 'success',
      });
      onChanged();
    } catch (err: unknown) {
      useToastStore.getState().push({
        title: 'Could not accept',
        body: errorMessage(err, 'Please try again.'),
        variant: 'info',
      });
      setAccepting(false);
    }
  };

  const decline = async () => {
    setDeclining(true);
    try {
      await api.post(`/friends/${invite.id}/decline`);
      useToastStore.getState().push({
        title: 'Request declined',
        variant: 'info',
      });
      onChanged();
    } catch (err: unknown) {
      useToastStore.getState().push({
        title: 'Could not decline',
        body: errorMessage(err, 'Please try again.'),
        variant: 'info',
      });
      setDeclining(false);
    }
  };

  return (
    <Card cardStyle="bordered" padding="md">
      <div className="flex items-center gap-3">
        <Avatar src={avatarSrc} name={name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text">{name}</p>
          {subtitle && (
            <p className="truncate text-sm text-text-muted">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            loading={accepting}
            disabled={declining}
            onClick={accept}
          >
            <Check className="h-4 w-4" />
            Accept
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={declining}
            disabled={accepting}
            onClick={decline}
          >
            <X className="h-4 w-4" />
            Decline
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function RequestsTab({
  invitations,
  sent,
  loading,
  onChanged,
}: RequestsTabProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Received */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-text-muted" />
          <h2 className="text-sm font-semibold text-text">
            Received requests
          </h2>
          {invitations.length > 0 && (
            <Badge variant="default" size="sm">
              {invitations.length}
            </Badge>
          )}
        </div>

        {invitations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover">
              <Inbox className="h-6 w-6 text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text">No pending requests</p>
            <p className="max-w-xs text-xs text-text-muted">
              When someone invites you to connect, it will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map((invite) => (
              <ReceivedRow
                key={invite.id}
                invite={invite}
                onChanged={onChanged}
              />
            ))}
          </div>
        )}
      </section>

      {/* Sent */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-text-muted" />
          <h2 className="text-sm font-semibold text-text">Sent invites</h2>
          {sent.length > 0 && (
            <Badge variant="outline" size="sm">
              {sent.length}
            </Badge>
          )}
        </div>

        {sent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
            You have not sent any invites yet.
          </p>
        ) : (
          <div className="space-y-2">
            {sent.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover">
                  <Mail className="h-4 w-4 text-text-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text">
                    {invite.toEmail ?? 'Invited user'}
                  </p>
                </div>
                <Badge
                  variant={invite.status === 'pending' ? 'warning' : 'outline'}
                  size="sm"
                >
                  <Clock className="mr-1 h-3 w-3" />
                  {invite.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
