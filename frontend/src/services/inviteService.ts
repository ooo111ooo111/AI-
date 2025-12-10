import api from './api';
import type { InvitationStatus } from '../types';

export const inviteService = {
  getStatus: async (): Promise<InvitationStatus> => {
    const response = await api.get<InvitationStatus>('/invitations/status');
    return response.data;
  },
  redeem: async (code: string): Promise<{ message: string; status: InvitationStatus }> => {
    const response = await api.post<{ message: string; status: InvitationStatus }>('/invitations/redeem', { code });
    return response.data;
  }
};
