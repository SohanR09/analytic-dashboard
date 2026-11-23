import { Check, ChevronsUpDown, LayoutGrid } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { ROLE_LABEL } from '@/utils/permissions';
import { Badge } from '@/components/common/ui';

export function BusinessSwitcher() {
  const { list, active } = useAppSelector((s) => s.business);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  /** Keep the user on the same module when switching business (e.g. /sales stays /sales). */
  const go = (id: string) => {
    const rest = loc.pathname.split('/').slice(3, 4).join('/') || 'dashboard';
    setOpen(false);
    nav(`/businesses/${id}/${rest}`);
  };
  return (
    <div className="relative" ref={ref}>
      <button className="btn-secondary max-w-[220px] !justify-between" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="truncate">{active?.name ?? 'Select business'}</span><ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {open && (
        <div role="listbox" className="card absolute left-0 z-30 mt-2 w-72 overflow-hidden p-1">
          <div className="max-h-72 overflow-y-auto">
            {list.map((b) => (
              <button key={b.id} role="option" aria-selected={b.id === active?.id} onClick={() => go(b.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-lightblue">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{b.name}</span><span className="block truncate text-xs text-muted">{b.category}</span></span>
                <Badge tone="blue">{ROLE_LABEL[b.role]}</Badge>
                {b.id === active?.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
          <button className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-line px-3 py-2 text-sm text-primary hover:bg-lightblue" onClick={() => { setOpen(false); nav('/businesses'); }}>
            <LayoutGrid className="h-4 w-4" />All businesses
          </button>
        </div>
      )}
    </div>
  );
}
