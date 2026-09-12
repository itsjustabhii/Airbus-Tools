import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { profileApi } from '../api/profileApi';

vi.mock('../api/profileApi', () => ({
  profileApi: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    getPresignedUploadUrl: vi.fn(),
    uploadImageToS3: vi.fn(),
  },
}));

describe('ProfilePage Component', () => {
  const mockUser = {
    id: 'user-123',
    email: 'pilot@airline.com',
    firstName: 'Jane',
    lastName: 'Doe',
    name: 'Jane Doe',
    bio: 'Experienced A320 Captain',
    company: 'Airbus Fleet Operations',
    role: 'AIRLINE',
    status: 'ACTIVE',
    profilePicture: 'https://example.com/avatar.jpg',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-preview');
  });

  it('renders loading state initially and then displays profile data', async () => {
    vi.mocked(profileApi.getProfile).mockResolvedValueOnce(mockUser);

    render(<ProfilePage />);

    // Check loading indicator
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();

    // Check loaded profile
    await waitFor(() => {
      expect(screen.getByText('User Profile')).toBeInTheDocument();
    });

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('pilot@airline.com')).toBeInTheDocument();
    expect(screen.getByText('Role: AIRLINE')).toBeInTheDocument();
    expect(screen.getByText('Company: Airbus Fleet Operations')).toBeInTheDocument();
    expect(screen.getByTestId('profile-image')).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('renders error state when profile fetching fails', async () => {
    vi.mocked(profileApi.getProfile).mockRejectedValueOnce(new Error('Network error'));

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('updates name and bio on form submission', async () => {
    const user = userEvent.setup();
    vi.mocked(profileApi.getProfile).mockResolvedValueOnce(mockUser);
    vi.mocked(profileApi.updateProfile).mockResolvedValueOnce({
      ...mockUser,
      name: 'Jane Senior Doe',
      bio: 'Instructor Pilot',
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue('Jane Doe');
    const bioInput = screen.getByDisplayValue('Experienced A320 Captain');

    await user.clear(nameInput);
    await user.type(nameInput, 'Jane Senior Doe');

    await user.clear(bioInput);
    await user.type(bioInput, 'Instructor Pilot');

    const saveBtn = screen.getByRole('button', { name: /save profile/i });
    await user.click(saveBtn);

    expect(profileApi.updateProfile).toHaveBeenCalledWith({
      name: 'Jane Senior Doe',
      bio: 'Instructor Pilot',
      profilePicture: 'https://example.com/avatar.jpg',
    });

    await waitFor(() => {
      expect(screen.getByTestId('profile-success')).toHaveTextContent('Profile updated successfully!');
    });
  });

  it('handles image upload via S3 presigned URL flow', async () => {
    vi.mocked(profileApi.getProfile).mockResolvedValueOnce(mockUser);
    vi.mocked(profileApi.getPresignedUploadUrl).mockResolvedValueOnce({
      uploadUrl: 'https://s3.amazonaws.com/upload-url-mock',
      fileUrl: 'https://s3.amazonaws.com/new-avatar.png',
      key: 'uploads/avatars/user-123/new-avatar.png',
      expiresIn: 300,
    });
    vi.mocked(profileApi.uploadImageToS3).mockResolvedValueOnce();
    vi.mocked(profileApi.updateProfile).mockResolvedValueOnce({
      ...mockUser,
      profilePicture: 'https://s3.amazonaws.com/new-avatar.png',
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('file-input')).toBeInTheDocument();
    });

    const file = new File(['image content'], 'avatar.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('file-input');

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(profileApi.getPresignedUploadUrl).toHaveBeenCalledWith({
        contentType: 'image/png',
        fileSize: file.size,
        fileName: 'avatar.png',
      });
    });

    expect(profileApi.uploadImageToS3).toHaveBeenCalledWith(
      'https://s3.amazonaws.com/upload-url-mock',
      file,
    );
    expect(profileApi.updateProfile).toHaveBeenCalledWith({
      profilePicture: 'https://s3.amazonaws.com/new-avatar.png',
    });
  });

  it('validates file type and size on image selection', async () => {
    vi.mocked(profileApi.getProfile).mockResolvedValueOnce(mockUser);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('file-input')).toBeInTheDocument();
    });

    const invalidFile = new File(['pdf content'], 'document.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByTestId('file-input');

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('image-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('image-error')).toHaveTextContent('Invalid file type');
    expect(profileApi.getPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('handles password change submission with validation', async () => {
    const user = userEvent.setup();
    vi.mocked(profileApi.getProfile).mockResolvedValueOnce(mockUser);
    vi.mocked(profileApi.changePassword).mockResolvedValueOnce({ message: 'Password updated successfully' });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
    });

    const currentPasswordInput = screen.getByLabelText(/current password/i);
    const newPasswordInput = screen.getByLabelText(/^new password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm new password/i);

    // Test mismatched passwords
    await user.type(currentPasswordInput, 'CurrentPass123!');
    await user.type(newPasswordInput, 'NewPassword123!');
    await user.type(confirmPasswordInput, 'MismatchPass123!');

    const submitBtn = screen.getByRole('button', { name: /update password/i });
    await user.click(submitBtn);

    expect(screen.getByTestId('password-error')).toHaveTextContent('New passwords do not match');
    expect(profileApi.changePassword).not.toHaveBeenCalled();

    // Fix confirmation
    await user.clear(confirmPasswordInput);
    await user.type(confirmPasswordInput, 'NewPassword123!');
    await user.click(submitBtn);

    expect(profileApi.changePassword).toHaveBeenCalledWith({
      currentPassword: 'CurrentPass123!',
      newPassword: 'NewPassword123!',
    });

    await waitFor(() => {
      expect(screen.getByTestId('password-success')).toHaveTextContent('Password updated successfully!');
    });
  });
});
