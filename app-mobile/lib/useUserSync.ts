import { useEffect, useRef } from "react";
import { useAppContext } from "./AppContext";
import { useAppAuth } from "./auth";
import { syncUser } from "./api";

/** On first sign-in, sync the Clerk user to the backend and store appUserId. */
export function useUserSync() {
  const { isSignedIn, getToken } = useAppAuth();
  const { appUserId, setAppUserId } = useAppContext();
  const syncing = useRef(false);

  useEffect(() => {
    if (!isSignedIn || appUserId || syncing.current) return;

    syncing.current = true;
    (async () => {
      const token = await getToken();
      if (!token) return;
      const user = await syncUser(token);
      setAppUserId(user.id);
      syncing.current = false;
    })();
  }, [isSignedIn, appUserId]);
}
