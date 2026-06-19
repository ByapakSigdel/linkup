'use client';

import { Avatar, Badge, Card } from '@/components/ui';
import type { CircleMemberView } from './types';

interface MembersListProps {
  members: CircleMemberView[];
}

export function MembersList({ members }: MembersListProps) {
  return (
    <Card cardStyle="bordered" padding="md">
      <h3 className="mb-3 font-display text-sm font-semibold text-text">
        Members
        <span className="ml-1 font-mono font-normal text-text-muted">
          ({members.length})
        </span>
      </h3>
      {members.length === 0 ? (
        <p className="text-xs text-text-muted">No members yet.</p>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
            const partners =
              m.partnerNames && m.partnerNames.length > 0
                ? m.partnerNames.join(' & ')
                : null;
            const displayName = m.coupleName || partners || 'Couple';
            return (
              <li key={m.coupleId} className="flex items-center gap-3">
                <Avatar
                  size="sm"
                  src={m.coupleAvatarUrl}
                  name={displayName}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {displayName}
                  </p>
                  {partners && m.coupleName && (
                    <p className="truncate text-xs text-text-muted">
                      {partners}
                    </p>
                  )}
                </div>
                {m.role === 'admin' && (
                  <Badge variant="outline" size="sm">
                    Admin
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
