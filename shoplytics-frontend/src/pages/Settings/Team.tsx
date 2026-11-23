import { Crown, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Alert, Badge, ConfirmDialog, DataTable, Field, Modal, PageHeader, Spinner, useToast } from '@/components/common/ui';
import { useBusiness } from '@/hooks/useBusiness';
import { useFetch } from '@/hooks/useFetch';
import { businessService } from '@/services/business.service';
import { useAppSelector } from '@/store';
import type { Member, Role } from '@/types';
import { date, errorMessage } from '@/utils/format';
import { P, ROLE_HINT, ROLE_LABEL } from '@/utils/permissions';

type Assignable = Exclude<Role, 'OWNER'>;
const ROLES: Assignable[] = ['ADMIN', 'MANAGER', 'ANALYST'];

export default function Team() {
  const { id, role, can } = useBusiness();
  const me = useAppSelector((s) => s.auth.user?.id);
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => businessService.members.list(id), [id]);
  const manage = can(P.MEMBER_MANAGE);
  const [add, setAdd] = useState(false);
  const [email, setEmail] = useState(''); const [newRole, setNewRole] = useState<Assignable>('ANALYST');
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rm, setRm] = useState<Member | null>(null);
  // An ADMIN can manage managers and analysts, but only the OWNER can add or change admins.
  const roleOptions = (m?: Member): Assignable[] => (role === 'OWNER' ? ROLES : ROLES.filter((r) => r !== 'ADMIN' || m?.role === 'ADMIN'));
  const editable = (m: Member) => manage && m.role !== 'OWNER' && (role === 'OWNER' || m.role !== 'ADMIN');

  const invite = async (e: React.FormEvent) => {
    e.preventDefault(); setFormErr(null); setBusy(true);
    try { await businessService.members.add(id, email.trim().toLowerCase(), newRole); toast('success', 'Member added'); setAdd(false); setEmail(''); void reload(); } catch (er) { setFormErr(errorMessage(er)); } finally { setBusy(false); }
  };
  const change = async (m: Member, r: Assignable) => { try { await businessService.members.setRole(id, m.userId, r); toast('success', `${m.name} is now ${ROLE_LABEL[r]}`); void reload(); } catch (er) { toast('error', errorMessage(er)); } };
  const remove = async () => {
    if (!rm) return; setBusy(true);
    try { await businessService.members.remove(id, rm.userId); toast('success', 'Member removed'); setRm(null); void reload(); } catch (er) { toast('error', errorMessage(er)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Team" subtitle="People with access to this business and what they can do" actions={manage ? <button className="btn-primary" onClick={() => { setAdd(true); setFormErr(null); setNewRole('ANALYST'); }}><UserPlus className="h-4 w-4" />Add member</button> : undefined} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'] as Role[]).map((r) => <div key={r} className="card p-4"><p className="text-sm font-semibold">{ROLE_LABEL[r]}</p><p className="mt-1 text-xs text-muted">{ROLE_HINT[r]}</p></div>)}
      </div>
      <DataTable rows={data ?? undefined} loading={loading} error={error} onRetry={reload} rowKey={(m) => m.userId}
        columns={[
          { header: 'Member', cell: (m) => <span><span className="font-medium">{m.name}</span>{m.userId === me && <span className="ml-2 text-xs text-muted">(you)</span>}<span className="block text-xs text-muted">{m.email}</span></span> },
          { header: 'Role', cell: (m) => m.role === 'OWNER' ? <Badge tone="pink"><Crown className="mr-1 h-3 w-3" />Owner</Badge>
            : editable(m) ? <select aria-label={`Role for ${m.name}`} className="input !w-auto !py-1" value={m.role} onChange={(e) => change(m, e.target.value as Assignable)}>{roleOptions(m).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
            : <Badge tone="blue">{ROLE_LABEL[m.role]}</Badge> },
          { header: 'Joined', cell: (m) => date(m.joinedAt) },
          { header: '', className: 'text-right', cell: (m) => (editable(m) || (m.userId === me && m.role !== 'OWNER')) ? <button className="btn-ghost !p-2 hover:!text-danger" aria-label={m.userId === me ? 'Leave business' : `Remove ${m.name}`} onClick={() => setRm(m)}><Trash2 className="h-4 w-4" /></button> : null },
        ]} />
      <Modal open={add} onClose={() => setAdd(false)} title="Add team member">
        <form onSubmit={invite} className="space-y-4">
          {formErr && <Alert>{formErr}</Alert>}
          <Field label="Email" hint="They must already have a Shoplytics account"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Role" hint={ROLE_HINT[newRole]}><select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as Assignable)}>{roleOptions().map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setAdd(false)}>Cancel</button><button className="btn-primary" disabled={busy}>{busy && <Spinner />}Add member</button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!rm} busy={busy} title={rm?.userId === me ? 'Leave business' : 'Remove member'} confirmLabel={rm?.userId === me ? 'Leave' : 'Remove'} message={rm?.userId === me ? 'You will lose access to this business immediately.' : <>Remove <b>{rm?.name}</b>? They lose access immediately.</>} onConfirm={remove} onClose={() => setRm(null)} />
    </>
  );
}
