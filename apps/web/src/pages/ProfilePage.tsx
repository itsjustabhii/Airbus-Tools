import { useState, useEffect } from 'react';
import { profileApi, type UserProfile } from '../api/profileApi';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function ProfilePage() {
  // Main state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Profile form state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Image Upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Password Change form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await profileApi.getProfile();
      setProfile(data);
      setName(data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim());
      setBio(data.bio || '');
      setProfilePicture(data.profilePicture || data.avatarUrl || '');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        || (err instanceof Error ? err.message : 'Failed to load profile');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);
    setIsUpdatingProfile(true);

    try {
      const updated = await profileApi.updateProfile({
        name: name.trim(),
        bio: bio.trim(),
        profilePicture: profilePicture || undefined,
      });
      setProfile(updated);
      setProfileSuccess('Profile updated successfully!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        || (err instanceof Error ? err.message : 'Failed to update profile');
      setProfileError(msg);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError(null);

    // Validate type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setImageError(`Invalid file type. Supported types: JPEG, PNG, WebP, GIF.`);
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setImageError(`File size exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      return;
    }

    // Local preview
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploadingImage(true);

    try {
      // 1. Request presigned URL from backend
      const presigned = await profileApi.getPresignedUploadUrl({
        contentType: file.type,
        fileSize: file.size,
        fileName: file.name,
      });

      // 2. Direct upload to S3 via PUT request
      await profileApi.uploadImageToS3(presigned.uploadUrl, file);

      // 3. Update the profile picture URL in state and profile
      setProfilePicture(presigned.fileUrl);

      // 4. Persist to profile
      const updated = await profileApi.updateProfile({
        profilePicture: presigned.fileUrl,
      });
      setProfile(updated);
      setProfileSuccess('Profile picture updated successfully!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        || (err instanceof Error ? err.message : 'Image upload failed. Please try again.');
      setImageError(msg);
      setPreviewUrl(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);

    try {
      await profileApi.changePassword({
        currentPassword,
        newPassword,
      });
      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        || (err instanceof Error ? err.message : 'Failed to change password');
      setPasswordError(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="flex items-center space-x-3 text-gray-600" data-testid="loading-state">
          <svg className="h-6 w-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-lg font-medium">Loading profile...</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-lg bg-red-50 p-6 text-center border border-red-200" data-testid="error-state">
          <h2 className="text-lg font-semibold text-red-700">Unable to load profile</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <button
            onClick={fetchProfile}
            className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">User Profile</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your personal settings, avatar, and security.</p>
        </div>

        {/* Read-only info & Avatar Header Card */}
        <section aria-labelledby="overview-heading" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 id="overview-heading" className="text-xl font-semibold text-gray-900 mb-4">Profile Overview</h2>
          <div className="flex flex-col items-center sm:flex-row sm:space-x-6">
            <div className="relative mb-4 sm:mb-0">
              <div className="h-24 w-24 overflow-hidden rounded-full bg-gray-100 ring-4 ring-gray-100 flex items-center justify-center">
                {previewUrl || profilePicture ? (
                  <img
                    src={previewUrl || profilePicture}
                    alt={profile?.name || profile?.firstName || 'User Avatar'}
                    className="h-full w-full object-cover"
                    data-testid="profile-image"
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-400" data-testid="avatar-fallback">
                    {(profile?.firstName?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
                  </span>
                )}
              </div>
              {uploadingImage && (
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white text-xs font-semibold"
                  data-testid="uploading-indicator"
                >
                  Uploading...
                </div>
              )}
            </div>

            <div className="space-y-1 text-center sm:text-left flex-1">
              <h3 className="text-xl font-bold text-gray-900">
                {profile?.name || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || 'No Name Set'}
              </h3>
              <p className="text-sm text-gray-500">{profile?.email}</p>
              <div className="mt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                  Role: {profile?.role}
                </span>
                {profile?.company && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                    Company: {profile.company}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                  Status: {profile?.status}
                </span>
              </div>
            </div>

            <div className="mt-4 sm:mt-0">
              <label
                htmlFor="avatar-upload"
                className={`cursor-pointer rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 ${
                  uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {uploadingImage ? 'Uploading...' : 'Change Photo'}
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={uploadingImage}
                  data-testid="file-input"
                />
              </label>
            </div>
          </div>

          {imageError && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200" data-testid="image-error">
              {imageError}
            </div>
          )}
        </section>

        {/* Edit Profile Form */}
        <section aria-labelledby="edit-profile-heading" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 id="edit-profile-heading" className="text-xl font-semibold text-gray-900 mb-2">Edit Profile</h2>
          <p className="text-sm text-gray-500 mb-6">
            You can update your name and bio. Email, company, and role are non-modifiable.
          </p>

          {profileSuccess && (
            <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700 border border-green-200" data-testid="profile-success">
              {profileSuccess}
            </div>
          )}
          {profileError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200" data-testid="profile-error">
              {profileError}
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label htmlFor="name-input" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="bio-input" className="block text-sm font-medium text-gray-700">
                Bio
              </label>
              <textarea
                id="bio-input"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself and your role..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            {/* Read-only fields displaying unmodifiable attributes */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-gray-500">Email (Fixed)</label>
                <input
                  type="text"
                  disabled
                  value={profile?.email || ''}
                  className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Company (Fixed)</label>
                <input
                  type="text"
                  disabled
                  value={profile?.company || 'N/A'}
                  className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Role (Fixed)</label>
                <input
                  type="text"
                  disabled
                  value={profile?.role || ''}
                  className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isUpdatingProfile}
                className="inline-flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </section>

        {/* Change Password Form */}
        <section aria-labelledby="password-heading" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 id="password-heading" className="text-xl font-semibold text-gray-900 mb-2">Change Password</h2>
          <p className="text-sm text-gray-500 mb-6">
            Ensure your account is protected with a secure password.
          </p>

          {passwordSuccess && (
            <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700 border border-green-200" data-testid="password-success">
              {passwordSuccess}
            </div>
          )}
          {passwordError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200" data-testid="password-error">
              {passwordError}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-gray-700">
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="inline-flex justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50"
              >
                {isChangingPassword ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
