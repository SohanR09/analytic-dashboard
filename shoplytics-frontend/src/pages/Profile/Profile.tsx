import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Monitor } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Badge, Card, Field, Spinner, useToast } from '@/components/common/ui';
import { Logo } from '@/components/layout/Logo';
import { UserMenu } from '@/components/layout/UserMenu';
import { useFetch } from '@/hooks/useFetch';
import { authService } from '@/services/auth.service';
import { useAppDispatch, useAppSelector } from '@/store';
import { sessionLost, userUpdated } from '@/store/slices/authSlice';
import { dateTime, errorMessage } from '@/utils/format';
import { ROLE_LABEL } from '@/utils/permissions';
import { passwordRule } from '../Auth/schemas';

const profileSchema = z.object({ name: z.string().trim().min(2, 'Name is too short').max(100), profileImage: z.string().trim().url('Enter a full image URL').or(z.literal('')).optional() });
const pwSchema = z.object({ currentPassword: z.string().min(1, 'Required'), newPassword: passwordRule, confirm: z.string() }).refine((d) => d.newPassword === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export default function Profile() {
  const user = useAppSelector((s) => s.auth.user)!;
  const dispatch = useAppDispatch();
  const toast = useToast();
  const nav = useNavigate();
  const p = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { name: user.name, profileImage: user.profileImage ?? '' } });
  const pw = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) });
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const sessions = useFetch(() => authService.sessions(), []);

  const saveProfile = p.handleSubmit(async (v) => { setErr(null); try { const u = await authService.updateProfile({ name: v.name, profileImage: v.profileImage || undefined }); dispatch(userUpdated({ name: u.name, profileImage: u.profileImage })); toast('success', 'Profile updated'); } catch (e) { setErr(errorMessage(e)); } });
  const changePw = pw.handleSubmit(async (v) => {
    setPwErr(null);
    try { await authService.changePassword(v.currentPassword, v.newPassword); pw.reset(); toast('success', 'Password changed. Other devices were signed out.'); void sessions.reload(); } catch (e) { setPwErr(errorMessage(e)); }
  });
  const revoke = async (sid: string) => { try { await authService.revokeSession(sid); void sessions.reload(); } catch (e) { toast('error', errorMessage(e)); } };
  const logoutAll = async () => { try { await authService.logoutAll(); dispatch(sessionLost()); nav('/login'); } catch (e) { toast('error', errorMessage(e)); } };

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3"><Logo to="/businesses" /><UserMenu /></div></header>
      <main className="mx-auto max-w-4xl space-y-5 p-5 sm:p-8">
        <Link to="/businesses" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Businesses</Link>
        <h1 className="text-2xl font-bold">Profile & security</h1>
        <Card title="Profile">
          <form onSubmit={saveProfile} className="space-y-4" noValidate>
            {err && <Alert>{err}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={p.formState.errors.name?.message}><input className="input" {...p.register('name')} /></Field>
              <Field label="Email" hint="Email cannot be changed"><input className="input" value={user.email} disabled /></Field>
            </div>
            <Field label="Profile image URL" error={p.formState.errors.profileImage?.message}><input className="input" placeholder="https://" {...p.register('profileImage')} /></Field>
            <div className="flex justify-end"><button className="btn-primary" disabled={p.formState.isSubmitting}>{p.formState.isSubmitting && <Spinner />}Save</button></div>
          </form>
        </Card>
        {user.memberships && user.memberships.length > 0 && (
          <Card title="Your access"><ul className="divide-y divide-line text-sm">{user.memberships.map((m) => <li key={m.businessId} className="flex items-center justify-between py-2.5"><Link className="font-medium text-primary hover:underline" to={`/businesses/${m.businessId}/dashboard`}>{m.businessName}</Link><Badge tone="blue">{ROLE_LABEL[m.role]}</Badge></li>)}</ul></Card>
        )}
        <Card title="Change password">
          <form onSubmit={changePw} className="space-y-4" noValidate>
            {pwErr && <Alert>{pwErr}</Alert>}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Current password" error={pw.formState.errors.currentPassword?.message}><input className="input" type="password" autoComplete="current-password" {...pw.register('currentPassword')} /></Field>
              <Field label="New password" error={pw.formState.errors.newPassword?.message}><input className="input" type="password" autoComplete="new-password" {...pw.register('newPassword')} /></Field>
              <Field label="Confirm" error={pw.formState.errors.confirm?.message}><input className="input" type="password" autoComplete="new-password" {...pw.register('confirm')} /></Field>
            </div>
            <div className="flex justify-end"><button className="btn-primary" disabled={pw.formState.isSubmitting}>{pw.formState.isSubmitting && <Spinner />}Update password</button></div>
          </form>
        </Card>
        <Card title="Active sessions" action={<button className="btn-secondary !py-1.5" onClick={logoutAll}>Log out everywhere</button>}>
          {sessions.error && <Alert>{sessions.error}</Alert>}
          <ul className="divide-y divide-line text-sm">
            {sessions.data?.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3"><Monitor className="h-4 w-4 text-muted" /><span className="min-w-0 flex-1"><span className="block truncate">{s.userAgent ?? 'Unknown device'}</span><span className="text-xs text-muted">{s.ip ?? ''} · signed in {dateTime(s.createdAt)}</span></span>
                {s.current ? <Badge tone="green">This device</Badge> : <button className="btn-ghost text-danger" onClick={() => revoke(s.id)}>Revoke</button>}</li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}
