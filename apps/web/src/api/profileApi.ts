import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  bio?: string;
  company?: string;
  role: string;
  status: string;
  avatarUrl?: string;
  profilePicture?: string;
  phoneNumber?: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresIn: number;
}

export const profileApi = {
  getProfile: async (): Promise<UserProfile> => {
    const res = await apiClient.get<{ success: boolean; data: { user: UserProfile } }>('/profile');
    return res.data.data.user;
  },

  updateProfile: async (data: { name?: string | undefined; bio?: string | undefined; profilePicture?: string | undefined }): Promise<UserProfile> => {
    const res = await apiClient.patch<{ success: boolean; data: { user: UserProfile } }>('/profile', data);
    return res.data.data.user;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<{ message: string }> => {
    const res = await apiClient.patch<{ success: boolean; data: { message: string } }>('/profile/password', data);
    return res.data.data;
  },

  getPresignedUploadUrl: async (data: {
    contentType: string;
    fileSize?: number | undefined;
    fileName?: string | undefined;
  }): Promise<PresignedUrlResponse> => {
    const res = await apiClient.post<{ success: boolean; data: PresignedUrlResponse }>(
      '/uploads/presigned-url',
      data,
    );
    return res.data.data;
  },

  uploadImageToS3: async (uploadUrl: string, file: File): Promise<void> => {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
    });
  },
};
