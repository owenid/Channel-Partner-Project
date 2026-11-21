import { ReactNode, useEffect, useState } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { setTokenProvider } from './api/client';

const domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;
const organization = import.meta.env.VITE_AUTH0_ORGANIZATION as string | undefined;
export const authEnabled = !!(domain && clientId && audience);

/** Requires login, then hands the API client a way to get access tokens. */
function Gate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently, error } = useAuth0();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      loginWithRedirect({ appState: { returnTo: window.location.pathname + window.location.search } });
      return;
    }
    setTokenProvider(() => getAccessTokenSilently());
    setReady(true);
  }, [isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently]);

  if (error) return <div className="page"><p className="error-text">Sign-in failed: {error.message}</p></div>;
  return ready ? <>{children}</> : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!authEnabled) return <>{children}</>; // local dev: back end uses its dev user
  return (
    <Auth0Provider
      domain={domain!}
      clientId={clientId!}
      authorizationParams={{ redirect_uri: window.location.origin, audience, organization }}
      onRedirectCallback={(state) => window.history.replaceState({}, '', state?.returnTo ?? '/')}
      cacheLocation="memory"
      useRefreshTokens
    >
      <Gate>{children}</Gate>
    </Auth0Provider>
  );
}

export function useLogout() {
  if (!authEnabled) return () => alert('Auth0 is not configured - running as the dev user.');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { logout } = useAuth0();
  return () => logout({ logoutParams: { returnTo: window.location.origin } });
}
