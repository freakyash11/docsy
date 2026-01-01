import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, RedirectToSignUp } from '@clerk/clerk-react';

const InvitePage = () => {
  const { token: invitationToken } = useParams();
  const { getToken, isSignedIn, isLoaded } = useAuth(); // Add isLoaded
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

  const fetchInvitation = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/invite/${invitationToken}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch invitation');
      }

      setInvitation(data.invitation);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [backendUrl, invitationToken]);

  useEffect(() => {
    if (!invitationToken) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    fetchInvitation();
  }, [invitationToken, fetchInvitation]);

  const acceptInvitation = async () => {
    try {
      const jwtToken = await getToken();
      const response = await fetch(`${backendUrl}/api/invite/${invitationToken}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      console.log('Invitation accepted:', data);
      navigate(data.redirectTo || '/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  // Wait for Clerk to load before rendering anything
  if (!isLoaded || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center p-8 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-xl font-bold text-red-800 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="bg-blue-500 text-white px-4 py-2 rounded">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return <div className="flex justify-center items-center h-screen">Invitation not found</div>;
  }

  // Redirect unauthenticated users to sign up
  if (!isSignedIn) {
    return (
      <RedirectToSignUp 
        fallbackRedirectUrl={`/invite/${invitationToken}`}
        signInFallbackRedirectUrl={`/invite/${invitationToken}`}
      />
    );
  }

  // User is authenticated - show accept invitation UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-4">Invitation to Collaborate</h1>
        <p className="text-gray-600 mb-4">
          You've been invited to <strong>{invitation.role}</strong> on "<strong>{invitation.documentTitle}</strong>" by <strong>{invitation.invitedBy}</strong>.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          This invitation is for {invitation.email}. Expires {new Date(invitation.expiresAt).toLocaleDateString()}.
        </p>
        
        <button
          onClick={acceptInvitation}
          className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:bg-gray-400"
        >
          Accept Invitation
        </button>
      </div>
    </div>
  );
};

export default InvitePage;
