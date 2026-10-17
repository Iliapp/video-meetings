'use client';

import { Card } from '@heroui/react';

export function RecordingsSection({}: {
  meetingId: string;
  token: string;
  isOwner: boolean;
  onUnauthorized: () => void;
}) {
  return (
    <Card className="gap-0 p-0">
      <Card.Header className="border-b border-separator px-5 py-4 sm:px-6">
        <h2 className="text-lg font-semibold">Recordings</h2>
      </Card.Header>
    </Card>
  );
}
