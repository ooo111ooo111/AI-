import api from './api';
import type { AdminUserListResponse, InvitationGenerateResponse, InvitationListResponse } from '../types';

export const adminService = {
  getUsers: async (): Promise<AdminUserListResponse> => {
    const response = await api.get<AdminUserListResponse>('/admin/users');
    return response.data;
  },
  generateInvites: async (payload: {
    count: number;
    length: number;
    prefix?: string;
    description?: string;
    maxRedemptions?: number;
    expiresAt?: string;
  }): Promise<InvitationGenerateResponse> => {
    const response = await api.post<InvitationGenerateResponse>('/admin/invitations/generate', payload);
    return response.data;
  },
  getInvitationList: async (params?: { page?: number; limit?: number; code?: string; status?: string }): Promise<InvitationListResponse> => {
    const response = await api.get<InvitationListResponse>('/admin/invitations', { params });
    return response.data;
  },
  deleteInvitation: async (id: string) => {
    await api.delete(`/admin/invitations/${id}`);
  },
  exportInvitations: async (params?: { code?: string; status?: string }) => {
    const response = await api.get('/admin/invitations/export', {
      params,
      responseType: 'blob'
    });
    return response.data;
  }
};
