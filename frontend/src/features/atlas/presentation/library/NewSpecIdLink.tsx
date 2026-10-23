import * as m from 'motion/react-m';
import { Link } from 'react-router-dom';
import { PlusIcon } from '@/shared/ui/icons';
import { iconTrigger } from '@/shared/ui/motion';

const MotionLink = m.create(Link);

/** The library's one primary action: a link that looks like the primary button. Its icon plays on hover and focus. */
export function NewSpecIdLink() {
  return (
    <MotionLink
      to="/atlas/new"
      {...iconTrigger}
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-medium whitespace-nowrap text-on-accent shadow-sm transition-colors duration-150 ease-standard hover:bg-accent-hover"
    >
      <PlusIcon size={16} />
      New Spec ID
    </MotionLink>
  );
}
