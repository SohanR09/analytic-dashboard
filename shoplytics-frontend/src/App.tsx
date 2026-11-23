import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/common/ui';
import { AppRoutes } from '@/routes';
import { setSessionLostHandler } from '@/services/api';
import { useAppDispatch } from '@/store';
import { bootstrap, sessionLost } from '@/store/slices/authSlice';
import { reset } from '@/store/slices/businessSlice';
import { clearDashboard } from '@/store/slices/dashboardSlice';

export default function App() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    // If the server rejects our session (expired / revoked elsewhere), drop everything and show the login page.
    setSessionLostHandler(() => { dispatch(sessionLost()); dispatch(reset()); dispatch(clearDashboard()); });
    void dispatch(bootstrap());
  }, [dispatch]);
  return (
    <BrowserRouter>
      <ToastProvider><AppRoutes /></ToastProvider>
    </BrowserRouter>
  );
}
