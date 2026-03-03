import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * ResetPassword page - redirects to /admin/login preserving hash & search params
 * so the existing recovery token handler picks up the token.
 */
const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Preserve hash and search params so AdminLogin can process the recovery token
    navigate(`/admin/login${location.search}${location.hash}`, { replace: true });
  }, [navigate, location]);

  return null;
};

export default ResetPassword;
