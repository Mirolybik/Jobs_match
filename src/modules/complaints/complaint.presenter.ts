import { ComplaintStatus, Role } from '@prisma/client';
import { ComplaintWithRelations } from './complaint.repository';

const STATUS_LABELS: Readonly<Record<ComplaintStatus, string>> = {
  [ComplaintStatus.OPEN]: 'Открыта',
  [ComplaintStatus.RESOLVED]: 'Рассмотрена',
  [ComplaintStatus.REJECTED]: 'Отклонена',
};

export interface ComplaintResponse {
  id: string;
  reason: string;
  comment: string | null;
  status: ComplaintStatus;
  statusLabel: string;
  resolutionComment: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  author: { id: string; email: string; role: Role };
  vacancy: { id: string; title: string; company: { id: string; name: string } } | null;
  application: {
    id: string;
    status: string;
    vacancyId: string;
    candidateId: string;
  } | null;
}

export class ComplaintPresenter {
  static toResponse(complaint: ComplaintWithRelations): ComplaintResponse {
    return {
      id: complaint.id,
      reason: complaint.reason,
      comment: complaint.comment,
      status: complaint.status,
      statusLabel: STATUS_LABELS[complaint.status],
      resolutionComment: complaint.resolutionComment,
      createdAt: complaint.createdAt,
      resolvedAt: complaint.resolvedAt,
      author: complaint.author,
      vacancy: complaint.vacancy,
      application: complaint.application,
    };
  }
}
